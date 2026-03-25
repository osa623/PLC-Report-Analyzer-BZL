import json
import logging
import math
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
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

_CORE_SUMMARY_METRICS = ("revenue", "net_profit", "total_assets", "total_equity")

_VALIDATION_REQUIRED_METRICS = (
    "revenue",
    "net_profit",
    "total_assets",
    "total_equity",
    "operating_cashflow",
)


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
        if isinstance(value, str):
            text = value.strip()
            if text.isdigit():
                return int(text)
            matches = re.findall(r"(?:19|20)\d{2}", text)
            if matches:
                # Prefer the latest year when range formats like "2023/2024" appear.
                return max(int(match) for match in matches)
        return None

    @staticmethod
    def _entity_priority(entity_type: Any) -> int:
        normalized = str(entity_type or "").strip().lower()
        if "consolidated" in normalized:
            return 1
        if normalized:
            return 2
        return 3

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

        def _with_section(raw_rows: list[Any], section_name: str) -> list[dict[str, Any]]:
            normalized: list[dict[str, Any]] = []
            for item in raw_rows:
                if not isinstance(item, dict):
                    continue
                row = dict(item)
                row.setdefault("_source_section", section_name)
                normalized.append(row)
            return normalized

        for key in ("normalized_rows", "records", "rows", "data"):
            value = payload.get(key)
            if isinstance(value, list):
                rows.extend(_with_section(value, "financial_highlights"))
        for section in ("income_statement", "balance_sheet", "cashflow", "segments", "segment"):
            section_payload = payload.get(section)
            if isinstance(section_payload, dict):
                for key in ("normalized_rows", "records", "rows", "data"):
                    value = section_payload.get(key)
                    if isinstance(value, list):
                        rows.extend(_with_section(value, section))
            elif isinstance(section_payload, list):
                rows.extend(_with_section(section_payload, section))
        if not rows and {"year", "entity_type", "semantic_type", "value"}.issubset(set(payload.keys())):
            row = dict(payload)
            row.setdefault("_source_section", "unknown")
            rows.append(row)
        return rows

    @staticmethod
    def _source_priority(source_section: str) -> int:
        section = str(source_section or "").strip().lower()
        if section in {"income_statement", "balance_sheet", "cashflow"}:
            return 1
        if section in {"financial_highlights", "highlights"}:
            return 2
        if section in {"chairman_commentary", "ceo_commentary", "management_commentary", "commentary"}:
            return 3
        return 4

    @staticmethod
    def _normalize_metric_name(metric: str) -> str:
        return str(metric or "").strip().lower()

    def _metric_for_semantic(self, semantic: str) -> str | None:
        normalized = self._normalize_metric_name(semantic)
        if not normalized:
            return None
        for metric, aliases in _METRIC_ALIASES.items():
            if normalized in aliases:
                return metric
        return None

    def _load_rows_for_report(self, report_id: str) -> list[dict[str, Any]]:
        payload = self._load_json(self._key(report_id))
        if payload is None:
            return []
        rows = self._extract_rows(payload)
        for row in rows:
            row.setdefault("_report_id", report_id)
        return rows

    def _build_report_anchor_years(self, report_ids: list[str]) -> dict[str, int]:
        """Pick one dominant year per report to avoid including extra comparative years from the same PDF."""
        anchor_years: dict[str, int] = {}
        workers = min(8, max(1, len(report_ids)))

        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {executor.submit(self._load_rows_for_report, report_id): report_id for report_id in report_ids}
            for future in as_completed(future_map):
                report_id = future_map[future]
                try:
                    rows = future.result()
                except Exception:
                    logger.exception("Failed loading rows for anchor-year detection report_id=%s", report_id)
                    continue

                year_score: dict[int, int] = defaultdict(int)
                for row in rows:
                    year = self._as_year(row.get("year"))
                    if year is None:
                        continue
                    semantic = str(row.get("semantic_type") or "").strip().lower()
                    metric = self._metric_for_semantic(semantic)

                    if metric in _CORE_SUMMARY_METRICS:
                        year_score[year] += 3
                    elif metric is not None:
                        year_score[year] += 1

                if not year_score:
                    continue

                best_year = max(year_score.keys(), key=lambda year: (year_score[year], year))
                anchor_years[str(report_id)] = int(best_year)

        return anchor_years

    def _build_year_metrics(
        self,
        report_ids: list[str],
        report_anchor_years: dict[str, int] | None = None,
    ) -> tuple[
        dict[int, dict[str, float]],
        dict[int, dict[str, dict[str, Any]]],
        list[dict[str, Any]],
        list[dict[str, Any]],
    ]:
        """Collect year->metric values with source traceability and conflict detection."""
        evidence_by_year_report: dict[int, dict[str, dict[str, list[dict[str, Any]]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )

        workers = min(8, max(1, len(report_ids)))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {executor.submit(self._load_rows_for_report, report_id): report_id for report_id in report_ids}
            for future in as_completed(future_map):
                report_id = future_map[future]
                try:
                    rows = future.result()
                except Exception:
                    logger.exception("Failed to load rows for report_id=%s", report_id)
                    continue

                for row in rows:
                    year = self._as_year(row.get("year"))
                    if year is None:
                        continue
                    row_report_id = str(row.get("_report_id") or report_id)
                    anchor_year = report_anchor_years.get(row_report_id) if isinstance(report_anchor_years, dict) else None
                    if isinstance(anchor_year, int) and year != anchor_year:
                        continue
                    semantic = str(row.get("semantic_type") or "").strip().lower()
                    value = self._to_float(row.get("value"))
                    if not semantic or value is None:
                        continue
                    metric = self._metric_for_semantic(semantic)
                    if metric is None:
                        continue

                    evidence_by_year_report[year][metric][row_report_id].append(
                        {
                            "value": value,
                            "semantic_type": semantic,
                            "source_section": str(row.get("_source_section") or "unknown"),
                            "report_id": row_report_id,
                            "entity_type": str(row.get("entity_type") or ""),
                            "label": str(row.get("label") or ""),
                        }
                    )

        resolved_by_year: dict[int, dict[str, float]] = defaultdict(dict)
        traceability: dict[int, dict[str, dict[str, Any]]] = defaultdict(dict)
        conflicts: list[dict[str, Any]] = []

        for year in sorted(evidence_by_year_report.keys()):
            metric_map = evidence_by_year_report[year]
            for metric, report_candidates in metric_map.items():
                per_report_selected: list[dict[str, Any]] = []
                for _, evidences in report_candidates.items():
                    if not evidences:
                        continue
                    ranked = sorted(
                        evidences,
                        key=lambda item: (
                            self._source_priority(str(item.get("source_section"))),
                            self._entity_priority(item.get("entity_type")),
                        ),
                    )
                    per_report_selected.append(ranked[0])

                if not per_report_selected:
                    continue

                # Reconcile across reports using consensus first; fallback to median-like robust center.
                value_groups: dict[float, list[dict[str, Any]]] = defaultdict(list)
                for selected in per_report_selected:
                    bucket_key = round(float(selected.get("value", 0.0)), 2)
                    value_groups[bucket_key].append(selected)

                best_bucket_key = max(
                    value_groups.keys(),
                    key=lambda key: (
                        len(value_groups[key]),
                        -min(self._source_priority(str(item.get("source_section"))) for item in value_groups[key]),
                    ),
                )

                bucket_items = value_groups[best_bucket_key]
                bucket_items_sorted = sorted(
                    bucket_items,
                    key=lambda item: (
                        self._source_priority(str(item.get("source_section"))),
                        self._entity_priority(item.get("entity_type")),
                    ),
                )
                selected = bucket_items_sorted[0]
                resolved_by_year[year][metric] = float(selected["value"])
                traceability[year][metric] = {
                    "source_section": selected.get("source_section"),
                    "report_id": selected.get("report_id"),
                    "semantic_type": selected.get("semantic_type"),
                    "entity_type": selected.get("entity_type"),
                    "label": selected.get("label"),
                    "supporting_reports": sorted({str(item.get("report_id") or "") for item in bucket_items}),
                }

                unique_values = sorted({round(float(item["value"]), 6) for item in per_report_selected})
                if len(unique_values) > 1:
                    conflicts.append(
                        {
                            "year": year,
                            "metric": metric,
                            "selected_value": float(selected["value"]),
                            "selected_source": selected.get("source_section"),
                            "candidate_values": unique_values,
                            "candidate_reports": sorted({str(item.get("report_id") or "") for item in per_report_selected}),
                        }
                    )

        missing_fields: list[dict[str, Any]] = []
        for year in sorted(resolved_by_year.keys()):
            year_values = resolved_by_year[year]
            for metric in _VALIDATION_REQUIRED_METRICS:
                if metric not in year_values:
                    missing_fields.append({"year": year, "metric": metric})

        return (
            dict(sorted(resolved_by_year.items())),
            dict(sorted(traceability.items())),
            conflicts,
            missing_fields,
        )

    def _build_verified_financial_summary(self, year_metrics: dict[int, dict[str, float]]) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for year in sorted(year_metrics.keys()):
            values = year_metrics[year]
            rows.append(
                {
                    "year": year,
                    "revenue": values.get("revenue"),
                    "net_profit": values.get("net_profit"),
                    "total_assets": values.get("total_assets"),
                    "total_equity": values.get("total_equity"),
                    "operating_cashflow": values.get("operating_cashflow"),
                }
            )
        return rows

    def _build_risk_stability_indicators(
        self,
        year_metrics: dict[int, dict[str, float]],
        ratio_history: dict[int, dict[str, float]],
    ) -> list[dict[str, Any]]:
        indicators: list[dict[str, Any]] = []
        for year in sorted(year_metrics.keys()):
            metrics = year_metrics[year]
            liabilities = metrics.get("total_liabilities")
            equity = metrics.get("total_equity")
            assets = metrics.get("total_assets")
            current_assets = metrics.get("current_assets")
            current_liabilities = metrics.get("current_liabilities")
            ratios = ratio_history.get(year, {}) if isinstance(ratio_history, dict) else {}

            debt_to_equity = self._safe_div(liabilities, equity)
            equity_to_assets = self._safe_div(equity, assets)
            current_ratio = ratios.get("current_ratio")
            if current_ratio is None:
                current_ratio = self._safe_div(current_assets, current_liabilities)

            npl_ratio = ratios.get("npl_ratio")
            stage3_ratio = ratios.get("stage_3_ratio")

            indicators.append(
                {
                    "year": year,
                    "debt_to_equity": round(debt_to_equity, 4) if debt_to_equity is not None else None,
                    "equity_to_assets": round(equity_to_assets, 4) if equity_to_assets is not None else None,
                    "current_ratio": round(current_ratio, 4) if current_ratio is not None else None,
                    "npl_ratio": round(float(npl_ratio), 4) if isinstance(npl_ratio, (int, float)) else None,
                    "stage_3_ratio": round(float(stage3_ratio), 4) if isinstance(stage3_ratio, (int, float)) else None,
                }
            )
        return indicators

    def _build_data_integrity_report(
        self,
        requested_report_ids: list[str],
        eligible_report_ids: list[str],
        year_metrics: dict[int, dict[str, float]],
        missing_fields: list[dict[str, Any]],
        conflicts: list[dict[str, Any]],
        traceability: dict[int, dict[str, dict[str, Any]]],
    ) -> dict[str, Any]:
        years = sorted(year_metrics.keys())
        expected_cells = len(years) * len(_VALIDATION_REQUIRED_METRICS)
        available_cells = 0
        for year in years:
            for metric in _VALIDATION_REQUIRED_METRICS:
                if year_metrics.get(year, {}).get(metric) is not None:
                    available_cells += 1
        coverage_pct = round((available_cells / expected_cells) * 100, 2) if expected_cells else 0.0

        return {
            "requested_reports": len(requested_report_ids),
            "eligible_reports": len(eligible_report_ids),
            "years_covered": years,
            "coverage_percent": coverage_pct,
            "missing_fields": missing_fields,
            "conflicting_values": conflicts,
            "traceability": traceability,
        }

    def _build_analyst_commentary(
        self,
        year_metrics: dict[int, dict[str, float]],
        growth_analysis: dict[str, Any],
        risk_stability_indicators: list[dict[str, Any]],
    ) -> list[str]:
        notes: list[str] = []
        years = sorted(year_metrics.keys())
        if len(years) >= 2:
            first_year = years[0]
            last_year = years[-1]
            first_revenue = year_metrics[first_year].get("revenue")
            last_revenue = year_metrics[last_year].get("revenue")
            if first_revenue is not None and last_revenue is not None:
                delta = last_revenue - first_revenue
                pct = self._yoy_change(last_revenue, first_revenue)
                if pct is not None:
                    notes.append(
                        f"Revenue moved from {first_revenue:,.2f} in {first_year} to {last_revenue:,.2f} in {last_year} ({pct * 100:.2f}% change; absolute change {delta:,.2f})."
                    )

            first_profit = year_metrics[first_year].get("net_profit")
            last_profit = year_metrics[last_year].get("net_profit")
            if first_profit is not None and last_profit is not None:
                pct = self._yoy_change(last_profit, first_profit)
                if pct is not None:
                    notes.append(
                        f"Net profit changed from {first_profit:,.2f} in {first_year} to {last_profit:,.2f} in {last_year} ({pct * 100:.2f}%)."
                    )

        revenue_growth = growth_analysis.get("revenue_growth_rates") if isinstance(growth_analysis, dict) else []
        if isinstance(revenue_growth, list) and revenue_growth:
            latest = revenue_growth[-1]
            if isinstance(latest, dict) and isinstance(latest.get("value"), (int, float)):
                notes.append(
                    f"Latest year-on-year revenue change for {latest.get('year')} is {float(latest.get('value')) * 100:.2f}%."
                )

        if len(years) >= 3:
            yoy_values = [
                item.get("value")
                for item in revenue_growth
                if isinstance(item, dict) and isinstance(item.get("value"), (int, float))
            ]
            if len(yoy_values) >= 2:
                volatility = max(yoy_values) - min(yoy_values)
                if volatility >= 0.30:
                    notes.append("Trend unstable due to macroeconomic disruption risk indicated by high year-on-year volatility.")

        if risk_stability_indicators:
            latest_indicator = risk_stability_indicators[-1]
            if isinstance(latest_indicator.get("debt_to_equity"), (int, float)):
                notes.append(
                    f"Debt-to-equity in {latest_indicator.get('year')} is {float(latest_indicator.get('debt_to_equity')):.2f}x based on reported liabilities and equity."
                )
            if isinstance(latest_indicator.get("current_ratio"), (int, float)):
                notes.append(
                    f"Current ratio in {latest_indicator.get('year')} is {float(latest_indicator.get('current_ratio')):.2f}x."
                )

        return notes[:6]

    def _build_ratio_history(
        self,
        report_ids: list[str],
        report_anchor_years: dict[str, int] | None = None,
    ) -> dict[int, dict[str, float]]:
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
                anchor_year = report_anchor_years.get(str(report_id)) if isinstance(report_anchor_years, dict) else None
                if isinstance(anchor_year, int) and year != anchor_year:
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

    def _build_snapshot_summary_from_base(self, report_id: str) -> dict[str, float | None]:
        payload = self._load_json(self._key(report_id))
        rows = self._extract_rows(payload)
        by_year_metric: dict[int, dict[str, float]] = defaultdict(dict)

        for row in rows:
            year = self._as_year(row.get("year"))
            if year is None:
                continue
            semantic = str(row.get("semantic_type") or "").strip().lower()
            value = self._to_float(row.get("value"))
            if not semantic or value is None:
                continue
            for metric, aliases in _METRIC_ALIASES.items():
                if semantic in aliases:
                    by_year_metric[year][metric] = value

        if not by_year_metric:
            return {
                "total_revenue": None,
                "net_profit": None,
                "operating_cashflow": None,
                "total_assets": None,
            }

        latest_year = max(by_year_metric.keys())
        latest_metrics = by_year_metric[latest_year]
        return {
            "total_revenue": latest_metrics.get("revenue"),
            "net_profit": latest_metrics.get("net_profit"),
            "operating_cashflow": latest_metrics.get("operating_cashflow"),
            "total_assets": latest_metrics.get("total_assets"),
        }

    def _build_report_snapshots(self, report_ids: list[str]) -> list[dict[str, Any]]:
        """Collect summary/ratio/pattern highlights per report for richer comparative output."""
        snapshots: list[dict[str, Any]] = []
        for report_id in report_ids:
            payload = self._load_json(self._key(report_id, self.final_report_suffix))
            if not isinstance(payload, dict):
                summary = self._build_snapshot_summary_from_base(report_id)
                ratio_count = 0
                pattern_count = 0
                top_patterns: list[str] = []

                ratio_payload = self._load_json(self._key(report_id, self.ratios_suffix))
                if isinstance(ratio_payload, dict) and isinstance(ratio_payload.get("ratios"), list):
                    ratio_count = len([item for item in ratio_payload.get("ratios", []) if isinstance(item, dict)])

                pattern_payload = self._load_json(self._key(report_id, self.patterns_suffix))
                if isinstance(pattern_payload, dict) and isinstance(pattern_payload.get("patterns"), list):
                    valid_patterns = [item for item in pattern_payload.get("patterns", []) if isinstance(item, dict)]
                    pattern_count = len(valid_patterns)
                    for pattern in valid_patterns[:5]:
                        p_type = str(pattern.get("pattern_type") or "").strip()
                        if p_type:
                            top_patterns.append(p_type)

                snapshots.append(
                    {
                        "report_id": report_id,
                        "summary": summary,
                        "ratio_count": ratio_count,
                        "pattern_count": pattern_count,
                        "top_patterns": top_patterns,
                    }
                )
                continue

            summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
            ratios = payload.get("ratios") if isinstance(payload.get("ratios"), dict) else {}
            patterns = payload.get("patterns") if isinstance(payload.get("patterns"), list) else []

            if not any(isinstance(summary.get(metric), (int, float)) for metric in ("total_revenue", "net_profit", "operating_cashflow", "total_assets")):
                summary = self._build_snapshot_summary_from_base(report_id)

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

    @staticmethod
    def _is_numeric(value: Any) -> bool:
        return isinstance(value, (int, float)) and not isinstance(value, bool)

    def _evaluate_snapshot_readiness(
        self,
        report_id: str,
        snapshot: dict[str, Any],
    ) -> tuple[bool, list[str]]:
        reasons: list[str] = []
        summary = snapshot.get("summary") if isinstance(snapshot.get("summary"), dict) else {}
        ratio_count = int(snapshot.get("ratio_count") or 0)
        base_payload = self._load_json(self._key(report_id))
        base_rows = self._extract_rows(base_payload)
        has_base_rows = len(base_rows) > 0

        if not summary:
            reasons.append("missing_summary")

        has_numeric_summary_metric = any(
            self._is_numeric(summary.get(metric_name))
            for metric_name in ("total_revenue", "net_profit", "total_assets")
        )
        if not has_numeric_summary_metric:
            reasons.append("missing_numeric_summary_metrics")

        if ratio_count <= 0:
            reasons.append("missing_ratio_data")

        if has_base_rows:
            return True, reasons

        return has_numeric_summary_metric or ratio_count > 0, reasons

    def _filter_eligible_reports(
        self,
        requested_report_ids: list[str],
        report_snapshots: list[dict[str, Any]],
    ) -> tuple[list[str], list[dict[str, Any]]]:
        snapshots_by_report_id = {
            str(snapshot.get("report_id")): snapshot
            for snapshot in report_snapshots
            if snapshot.get("report_id") is not None
        }

        eligible_report_ids: list[str] = []
        readiness: list[dict[str, Any]] = []

        for report_id in requested_report_ids:
            snapshot = snapshots_by_report_id.get(str(report_id))
            if snapshot is None:
                readiness.append(
                    {
                        "report_id": report_id,
                        "ready": False,
                        "reasons": ["missing_final_report_payload"],
                    }
                )
                continue

            ready, reasons = self._evaluate_snapshot_readiness(report_id=report_id, snapshot=snapshot)
            readiness.append(
                {
                    "report_id": report_id,
                    "ready": ready,
                    "reasons": reasons,
                }
            )
            if ready:
                eligible_report_ids.append(report_id)

        return eligible_report_ids, readiness

    def _build_quality_gate(
        self,
        requested_report_ids: list[str],
        eligible_report_ids: list[str],
        years_analyzed: list[int],
        metric_trends: list[dict[str, Any]],
        ratio_comparison: dict[str, Any],
    ) -> dict[str, Any]:
        requested_count = len(requested_report_ids)
        eligible_count = len(eligible_report_ids)
        coverage = (eligible_count / requested_count) if requested_count else 0.0

        errors: list[str] = []
        if eligible_count == 0:
            errors.append("no_eligible_reports")
        if not years_analyzed:
            errors.append("missing_year_metrics")
        if not metric_trends and not ratio_comparison:
            errors.append("missing_metric_trends_and_ratios")

        passed = len(errors) == 0
        return {
            "passed": passed,
            "coverage": round(coverage, 4),
            "requested_reports": requested_count,
            "eligible_reports": eligible_count,
            "errors": errors,
        }

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
            requested_report_ids = list(dict.fromkeys(report_ids))
            report_snapshots = self._build_report_snapshots(requested_report_ids)
            eligible_report_ids, readiness = self._filter_eligible_reports(requested_report_ids, report_snapshots)
            aggregation_report_ids = requested_report_ids
            report_anchor_years = self._build_report_anchor_years(aggregation_report_ids)

            year_metrics, traceability, conflicts, missing_fields = self._build_year_metrics(
                aggregation_report_ids,
                report_anchor_years=report_anchor_years,
            )
            ratio_history = self._build_ratio_history(
                aggregation_report_ids,
                report_anchor_years=report_anchor_years,
            )
            patterns = self._build_pattern_history(aggregation_report_ids)

            verified_financial_summary = self._build_verified_financial_summary(year_metrics)
            metric_trends = self._build_metric_trends(year_metrics)
            growth_analysis = self._build_growth_analysis(year_metrics)
            dupont_analysis = self._build_dupont(year_metrics)
            cashflow_breakdown = self._build_cashflow_breakdown(year_metrics)
            ratio_comparison = self._build_ratio_comparison(ratio_history)
            risk_heatmap = self._build_risk_heatmap(patterns)
            risk_stability_indicators = self._build_risk_stability_indicators(year_metrics, ratio_history)
            years_analyzed = sorted(year_metrics.keys())

            data_integrity = self._build_data_integrity_report(
                requested_report_ids=requested_report_ids,
                eligible_report_ids=eligible_report_ids,
                year_metrics=year_metrics,
                missing_fields=missing_fields,
                conflicts=conflicts,
                traceability=traceability,
            )

            analyst_commentary = self._build_analyst_commentary(
                year_metrics=year_metrics,
                growth_analysis=growth_analysis,
                risk_stability_indicators=risk_stability_indicators,
            )

            quality_gate = self._build_quality_gate(
                requested_report_ids=requested_report_ids,
                eligible_report_ids=eligible_report_ids,
                years_analyzed=years_analyzed,
                metric_trends=metric_trends,
                ratio_comparison=ratio_comparison,
            )
            status = "completed" if quality_gate["passed"] else "failed"

            result = {
                "batch_id": batch_id,
                "company": company_info,
                "status": status,
                "verified_financial_summary": verified_financial_summary,
                "metric_trends": metric_trends,
                "growth_analysis": growth_analysis,
                "dupont_analysis": dupont_analysis,
                "cashflow_breakdown": cashflow_breakdown,
                "ratio_comparison": ratio_comparison,
                "risk_heatmap": risk_heatmap,
                "risk_stability_indicators": risk_stability_indicators,
                "data_integrity": data_integrity,
                "analyst_commentary": analyst_commentary,
                "report_anchor_years": report_anchor_years,
                "years_analyzed": years_analyzed,
                "report_snapshots": report_snapshots,
                "report_ids": eligible_report_ids,
                "requested_report_ids": requested_report_ids,
                "skipped_report_ids": [
                    item["report_id"] for item in readiness if not item.get("ready")
                ],
                "report_readiness": readiness,
                "quality_gate": quality_gate,
            }

            self.redis_client.set(
                name=self._batch_key(batch_id),
                value=json.dumps(result, ensure_ascii=True),
                ex=self.ttl_seconds,
            )

            return status

        except Exception:
            logger.exception("Comparative analysis failed for batch_id=%s", batch_id)
            return "failed"

    def get_result(self, batch_id: str) -> dict | None:
        return self._load_json(self._batch_key(batch_id))
