import json
import logging
import math
from collections import defaultdict
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)

# ── Semantic aliases used to locate key metrics across different extraction formats ──
_METRIC_ALIASES: dict[str, set[str]] = {
    "revenue": {"revenue", "total_revenue", "gross_income", "income", "turnover"},
    "net_profit": {"net_profit", "profit", "profit_after_tax", "profit_attributable", "net_income"},
    "gross_profit": {"gross_profit", "gross_margin_value"},
    "operating_profit": {"operating_profit", "operating_income", "ebit"},
    "total_assets": {"total_assets", "assets"},
    "total_liabilities": {"total_liabilities", "liabilities"},
    "total_equity": {"total_equity", "equity", "shareholders_equity", "shareholders_funds"},
    "operating_cashflow": {
        "operating_cashflow",
        "cash_flow_from_operating_activities",
        "net_cash_from_operating_activities",
    },
    "investing_cashflow": {
        "investing_cashflow",
        "cash_flow_from_investing_activities",
        "net_cash_from_investing_activities",
    },
    "financing_cashflow": {
        "financing_cashflow",
        "cash_flow_from_financing_activities",
        "net_cash_from_financing_activities",
    },
    "eps": {"eps", "earnings_per_share", "basic_eps"},
    "dps": {"dps", "dividend_per_share", "dividends_per_share"},
    "cost": {"cost", "cost_of_sales", "cost_of_revenue", "cost_of_goods_sold"},
    "current_assets": {"current_assets"},
    "current_liabilities": {"current_liabilities"},
}


