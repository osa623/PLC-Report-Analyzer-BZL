from __future__ import annotations

from typing import Any

from platform_core.contracts import (
    ANALYSIS_CALCULATION_VERSION,
    ANALYSIS_RESULT_SCHEMA_VERSION,
    AnalysisResultModel,
    build_envelope,
)


DRIFT_TOLERANCE = 0.0001


def _safe_div(numerator: float | None, denominator: float | None) -> float | None:
    if not isinstance(numerator, (int, float)) or not isinstance(denominator, (int, float)):
        return None
    if float(denominator) == 0.0:
        return None
    return float(numerator) / float(denominator)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def _score_positive(value: float | None, floor: float, target: float) -> float:
    if not isinstance(value, (int, float)):
        return 0.0
    if target <= floor:
        return 0.0
    return _clamp((float(value) - floor) / (target - floor), 0.0, 1.0) * 100.0


def _score_inverse(value: float | None, good: float, bad: float) -> float:
    if not isinstance(value, (int, float)):
        return 0.0
    if bad <= good:
        return 0.0
    return _clamp((bad - float(value)) / (bad - good), 0.0, 1.0) * 100.0


def _avg(values: list[float]) -> float:
    return sum(values) / float(len(values)) if values else 0.0


def _growth(current: float | None, previous: float | None) -> float | None:
    if not isinstance(current, (int, float)) or not isinstance(previous, (int, float)):
        return None
    if float(previous) == 0.0:
        return None
    return (float(current) - float(previous)) / abs(float(previous))


def _flatten_numbers(payload: Any, prefix: str = "") -> dict[str, float]:
    out: dict[str, float] = {}
    if isinstance(payload, dict):
        for key, value in payload.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            out.update(_flatten_numbers(value, path))
    elif isinstance(payload, list):
        for idx, value in enumerate(payload):
            path = f"{prefix}[{idx}]"
            out.update(_flatten_numbers(value, path))
    elif isinstance(payload, (int, float)):
        out[prefix] = float(payload)
    return out


