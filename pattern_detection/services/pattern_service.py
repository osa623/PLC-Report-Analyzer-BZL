import json
import logging
from collections import defaultdict
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)


class PatternService:
    def __init__(
        self,
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        patterns_suffix: str,
        risk_suffix: str,
        strategy_suffix: str,
        ttl_seconds: int,
    ) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.ratios_suffix = ratios_suffix
        self.patterns_suffix = patterns_suffix
        self.risk_suffix = risk_suffix
        self.strategy_suffix = strategy_suffix
        self.ttl_seconds = ttl_seconds

    def _key(self, report_id: str, suffix: str | None = None) -> str:
        if suffix:
            return f"{self.input_prefix}:{report_id}:{suffix}"
        return f"{self.input_prefix}:{report_id}"

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
    def _as_entity(value: Any) -> str:
        if value is None:
            return "unknown"
        entity = str(value).strip().lower()
        return entity or "unknown"

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

        if not rows and {"year", "entity_type", "semantic_type", "value"}.issubset(set(payload.keys())):
            rows.append(payload)

        return rows

    @staticmethod
    def _safe_ratio(numerator: float | None, denominator: float | None) -> float | None:
        if numerator is None or denominator is None or denominator == 0:
            return None
        return numerator / denominator

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

    @staticmethod
    def _collect_risk_count(payload: Any) -> int:
        if not isinstance(payload, dict):
            return 0
        risks = payload.get("records") or payload.get("risks")
        if isinstance(risks, list):
            return len(risks)
        return 0

    @staticmethod
    def _collect_strategy_texts(payload: Any) -> list[str]:
        if not isinstance(payload, dict):
            return []
        records = payload.get("records") or payload.get("strategies")
        if not isinstance(records, list):
            return []

        texts: list[str] = []
        for record in records:
            if not isinstance(record, dict):
                continue
            text = record.get("text")
            if text is None:
                continue
            clean = str(text).strip()
            if clean:
                texts.append(clean.lower())
        return texts

    def process(self, report_id: str) -> str:
        base_payload = self._load_json(self._key(report_id))
        if base_payload is None:
            return "not_found"

        ratio_payload = self._load_json(self._key(report_id, self.ratios_suffix)) or {}
        risk_payload = self._load_json(self._key(report_id, self.risk_suffix)) or {}
        strategy_payload = self._load_json(self._key(report_id, self.strategy_suffix)) or {}

        rows = self._extract_rows(base_payload)
        ratio_rows = ratio_payload.get("ratios") if isinstance(ratio_payload, dict) else []
        ratio_rows = ratio_rows if isinstance(ratio_rows, list) else []

        grouped_semantics: dict[tuple[int, str], dict[str, float]] = defaultdict(dict)
        segment_totals: dict[tuple[int, str], float] = defaultdict(float)
        segment_values: dict[tuple[int, str], dict[str, float]] = defaultdict(dict)

        for row in rows:
            year = self._as_year(row.get("year"))
            if year is None:
                continue
            entity = self._as_entity(row.get("entity_type"))
            value = self._to_float(row.get("value"))
            if value is None:
                continue

            semantic = str(row.get("semantic_type") or "").strip().lower()
            if semantic:
                grouped_semantics[(year, entity)][semantic] = value

            segment_name = row.get("segment_name")
            if segment_name:
                seg_name = str(segment_name).strip()
                if seg_name:
                    segment_values[(year, entity)][seg_name] = value
                    segment_totals[(year, entity)] += max(value, 0.0)

        ratio_map: dict[tuple[int, str], dict[str, float]] = defaultdict(dict)
        for ratio in ratio_rows:
            if not isinstance(ratio, dict):
                continue
            name = str(ratio.get("name") or "").strip().lower()
            year = self._as_year(ratio.get("year"))
            entity = self._as_entity(ratio.get("entity_type"))
            value = self._to_float(ratio.get("value"))
            if not name or year is None or value is None:
                continue
            ratio_map[(year, entity)][name] = value

        patterns = []

        # Organize by entity
        entity_years: dict[str, list[int]] = defaultdict(list)
        data_by_year: dict[str, dict[int, dict[str, float]]] = defaultdict(dict)
        ratios_by_year: dict[str, dict[int, dict[str, float]]] = defaultdict(dict)

        # Merge extracted data
        for (y, e), metrics in grouped_semantics.items():
            entity_years[e].append(y)
            if y not in data_by_year[e]:
                data_by_year[e][y] = {}
            data_by_year[e][y].update(metrics)

        # Merge calculated ratios
        for (y, e), ratios in ratio_map.items():
            entity_years[e].append(y)
            if y not in ratios_by_year[e]:
                ratios_by_year[e][y] = {}
            ratios_by_year[e][y].update(ratios)

        for entity, years in entity_years.items():
            yrs = sorted(list(set(years)))
            if len(yrs) < 2:
                continue

            for i in range(1, len(yrs)):
                curr_y = yrs[i]
                prev_y = yrs[i-1]
                
                # Metrics
                curr_m = data_by_year[entity].get(curr_y, {})
                prev_m = data_by_year[entity].get(prev_y, {})
                
                # Ratios
                curr_r = ratios_by_year[entity].get(curr_y, {})
                prev_r = ratios_by_year[entity].get(prev_y, {})

                # 1. NIM Compression (Banking Specific)
                nim_curr = curr_r.get("net_interest_margin")
                nim_prev = prev_r.get("net_interest_margin")
                if nim_curr is not None and nim_prev is not None:
                    diff = nim_curr - nim_prev
                    # Threshold: -10bps (-0.001)
                    if diff < -0.001:
                        patterns.append({
                            "pattern_type": "nim_compression",
                            "entity": entity,
                            "year": curr_y,
                            "description": f"NIM compressed by {abs(diff)*100:.2f} bps YoY",
                            "severity": "high" if diff < -0.005 else "medium"
                        })

                # 2. Earnings Recovery
                pat_curr = curr_m.get("profit_for_year") or curr_m.get("net_profit")
                pat_prev = prev_m.get("profit_for_year") or prev_m.get("net_profit")
                if pat_curr and pat_prev and pat_prev > 0:
                     growth = (pat_curr - pat_prev) / abs(pat_prev)
                     # Check prior year for dip (if possible)
                     if i > 1:
                         prev2_y = yrs[i-2]
                         prev2_m = data_by_year[entity].get(prev2_y, {})
                         pat_prev2 = prev2_m.get("profit_for_year") or prev2_m.get("net_profit")
                         if pat_prev2 and pat_prev < pat_prev2 and growth > 0.05:
                             patterns.append({
                                 "pattern_type": "earnings_recovery",
                                 "entity": entity,
                                 "year": curr_y,
                                 "description": f"Earnings recovered (+{growth*100:.1f}%) after prior decline",
                                 "severity": "positive"
                             })

                # 3. Loan Book Acceleration
                loans_curr = curr_m.get("loans_and_advances_net")
                loans_prev = prev_m.get("loans_and_advances_net")
                if loans_curr and loans_prev and loans_prev > 0:
                    growth = (loans_curr - loans_prev) / loans_prev
                    if growth > 0.15:
                         patterns.append({
                             "pattern_type": "loan_growth_acceleration",
                             "entity": entity,
                             "year": curr_y,
                             "description": f"Loan book grew aggressively by {growth*100:.1f}%",
                             "severity": "medium"
                         })

                # 4. Deposit Flight Risk
                dep_curr = curr_m.get("due_to_depositors")
                dep_prev = prev_m.get("due_to_depositors")
                if dep_curr and dep_prev and dep_prev > 0:
                    growth = (dep_curr - dep_prev) / dep_prev
                    if growth < -0.05:
                        patterns.append({
                             "pattern_type": "deposit_outflow",
                             "entity": entity,
                             "year": curr_y,
                             "description": f"Deposit base contacted by {abs(growth)*100:.1f}%",
                             "severity": "high" 
                        })

                # 5. Cost Efficiency deterioration
                cir_curr = curr_r.get("cost_to_income_ratio")
                cir_prev = prev_r.get("cost_to_income_ratio")
                if cir_curr and cir_prev:
                    if cir_curr > (cir_prev + 0.05): # +5% deterioration
                         patterns.append({
                             "pattern_type": "efficiency_deterioration",
                             "entity": entity,
                             "year": curr_y,
                             "description": "Cost-to-Income ratio deteriorated significantly",
                             "severity": "medium"
                         })

        output = {
            "report_id": report_id,
            "patterns": patterns,
            "count": len(patterns)
        }
        
        try:
            self.redis_client.set(self._key(report_id, self.patterns_suffix), json.dumps(output), ex=self.ttl_seconds)
            return "completed"
        except Exception:
            return "failed"
                curr_ratios = ratio_map.get((year, entity), {})
                prev_ratios = ratio_map.get((prev_year, entity), {})

                rev_curr = curr.get("revenue")
                rev_prev = prev.get("revenue")
                if rev_curr is not None and rev_prev is not None and rev_prev != 0:
                    yoy = (rev_curr - rev_prev) / abs(rev_prev)
                    if yoy >= 0.1:
                        patterns.append(
                            {
                                "pattern_type": "revenue_growth",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.5 + min(abs(yoy), 0.5)),
                                "description": "Revenue increased year-over-year with material momentum.",
                                "supporting_metrics": ["revenue"],
                            }
                        )
                    elif yoy <= -0.1:
                        patterns.append(
                            {
                                "pattern_type": "revenue_decline",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.5 + min(abs(yoy), 0.5)),
                                "description": "Revenue declined year-over-year.",
                                "supporting_metrics": ["revenue"],
                            }
                        )

                net_margin_curr = curr_ratios.get("net_margin")
                net_margin_prev = prev_ratios.get("net_margin")
                if net_margin_curr is not None and net_margin_prev is not None:
                    delta = net_margin_curr - net_margin_prev
                    if delta >= 0.03:
                        patterns.append(
                            {
                                "pattern_type": "margin_expansion",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.55 + min(abs(delta) * 4, 0.45)),
                                "description": "Net margin expanded versus prior year.",
                                "supporting_metrics": ["net_margin"],
                            }
                        )
                    elif delta <= -0.03:
                        patterns.append(
                            {
                                "pattern_type": "margin_compression",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.55 + min(abs(delta) * 4, 0.45)),
                                "description": "Net margin compressed versus prior year.",
                                "supporting_metrics": ["net_margin"],
                            }
                        )

                costs_curr = curr.get("cost")
                costs_prev = prev.get("cost")
                if costs_curr is not None and costs_prev is not None and costs_prev != 0:
                    delta = (costs_curr - costs_prev) / abs(costs_prev)
                    if delta >= 0.15:
                        patterns.append(
                            {
                                "pattern_type": "cost_increase",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.5 + min(delta, 0.5)),
                                "description": "Underlying cost base increased materially.",
                                "supporting_metrics": ["cost"],
                            }
                        )

                expense_curr = curr.get("expense")
                expense_prev = prev.get("expense")
                if expense_curr is not None and expense_prev is not None and expense_prev != 0:
                    delta = (expense_curr - expense_prev) / abs(expense_prev)
                    if delta >= 0.2:
                        patterns.append(
                            {
                                "pattern_type": "expense_spike",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.55 + min(delta, 0.45)),
                                "description": "Operating expenses show a sharp spike.",
                                "supporting_metrics": ["expense"],
                            }
                        )

                gross_profit = curr.get("gross_profit")
                revenue = curr.get("revenue")
                cost = curr.get("cost")
                if gross_profit is not None and revenue is not None and cost is not None and revenue != 0:
                    cost_share = cost / revenue
                    if cost_share > 0.75:
                        patterns.append(
                            {
                                "pattern_type": "cost_structure_shift",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.5 + min(max(cost_share - 0.75, 0), 0.4)),
                                "description": "Cost structure indicates heavier cost intensity relative to revenue.",
                                "supporting_metrics": ["cost", "revenue", "gross_profit"],
                            }
                        )

                total_assets_curr = curr.get("total_assets") or curr.get("assets")
                total_assets_prev = prev.get("total_assets") or prev.get("assets")
                if (
                    total_assets_curr is not None
                    and total_assets_prev is not None
                    and total_assets_prev != 0
                    and rev_curr is not None
                    and rev_prev is not None
                ):
                    assets_growth = (total_assets_curr - total_assets_prev) / abs(total_assets_prev)
                    revenue_growth = self._safe_ratio(rev_curr - rev_prev, abs(rev_prev))
                    if assets_growth >= 0.1 and revenue_growth is not None and revenue_growth <= 0.02:
                        patterns.append(
                            {
                                "pattern_type": "inefficient_growth",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.6 + min(assets_growth, 0.3)),
                                "description": "Asset base increased without corresponding revenue growth.",
                                "supporting_metrics": ["assets", "revenue"],
                            }
                        )

                net_profit_curr = curr.get("net_profit")
                net_profit_prev = prev.get("net_profit")
                ocf_curr = curr.get("operating_cashflow")
                ocf_prev = prev.get("operating_cashflow")
                if (
                    net_profit_curr is not None
                    and net_profit_prev is not None
                    and ocf_curr is not None
                    and ocf_prev is not None
                    and net_profit_curr > net_profit_prev
                    and ocf_curr < ocf_prev
                ):
                    patterns.append(
                        {
                            "pattern_type": "earnings_quality_issue",
                            "year": year,
                            "entity_type": entity,
                            "confidence": 0.8,
                            "description": "Profit growth diverges from operating cashflow trend.",
                            "supporting_metrics": ["net_profit", "operating_cashflow"],
                        }
                    )

                current_ratio = curr_ratios.get("current_ratio")
                if current_ratio is not None and ocf_curr is not None and ocf_prev is not None:
                    if current_ratio < 1.0 and ocf_curr < ocf_prev:
                        patterns.append(
                            {
                                "pattern_type": "liquidity_risk",
                                "year": year,
                                "entity_type": entity,
                                "confidence": 0.75,
                                "description": "Weak current ratio and declining operating cashflow indicate liquidity pressure.",
                                "supporting_metrics": ["current_ratio", "operating_cashflow"],
                            }
                        )

        for (year, entity), segments in segment_values.items():
            total = segment_totals.get((year, entity), 0.0)
            if total <= 0:
                continue
            ranked = sorted(segments.values(), reverse=True)
            top_share = ranked[0] / total if ranked else 0.0
            if top_share >= 0.6:
                patterns.append(
                    {
                        "pattern_type": "segment_concentration",
                        "year": year,
                        "entity_type": entity,
                        "confidence": min(1.0, 0.5 + min(top_share - 0.6, 0.4)),
                        "description": "A single segment contributes a dominant share of segment value.",
                        "supporting_metrics": ["segment_value_distribution"],
                    }
                )
            if len(ranked) >= 2 and ranked[1] > 0 and (ranked[0] / ranked[1]) >= 2.0:
                patterns.append(
                    {
                        "pattern_type": "segment_imbalance",
                        "year": year,
                        "entity_type": entity,
                        "confidence": 0.7,
                        "description": "Top segment significantly outweighs the next largest segment.",
                        "supporting_metrics": ["segment_value_distribution"],
                    }
                )

        for entity, years in by_entity.items():
            ordered_years = sorted(set(years))
            for idx in range(1, len(ordered_years)):
                year = ordered_years[idx]
                prev_year = ordered_years[idx - 1]
                curr_segments = segment_values.get((year, entity), {})
                prev_segments = segment_values.get((prev_year, entity), {})
                for seg_name, seg_val in curr_segments.items():
                    prev_val = prev_segments.get(seg_name)
                    if prev_val is None or prev_val == 0:
                        continue
                    decline = (seg_val - prev_val) / abs(prev_val)
                    if decline <= -0.15:
                        patterns.append(
                            {
                                "pattern_type": "segment_decline",
                                "year": year,
                                "entity_type": entity,
                                "confidence": min(1.0, 0.55 + min(abs(decline), 0.4)),
                                "description": "At least one segment shows material year-over-year decline.",
                                "supporting_metrics": ["segment_value_distribution"],
                            }
                        )
                        break

        risk_count = self._collect_risk_count(risk_payload)
        strategy_texts = self._collect_strategy_texts(strategy_payload)
        if risk_count > 0 and not patterns:
            patterns.append(
                {
                    "pattern_type": "weak_signal",
                    "year": sorted(by_entity.values())[0][0] if by_entity and sorted(by_entity.values())[0] else 0,
                    "entity_type": "group",
                    "confidence": 0.35,
                    "description": "Risk narratives exist but financial pattern support is weak.",
                    "supporting_metrics": ["risk_disclosures"],
                }
            )

        for pattern in patterns:
            if pattern["pattern_type"] == "revenue_decline" and strategy_texts:
                claims_growth = any("growth" in text or "expand" in text for text in strategy_texts)
                if claims_growth:
                    pattern["confidence"] = min(1.0, pattern["confidence"] + 0.1)
                    pattern["pattern_type"] = "strategy_growth_contradiction"
                    pattern["description"] = "Growth-oriented strategy narrative conflicts with observed revenue decline."
                    pattern["supporting_metrics"].append("strategy_narrative")

        output_payload = {
            "report_id": report_id,
            "patterns": patterns,
            "metadata": {
                "pattern_count": len(patterns),
                "source_keys": {
                    "base": self._key(report_id),
                    "ratios": self._key(report_id, self.ratios_suffix),
                    "risk": self._key(report_id, self.risk_suffix),
                    "strategy": self._key(report_id, self.strategy_suffix),
                },
            },
        }

        try:
            self.redis_client.set(
                name=self._key(report_id, self.patterns_suffix),
                value=json.dumps(output_payload, ensure_ascii=True),
                ex=self.ttl_seconds,
            )
        except Exception:
            logger.error("Redis unavailable while writing patterns for report_id=%s", report_id)
            return "failed"

        return "completed"
