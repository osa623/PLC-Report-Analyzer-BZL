import json
import logging
from pathlib import Path
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)


class SectorKPIService:
    _RATIO_NAME_MAP: dict[str, tuple[str, ...]] = {
        "net_margin": ("net_margin", "net_profit_margin"),
        "gross_margin": ("gross_margin", "gross_profit_margin"),
        "roe": ("roe", "return_on_equity"),
        "roa": ("roa", "return_on_assets"),
        "current_ratio": ("current_ratio",),
        "asset_turnover": ("asset_turnover",),
    }

    def __init__(
        self,
        redis_client: Redis,
        input_prefix: str,
        ratios_suffix: str,
        output_suffix: str,
        ttl_seconds: int,
        benchmarks_file_path: str,
    ) -> None:
        self.redis_client = redis_client
        self.input_prefix = input_prefix
        self.ratios_suffix = ratios_suffix
        self.output_suffix = output_suffix
        self.ttl_seconds = ttl_seconds
        self.benchmarks = self._load_benchmarks(benchmarks_file_path)

    @staticmethod
    def _load_benchmarks(file_path: str) -> dict[str, dict[str, float]]:
        path = Path(file_path)
        if not path.exists():
            logger.warning("Benchmark file not found: %s", file_path)
            return {}

        try:
            with path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
        except Exception:
            logger.error("Unable to load benchmark file")
            return {}

        normalized: dict[str, dict[str, float]] = {}
        if not isinstance(payload, dict):
            return normalized

        for sector, metrics in payload.items():
            if not isinstance(metrics, dict):
                continue
            sec_key = str(sector).strip().lower()
            normalized[sec_key] = {}
            for metric, value in metrics.items():
                try:
                    normalized[sec_key][str(metric).strip().lower()] = float(value)
                except (TypeError, ValueError):
                    continue

        return normalized

    def _ratios_key(self, report_id: str) -> str:
        return f"{self.input_prefix}:{report_id}:{self.ratios_suffix}"

    def _output_key(self, report_id: str) -> str:
        return f"{self.input_prefix}:{report_id}:{self.output_suffix}"

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(str(value).strip())
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _classify(company_value: float, sector_average: float) -> str:
        if sector_average == 0:
            return "inline"
        deviation_pct = ((company_value - sector_average) / abs(sector_average)) * 100.0
        if deviation_pct > 5:
            return "above"
        if deviation_pct < -5:
            return "below"
        return "inline"

    def _pick_sector_benchmarks(self, sector: str) -> dict[str, float]:
        sector_key = sector.strip().lower()
        if sector_key in self.benchmarks:
            return self.benchmarks[sector_key]
        return self.benchmarks.get("generic", {})

    def _extract_company_ratios(self, payload: Any) -> dict[str, float]:
        if not isinstance(payload, dict):
            return {}

        ratio_rows = payload.get("ratios")
        if not isinstance(ratio_rows, list):
            return {}

        latest_by_metric: dict[str, tuple[int, float]] = {}

        for row in ratio_rows:
            if not isinstance(row, dict):
                continue
            name = str(row.get("name") or "").strip().lower()
            year = row.get("year")
            value = self._to_float(row.get("value"))
            if not name or value is None:
                continue

            try:
                yr = int(year)
            except (TypeError, ValueError):
                yr = -1

            prev = latest_by_metric.get(name)
            if prev is None or yr >= prev[0]:
                latest_by_metric[name] = (yr, value)

        canonical: dict[str, float] = {}
        for canonical_metric, aliases in self._RATIO_NAME_MAP.items():
            for alias in aliases:
                if alias in latest_by_metric:
                    canonical[canonical_metric] = latest_by_metric[alias][1]
                    break

        return canonical

    def process(self, report_id: str, sector: str) -> str:
        try:
            ratios_raw = self.redis_client.get(self._ratios_key(report_id))
        except Exception:
            logger.error("Redis unavailable while reading ratios for report_id=%s", report_id)
            return "failed"
        if ratios_raw is None:
            return "not_found"

        try:
            ratios_payload = json.loads(ratios_raw)
        except json.JSONDecodeError:
            logger.error("Invalid ratios JSON for report_id=%s", report_id)
            return "failed"

        benchmarks = self._pick_sector_benchmarks(sector)
        company_ratios = self._extract_company_ratios(ratios_payload)

        kpis: list[dict[str, Any]] = []
        for metric, sector_avg in benchmarks.items():
            company_val = company_ratios.get(metric)
            if company_val is None:
                continue

            deviation = 0.0
            if sector_avg != 0:
                deviation = ((company_val - sector_avg) / abs(sector_avg)) * 100.0

            kpis.append(
                {
                    "metric": metric,
                    "company_value": company_val,
                    "sector_average": sector_avg,
                    "deviation": deviation,
                    "performance": self._classify(company_val, sector_avg),
                }
            )

        output_payload = {
            "sector": sector,
            "kpis": kpis,
            "metadata": {
                "report_id": report_id,
                "kpi_count": len(kpis),
            },
        }

        try:
            self.redis_client.set(
                name=self._output_key(report_id),
                value=json.dumps(output_payload, ensure_ascii=True),
                ex=self.ttl_seconds,
            )
        except Exception:
            logger.error("Redis unavailable while writing sector KPIs for report_id=%s", report_id)
            return "failed"

        return "completed"