def _compute_year_metrics(current: dict[str, Any], previous: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    revenue = current.get("revenue")
    cost_of_sales = current.get("cost_of_sales")
    gross_profit = current.get("gross_profit")
    operating_profit = current.get("operating_profit")
    net_profit = current.get("net_profit")
    total_assets = current.get("total_assets")
    total_liabilities = current.get("total_liabilities")
    equity = current.get("equity")
    current_assets = current.get("current_assets")
    current_liabilities = current.get("current_liabilities")
    inventory = current.get("inventory")
    total_debt = current.get("total_debt")
    operating_cash_flow = current.get("operating_cash_flow")
    shares_outstanding = current.get("shares_outstanding")

    metrics = {
        "revenue": revenue,
        "cost_of_sales": cost_of_sales,
        "gross_profit": gross_profit,
        "operating_profit": operating_profit,
        "net_profit": net_profit,
        "gross_margin": _safe_div(gross_profit, revenue),
        "operating_margin": _safe_div(operating_profit, revenue),
        "net_margin": _safe_div(net_profit, revenue),
        "return_on_assets": _safe_div(net_profit, total_assets),
        "return_on_equity": _safe_div(net_profit, equity),
        "current_ratio": _safe_div(current_assets, current_liabilities),
        "quick_ratio": _safe_div(
            (float(current_assets) - float(inventory))
            if isinstance(current_assets, (int, float)) and isinstance(inventory, (int, float))
            else None,
            current_liabilities,
        ),
        "debt_to_equity": _safe_div(total_debt, equity),
        "debt_ratio": _safe_div(total_liabilities, total_assets),
        "asset_turnover": _safe_div(revenue, total_assets),
        "revenue_growth_yoy": _growth(revenue, previous.get("revenue")),
        "net_profit_growth_yoy": _growth(net_profit, previous.get("net_profit")),
        "eps": _safe_div(net_profit, shares_outstanding),
        "book_value_per_share": _safe_div(equity, shares_outstanding),
        "operating_cash_flow": operating_cash_flow,
    }

    trace = {
        "gross_margin": {
            "raw_value": {"gross_profit": gross_profit, "revenue": revenue},
            "formula": "gross_profit / revenue",
            "final_metric": metrics["gross_margin"],
        },
        "operating_margin": {
            "raw_value": {"operating_profit": operating_profit, "revenue": revenue},
            "formula": "operating_profit / revenue",
            "final_metric": metrics["operating_margin"],
        },
        "net_margin": {
            "raw_value": {"net_profit": net_profit, "revenue": revenue},
            "formula": "net_profit / revenue",
            "final_metric": metrics["net_margin"],
        },
        "return_on_assets": {
            "raw_value": {"net_profit": net_profit, "total_assets": total_assets},
            "formula": "net_profit / total_assets",
            "final_metric": metrics["return_on_assets"],
        },
        "return_on_equity": {
            "raw_value": {"net_profit": net_profit, "equity": equity},
            "formula": "net_profit / equity",
            "final_metric": metrics["return_on_equity"],
        },
        "current_ratio": {
            "raw_value": {"current_assets": current_assets, "current_liabilities": current_liabilities},
            "formula": "current_assets / current_liabilities",
            "final_metric": metrics["current_ratio"],
        },
        "quick_ratio": {
            "raw_value": {
                "current_assets": current_assets,
                "inventory": inventory,
                "current_liabilities": current_liabilities,
            },
            "formula": "(current_assets - inventory) / current_liabilities",
            "final_metric": metrics["quick_ratio"],
        },
        "debt_to_equity": {
            "raw_value": {"total_debt": total_debt, "equity": equity},
            "formula": "total_debt / equity",
            "final_metric": metrics["debt_to_equity"],
        },
        "debt_ratio": {
            "raw_value": {"total_liabilities": total_liabilities, "total_assets": total_assets},
            "formula": "total_liabilities / total_assets",
            "final_metric": metrics["debt_ratio"],
        },
        "asset_turnover": {
            "raw_value": {"revenue": revenue, "total_assets": total_assets},
            "formula": "revenue / total_assets",
            "final_metric": metrics["asset_turnover"],
        },
        "revenue_growth_yoy": {
            "raw_value": {"current_revenue": revenue, "previous_revenue": previous.get("revenue")},
            "formula": "(current_revenue - previous_revenue) / abs(previous_revenue)",
            "final_metric": metrics["revenue_growth_yoy"],
        },
        "net_profit_growth_yoy": {
            "raw_value": {"current_net_profit": net_profit, "previous_net_profit": previous.get("net_profit")},
            "formula": "(current_net_profit - previous_net_profit) / abs(previous_net_profit)",
            "final_metric": metrics["net_profit_growth_yoy"],
        },
        "eps": {
            "raw_value": {"net_profit": net_profit, "shares_outstanding": shares_outstanding},
            "formula": "net_profit / shares_outstanding",
            "final_metric": metrics["eps"],
        },
        "book_value_per_share": {
            "raw_value": {"equity": equity, "shares_outstanding": shares_outstanding},
            "formula": "equity / shares_outstanding",
            "final_metric": metrics["book_value_per_share"],
        },
    }
    return metrics, trace


def _compute_payload(yearly_inputs: dict[str, dict[str, Any]]) -> dict[str, Any]:
    years = sorted([y for y in yearly_inputs.keys() if isinstance(y, str) and y.isdigit()], key=lambda y: int(y))
    by_year_metrics: dict[str, dict[str, Any]] = {}
    by_year_trace: dict[str, dict[str, Any]] = {}
    by_year_trends: dict[str, dict[str, Any]] = {}

    previous_row: dict[str, Any] = {}
    for year in years:
        current_row = yearly_inputs.get(year, {})
        metrics, trace = _compute_year_metrics(current_row, previous_row)
        by_year_metrics[year] = metrics
        by_year_trace[year] = trace
        by_year_trends[year] = {
            "revenue_growth_yoy": metrics.get("revenue_growth_yoy"),
            "net_profit_growth_yoy": metrics.get("net_profit_growth_yoy"),
        }
        previous_row = current_row

    latest_year = years[-1] if years else ""
    latest_metrics = by_year_metrics.get(latest_year, {})

    risk_flags: list[str] = []
    if isinstance(latest_metrics.get("current_ratio"), (int, float)) and float(latest_metrics["current_ratio"]) < 1.0:
        risk_flags.append("current_ratio_below_1")
    if isinstance(latest_metrics.get("debt_to_equity"), (int, float)) and float(latest_metrics["debt_to_equity"]) > 2.0:
        risk_flags.append("debt_to_equity_above_2")
    if isinstance(latest_metrics.get("net_profit_growth_yoy"), (int, float)) and float(latest_metrics["net_profit_growth_yoy"]) < 0.0:
        risk_flags.append("negative_net_profit_growth")
    if isinstance(latest_metrics.get("operating_cash_flow"), (int, float)) and float(latest_metrics["operating_cash_flow"]) < 0.0:
        risk_flags.append("negative_operating_cash_flow")

    profitability_score = _avg(
        [
            _score_positive(latest_metrics.get("gross_margin"), 0.0, 0.45),
            _score_positive(latest_metrics.get("operating_margin"), 0.0, 0.25),
            _score_positive(latest_metrics.get("net_margin"), 0.0, 0.20),
            _score_positive(latest_metrics.get("return_on_assets"), 0.0, 0.12),
            _score_positive(latest_metrics.get("return_on_equity"), 0.0, 0.18),
        ]
    )
    liquidity_score = _avg(
        [
            _score_positive(latest_metrics.get("current_ratio"), 1.0, 2.0),
            _score_positive(latest_metrics.get("quick_ratio"), 0.7, 1.5),
        ]
    )
    leverage_score = _avg(
        [
            _score_inverse(latest_metrics.get("debt_to_equity"), 1.0, 3.0),
            _score_inverse(latest_metrics.get("debt_ratio"), 0.4, 0.9),
        ]
    )
    efficiency_score = _score_positive(latest_metrics.get("asset_turnover"), 0.2, 1.2)
    growth_score = _avg(
        [
            _score_positive(latest_metrics.get("revenue_growth_yoy"), -0.05, 0.2),
            _score_positive(latest_metrics.get("net_profit_growth_yoy"), -0.05, 0.2),
        ]
    )

    overall = (
        profitability_score * 0.30
        + liquidity_score * 0.25
        + leverage_score * 0.20
        + efficiency_score * 0.10
        + growth_score * 0.15
    )

    required_latest_fields = [
        "gross_margin",
        "operating_margin",
        "net_margin",
        "return_on_assets",
        "return_on_equity",
        "current_ratio",
        "quick_ratio",
        "debt_to_equity",
        "debt_ratio",
        "asset_turnover",
        "revenue_growth_yoy",
        "net_profit_growth_yoy",
        "eps",
        "book_value_per_share",
    ]
    available = len([k for k in required_latest_fields if isinstance(latest_metrics.get(k), (int, float))])
    data_quality_score = (float(available) / float(len(required_latest_fields))) * 100.0 if required_latest_fields else 0.0

    return {
        "metrics": {
            "latest_year": latest_year,
            "by_year": by_year_metrics,
        },
        "trends": {
            "by_year": by_year_trends,
            "latest": by_year_trends.get(latest_year, {}),
        },
        "risk_flags": risk_flags,
        "financial_health_scores": {
            "profitability_score": round(profitability_score, 4),
            "liquidity_score": round(liquidity_score, 4),
            "leverage_score": round(leverage_score, 4),
            "efficiency_score": round(efficiency_score, 4),
            "growth_score": round(growth_score, 4),
            "overall_health_score": round(overall, 4),
        },
        "data_quality_score": round(data_quality_score, 4),
        "calculation_trace": {
            "by_year": by_year_trace,
        },
    }


def compute_analysis_result(dataset_id: str, yearly_inputs: dict[str, dict[str, Any]]) -> AnalysisResultModel:
    first = _compute_payload(yearly_inputs)
    second = _compute_payload(yearly_inputs)

    first_flat = _flatten_numbers(first)
    second_flat = _flatten_numbers(second)
    drift_failures: list[str] = []
    for path, left in first_flat.items():
        right = second_flat.get(path)
        if not isinstance(right, (int, float)):
            continue
        if abs(float(left) - float(right)) > DRIFT_TOLERANCE:
            drift_failures.append(path)

    if drift_failures:
        raise ValueError(f"determinism_drift_detected:{','.join(drift_failures[:10])}")

    envelope = build_envelope(
        dataset_id=dataset_id,
        schema_version=ANALYSIS_RESULT_SCHEMA_VERSION,
        calculation_version=ANALYSIS_CALCULATION_VERSION,
    )

    return AnalysisResultModel(
        envelope=envelope,
        metrics=first["metrics"],
        trends=first["trends"],
        risk_flags=first["risk_flags"],
        financial_health_scores=first["financial_health_scores"],
        data_quality_score=first["data_quality_score"],
        calculation_trace=first["calculation_trace"],
    )