class ComparativeService:
    def __init__(
        self,
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        final_report_suffix: str,
        comparative_suffix: str,
        ttl_seconds: int,
    ) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.ratios_suffix = ratios_suffix
        self.patterns_suffix = patterns_suffix
        self.final_report_suffix = final_report_suffix
        self.comparative_suffix = comparative_suffix
        self.ttl_seconds = ttl_seconds

    # ── Redis helpers ────────────────────────────────────────────────────────

    def _key(self, report_id: str, suffix: str | None = None) -> str:
        if suffix:
            return f"{self.input_prefix}:{report_id}:{suffix}"
        return f"{self.input_prefix}:{report_id}"

    def _batch_key(self, batch_id: str) -> str:
        return f"{self.input_prefix}:batch:{batch_id}:{self.comparative_suffix}"

    def _load_json(self, key: str) -> Any:
        try:
            raw = self.redis_client.get(key)
        except Exception:
            logger.error("Redis unavailable while reading key=%s", key)
            return None
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            logger.error("Invalid JSON at redis key=%s", key)
            return None

    # ── Numeric helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text or text in {"-", "--", "N/A", "n/a", "NA", "na"}:
            return None
        negative = text.startswith("(") and text.endswith(")")
        normalized = text.strip("()").replace(",", "").replace(" ", "")
        try:
            numeric = float(normalized)
        except ValueError:
            return None
        return -numeric if negative else numeric

    @staticmethod
    def _as_year(value: Any) -> int | None:
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.strip().isdigit():
            return int(value.strip())
        return None

    @staticmethod
    def _safe_div(a: float | None, b: float | None) -> float | None:
        if a is None or b is None or b == 0:
            return None
        return a / b

    @staticmethod
    def _cagr(start: float, end: float, years: int) -> float | None:
        if start <= 0 or end <= 0 or years <= 0:
            return None
        try:
            return (end / start) ** (1 / years) - 1
        except (ZeroDivisionError, ValueError, OverflowError):
            return None

    @staticmethod
    def _yoy_change(current: float | None, previous: float | None) -> float | None:
        if current is None or previous is None or previous == 0:
            return None
        return (current - previous) / abs(previous)

    # ── Row extraction (same logic as pattern_detection & report_generator) ──

    @staticmethod
    def _extract_rows(payload: Any) -> list[dict[str, Any]]:
        if isinstance(payload, list):
            return [item for item in payload if isinstance(item, dict)]
        if not isinstance(payload, dict):
            return []
        rows: list[dict[str, Any]] = []
        for key in ("normalized_rows", "records", "rows", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                rows.extend([item for item in value if isinstance(item, dict)])
        for section in ("income_statement", "balance_sheet", "cashflow", "segments", "segment"):
            section_payload = payload.get(section)
            if isinstance(section_payload, dict):
                for key in ("normalized_rows", "records", "rows", "data"):
                    value = section_payload.get(key)
                    if isinstance(value, list):
                        rows.extend([item for item in value if isinstance(item, dict)])
            elif isinstance(section_payload, list):
                rows.extend([item for item in section_payload if isinstance(item, dict)])
        if not rows and {"year", "entity_type", "semantic_type", "value"}.issubset(set(payload.keys())):
            rows.append(payload)
        return rows

    def _build_year_metrics(self, report_ids: list[str]) -> dict[int, dict[str, float]]:
        """Collect all year→metric→value from multiple reports."""
        by_year: dict[int, dict[str, float]] = defaultdict(dict)

        for report_id in report_ids:
            payload = self._load_json(self._key(report_id))
            if payload is None:
                continue
            rows = self._extract_rows(payload)
            for row in rows:
                year = self._as_year(row.get("year"))
                if year is None:
                    continue
                semantic = str(row.get("semantic_type") or "").strip().lower()
                value = self._to_float(row.get("value"))
                if not semantic or value is None:
                    continue
                # Map to canonical metric name
                for metric, aliases in _METRIC_ALIASES.items():
                    if semantic in aliases:
                        by_year[year][metric] = value

        return dict(sorted(by_year.items()))

    def _build_ratio_history(self, report_ids: list[str]) -> dict[int, dict[str, float]]:
        """Collect ratio data across all reports."""
        by_year: dict[int, dict[str, float]] = defaultdict(dict)

        for report_id in report_ids:
            payload = self._load_json(self._key(report_id, self.ratios_suffix))
            if not isinstance(payload, dict):
                continue
            ratios = payload.get("ratios")
            if not isinstance(ratios, list):
                continue
            for ratio in ratios:
                if not isinstance(ratio, dict):
                    continue
                name = str(ratio.get("name") or "").strip().lower()
                year = self._as_year(ratio.get("year"))
                value = self._to_float(ratio.get("value"))
                if not name or year is None or value is None:
                    continue
                by_year[year][name] = value

        return dict(sorted(by_year.items()))

    def _build_pattern_history(self, report_ids: list[str]) -> list[dict[str, Any]]:
        """Collect all patterns from all reports."""
        all_patterns: list[dict[str, Any]] = []
        for report_id in report_ids:
            payload = self._load_json(self._key(report_id, self.patterns_suffix))
            if not isinstance(payload, dict):
                continue
            patterns = payload.get("patterns")
            if isinstance(patterns, list):
                for p in patterns:
                    if isinstance(p, dict):
                        all_patterns.append(p)
        return all_patterns

    def _build_report_snapshots(self, report_ids: list[str]) -> list[dict[str, Any]]:
        """Collect summary/ratio/pattern highlights per report for richer comparative output."""
        snapshots: list[dict[str, Any]] = []
        for report_id in report_ids:
            payload = self._load_json(self._key(report_id, self.final_report_suffix))
            if not isinstance(payload, dict):
                continue

            summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
            ratios = payload.get("ratios") if isinstance(payload.get("ratios"), dict) else {}
            patterns = payload.get("patterns") if isinstance(payload.get("patterns"), list) else []

            ratio_count = 0
            for _, bucket in ratios.items():
                if isinstance(bucket, dict):
                    ratio_count += len(bucket)

            top_patterns: list[str] = []
            for pattern in patterns[:5]:
                if isinstance(pattern, dict):
                    p_type = str(pattern.get("pattern_type") or "").strip()
                    if p_type:
                        top_patterns.append(p_type)

            snapshots.append(
                {
                    "report_id": report_id,
                    "summary": summary,
                    "ratio_count": ratio_count,
                    "pattern_count": len(patterns),
                    "top_patterns": top_patterns,
                }
            )

        return snapshots

    # ── Metric trends (for charts) ───────────────────────────────────────────

    def _build_metric_trends(self, year_metrics: dict[int, dict[str, float]]) -> list[dict]:
        display_names = {
            "revenue": "Total Revenue",
            "net_profit": "Net Profit",
            "gross_profit": "Gross Profit",
            "operating_profit": "Operating Profit",
            "total_assets": "Total Assets",
            "total_liabilities": "Total Liabilities",
            "total_equity": "Total Equity",
            "eps": "Earnings Per Share",
            "dps": "Dividend Per Share",
        }

        trends = []
        for metric, display in display_names.items():
            values = []
            for year in sorted(year_metrics.keys()):
                val = year_metrics[year].get(metric)
                if val is not None:
                    values.append({"year": year, "value": val})

            if len(values) < 1:
                continue

            cagr = None
            latest_yoy = None
            if len(values) >= 2:
                cagr = self._cagr(
                    abs(values[0]["value"]),
                    abs(values[-1]["value"]),
                    int(values[-1]["year"] - values[0]["year"]),
                )
                latest_yoy = self._yoy_change(values[-1]["value"], values[-2]["value"])

            trends.append({
                "metric_name": metric,
                "display_name": display,
                "values": values,
                "cagr": round(cagr, 4) if cagr is not None else None,
                "latest_yoy_change": round(latest_yoy, 4) if latest_yoy is not None else None,
            })

        return trends

    # ── Growth analysis ──────────────────────────────────────────────────────

    def _build_growth_analysis(self, year_metrics: dict[int, dict[str, float]]) -> dict:
        years = sorted(year_metrics.keys())
        revenue_growth = []
        profit_growth = []
        asset_growth = []
        margin_trends = []

        for i in range(1, len(years)):
            curr_year, prev_year = years[i], years[i - 1]
            curr, prev = year_metrics[curr_year], year_metrics[prev_year]

            rev_change = self._yoy_change(curr.get("revenue"), prev.get("revenue"))
            if rev_change is not None:
                revenue_growth.append({"year": curr_year, "value": round(rev_change, 4)})

            profit_change = self._yoy_change(curr.get("net_profit"), prev.get("net_profit"))
            if profit_change is not None:
                profit_growth.append({"year": curr_year, "value": round(profit_change, 4)})

            asset_change = self._yoy_change(curr.get("total_assets"), prev.get("total_assets"))
            if asset_change is not None:
                asset_growth.append({"year": curr_year, "value": round(asset_change, 4)})

            rev = curr.get("revenue")
            np = curr.get("net_profit")
            if rev and np and rev != 0:
                margin_trends.append({"year": curr_year, "value": round(np / rev, 4)})

        return {
            "revenue_growth_rates": revenue_growth,
            "profit_growth_rates": profit_growth,
            "asset_growth_rates": asset_growth,
            "margin_trends": margin_trends,
        }

    # ── Investment signals ───────────────────────────────────────────────────

    def _build_investment_signals(
        self,
        year_metrics: dict[int, dict[str, float]],
        ratio_history: dict[int, dict[str, float]],
        patterns: list[dict],
    ) -> list[dict]:
        signals = []
        years = sorted(year_metrics.keys())

        # 1. Revenue Momentum
        if len(years) >= 2:
            growth_count = 0
            total_growth = 0.0
            for i in range(1, len(years)):
                rev_change = self._yoy_change(
                    year_metrics[years[i]].get("revenue"),
                    year_metrics[years[i - 1]].get("revenue"),
                )
                if rev_change is not None:
                    total_growth += rev_change
                    if rev_change > 0:
                        growth_count += 1

            growth_ratio = growth_count / max(len(years) - 1, 1)
            avg_growth = total_growth / max(len(years) - 1, 1)

            if growth_ratio >= 0.7 and avg_growth > 0.05:
                signal = "BULLISH"
                strength = min(1.0, growth_ratio * avg_growth * 10)
            elif growth_ratio <= 0.3 or avg_growth < -0.05:
                signal = "BEARISH"
                strength = min(1.0, (1 - growth_ratio) * abs(avg_growth) * 10)
            else:
                signal = "NEUTRAL"
                strength = 0.5

            signals.append({
                "category": "Revenue Momentum",
                "signal": signal,
                "strength": round(strength, 2),
                "description": f"{growth_count}/{len(years)-1} years of revenue growth. Avg YoY: {avg_growth*100:.1f}%",
                "supporting_data": {"growth_count": growth_count, "avg_growth": round(avg_growth, 4)},
            })

        # 2. Margin Quality
        if len(years) >= 2:
            margins = []
            for y in years:
                rev = year_metrics[y].get("revenue")
                np = year_metrics[y].get("net_profit")
                if rev and np and rev != 0:
                    margins.append(np / rev)

            if len(margins) >= 2:
                improving = sum(1 for i in range(1, len(margins)) if margins[i] > margins[i - 1])
                latest_margin = margins[-1]

                if improving >= len(margins) * 0.6 and latest_margin > 0.05:
                    signal = "BULLISH"
                    strength = min(1.0, latest_margin * 3 + 0.3)
                elif latest_margin < 0 or improving < len(margins) * 0.3:
                    signal = "BEARISH"
                    strength = min(1.0, abs(latest_margin) * 3 + 0.3)
                else:
                    signal = "NEUTRAL"
                    strength = 0.5

                signals.append({
                    "category": "Margin Quality",
                    "signal": signal,
                    "strength": round(strength, 2),
                    "description": f"Net margin: {latest_margin*100:.1f}%. Improving in {improving}/{len(margins)-1} years.",
                    "supporting_data": {"latest_margin": round(latest_margin, 4), "improving_years": improving},
                })

        # 3. Cash Flow Health
        if len(years) >= 1:
            positive_ocf_years = 0
            total_years = 0
            for y in years:
                ocf = year_metrics[y].get("operating_cashflow")
                if ocf is not None:
                    total_years += 1
                    if ocf > 0:
                        positive_ocf_years += 1

            if total_years > 0:
                ocf_ratio = positive_ocf_years / total_years
                latest_ocf = year_metrics[years[-1]].get("operating_cashflow")
                latest_np = year_metrics[years[-1]].get("net_profit")

                if ocf_ratio >= 0.8 and latest_ocf and latest_ocf > 0:
                    signal = "BULLISH"
                    strength = min(1.0, ocf_ratio)
                elif ocf_ratio <= 0.4:
                    signal = "BEARISH"
                    strength = min(1.0, 1 - ocf_ratio)
                else:
                    signal = "NEUTRAL"
                    strength = 0.5

                desc = f"Positive operating CF in {positive_ocf_years}/{total_years} years."
                if latest_ocf and latest_np and latest_np > 0:
                    cash_conversion = latest_ocf / latest_np
                    desc += f" Cash conversion: {cash_conversion:.1f}x"

                signals.append({
                    "category": "Cash Flow Health",
                    "signal": signal,
                    "strength": round(strength, 2),
                    "description": desc,
                    "supporting_data": {"positive_years": positive_ocf_years, "total_years": total_years},
                })

        # 4. Debt Position
        if len(years) >= 1:
            de_ratios = []
            for y in years:
                equity = year_metrics[y].get("total_equity")
                liabilities = year_metrics[y].get("total_liabilities")
                if equity and equity > 0 and liabilities is not None:
                    de_ratios.append(liabilities / equity)

            if de_ratios:
                latest_de = de_ratios[-1]
                if latest_de < 1.5 and (len(de_ratios) < 2 or de_ratios[-1] <= de_ratios[-2]):
                    signal = "BULLISH"
                    strength = min(1.0, max(0, 1 - latest_de / 3))
                elif latest_de > 3.0 or (len(de_ratios) >= 2 and de_ratios[-1] > de_ratios[-2] * 1.2):
                    signal = "BEARISH"
                    strength = min(1.0, latest_de / 5)
                else:
                    signal = "NEUTRAL"
                    strength = 0.5

                signals.append({
                    "category": "Debt Position",
                    "signal": signal,
                    "strength": round(strength, 2),
                    "description": f"Debt-to-equity: {latest_de:.2f}x",
                    "supporting_data": {"debt_to_equity": round(latest_de, 4)},
                })

        # 5. Dividend Signal
        dividend_years = 0
        for y in years:
            dps = year_metrics[y].get("dps")
            if dps is not None and dps > 0:
                dividend_years += 1

        if len(years) >= 1:
            div_ratio = dividend_years / len(years)
            if div_ratio >= 0.8:
                signal = "BULLISH"
                strength = min(1.0, div_ratio)
                desc = f"Dividends paid in {dividend_years}/{len(years)} years analyzed."
            elif div_ratio <= 0.3:
                signal = "BEARISH"
                strength = 0.6
                desc = f"Limited dividend history: {dividend_years}/{len(years)} years."
            else:
                signal = "NEUTRAL"
                strength = 0.5
                desc = f"Irregular dividends: {dividend_years}/{len(years)} years."

            signals.append({
                "category": "Dividend Signal",
                "signal": signal,
                "strength": round(strength, 2),
                "description": desc,
                "supporting_data": {"dividend_years": dividend_years},
            })

        return signals

    # ── DuPont Decomposition ─────────────────────────────────────────────────

    def _build_dupont(self, year_metrics: dict[int, dict[str, float]]) -> list[dict]:
        decompositions = []
        for year in sorted(year_metrics.keys()):
            m = year_metrics[year]
            revenue = m.get("revenue")
            net_profit = m.get("net_profit")
            total_assets = m.get("total_assets")
            total_equity = m.get("total_equity")

            net_margin = self._safe_div(net_profit, revenue)
            asset_turnover = self._safe_div(revenue, total_assets)
            equity_multiplier = self._safe_div(total_assets, total_equity)

            roe = None
            if net_margin is not None and asset_turnover is not None and equity_multiplier is not None:
                roe = net_margin * asset_turnover * equity_multiplier

            decompositions.append({
                "year": year,
                "net_margin": round(net_margin, 4) if net_margin is not None else None,
                "asset_turnover": round(asset_turnover, 4) if asset_turnover is not None else None,
                "equity_multiplier": round(equity_multiplier, 4) if equity_multiplier is not None else None,
                "roe": round(roe, 4) if roe is not None else None,
            })

        return decompositions

    # ── Financial Health Score ────────────────────────────────────────────────

    def _build_health_score(
        self,
        year_metrics: dict[int, dict[str, float]],
        ratio_history: dict[int, dict[str, float]],
    ) -> dict:
        years = sorted(year_metrics.keys())
        if not years:
            return {
                "overall_score": 0, "profitability_score": 0, "liquidity_score": 0,
                "growth_score": 0, "efficiency_score": 0, "stability_score": 0,
            }

        latest = year_metrics[years[-1]]

        # Profitability (0-100)
        rev = latest.get("revenue")
        np = latest.get("net_profit")
        profitability = 50.0
        if rev and np and rev != 0:
            margin = np / rev
            profitability = max(0, min(100, 50 + margin * 200))

        # Liquidity (0-100)
        liquidity = 50.0
        latest_ratios = ratio_history.get(years[-1], {})
        cr = latest_ratios.get("current_ratio")
        if cr is not None:
            liquidity = max(0, min(100, cr * 40))

        # Growth (0-100)
        growth = 50.0
        if len(years) >= 2:
            rev_change = self._yoy_change(
                year_metrics[years[-1]].get("revenue"),
                year_metrics[years[-2]].get("revenue"),
            )
            if rev_change is not None:
                growth = max(0, min(100, 50 + rev_change * 200))

        # Efficiency (0-100)
        efficiency = 50.0
        assets = latest.get("total_assets")
        if rev and assets and assets != 0:
            turnover = rev / assets
            efficiency = max(0, min(100, turnover * 60))

        # Stability (0-100)
        stability = 50.0
        equity = latest.get("total_equity")
        liabilities = latest.get("total_liabilities")
        if equity and equity > 0 and liabilities is not None:
            de = liabilities / equity
            stability = max(0, min(100, 100 - de * 20))

        overall = (profitability * 0.25 + liquidity * 0.2 + growth * 0.25 +
                   efficiency * 0.15 + stability * 0.15)

        return {
            "overall_score": round(overall, 1),
            "profitability_score": round(profitability, 1),
            "liquidity_score": round(liquidity, 1),
            "growth_score": round(growth, 1),
            "efficiency_score": round(efficiency, 1),
            "stability_score": round(stability, 1),
        }

    # ── Cashflow Breakdown ───────────────────────────────────────────────────

    def _build_cashflow_breakdown(self, year_metrics: dict[int, dict[str, float]]) -> list[dict]:
        breakdowns = []
        for year in sorted(year_metrics.keys()):
            m = year_metrics[year]
            operating = m.get("operating_cashflow")
            investing = m.get("investing_cashflow")
            financing = m.get("financing_cashflow")

            net_cf = None
            components = [v for v in [operating, investing, financing] if v is not None]
            if components:
                net_cf = sum(components)

            breakdowns.append({
                "year": year,
                "operating": operating,
                "investing": investing,
                "financing": financing,
                "net": round(net_cf, 2) if net_cf is not None else None,
            })

        return breakdowns

    # ── Ratio comparison (for radar chart) ───────────────────────────────────

    def _build_ratio_comparison(self, ratio_history: dict[int, dict[str, float]]) -> dict:
        comparison: dict[str, list[dict]] = defaultdict(list)
        for year in sorted(ratio_history.keys()):
            for name, value in ratio_history[year].items():
                comparison[name].append({"year": year, "value": round(value, 4)})
        return dict(comparison)

    # ── Risk heatmap ─────────────────────────────────────────────────────────

    def _build_risk_heatmap(self, patterns: list[dict]) -> dict:
        heatmap: dict[str, dict[int, float]] = defaultdict(dict)
        for p in patterns:
            p_type = str(p.get("pattern_type", ""))
            year = self._as_year(p.get("year"))
            confidence = self._to_float(p.get("confidence"))
            if p_type and year is not None and confidence is not None:
                heatmap[p_type][year] = max(heatmap[p_type].get(year, 0), confidence)
        return {k: dict(v) for k, v in heatmap.items()}

    # ── Main process ─────────────────────────────────────────────────────────

    def process(self, batch_id: str, report_ids: list[str], company_info: dict) -> str:
        try:
            year_metrics = self._build_year_metrics(report_ids)
            ratio_history = self._build_ratio_history(report_ids)
            patterns = self._build_pattern_history(report_ids)
            report_snapshots = self._build_report_snapshots(report_ids)

            metric_trends = self._build_metric_trends(year_metrics)
            growth_analysis = self._build_growth_analysis(year_metrics)
            investment_signals = self._build_investment_signals(year_metrics, ratio_history, patterns)
            dupont_analysis = self._build_dupont(year_metrics)
            financial_health = self._build_health_score(year_metrics, ratio_history)
            cashflow_breakdown = self._build_cashflow_breakdown(year_metrics)
            ratio_comparison = self._build_ratio_comparison(ratio_history)
            risk_heatmap = self._build_risk_heatmap(patterns)

            result = {
                "batch_id": batch_id,
                "company": company_info,
                "status": "completed",
                "metric_trends": metric_trends,
                "growth_analysis": growth_analysis,
                "investment_signals": investment_signals,
                "dupont_analysis": dupont_analysis,
                "financial_health": financial_health,
                "cashflow_breakdown": cashflow_breakdown,
                "ratio_comparison": ratio_comparison,
                "risk_heatmap": risk_heatmap,
                "years_analyzed": sorted(year_metrics.keys()),
                "report_snapshots": report_snapshots,
                "report_ids": report_ids,
            }

            self.redis_client.set(
                name=self._batch_key(batch_id),
                value=json.dumps(result, ensure_ascii=True),
                ex=self.ttl_seconds,
            )

            return "completed"

        except Exception:
            logger.exception("Comparative analysis failed for batch_id=%s", batch_id)
            return "failed"

    def get_result(self, batch_id: str) -> dict | None:
        return self._load_json(self._batch_key(batch_id))
