from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ValidationIssue:
    layer: str
    code: str
    detail: str


@dataclass
class ValidationResult:
    passed: bool
    issues: list[ValidationIssue] = field(default_factory=list)
    corrected_payload: dict[str, Any] | None = None


class ValidationEngine:
    """Four-layer deterministic validation with optional auto-correction loop."""

    def __init__(self, tolerance_ratio: float = 0.005, max_correction_retries: int = 2) -> None:
        self.tolerance_ratio = tolerance_ratio
        self.max_correction_retries = max_correction_retries

    def validate(self, payload: dict[str, Any], auto_correct: bool = True) -> ValidationResult:
        current = payload
        issues: list[ValidationIssue] = []

        for _ in range(self.max_correction_retries + 1):
            issues = []
            issues.extend(self._schema_validation(current))
            issues.extend(self._arithmetic_validation(current))
            issues.extend(self._cross_statement_validation(current))
            issues.extend(self._multi_year_validation(current))

            if not issues:
                return ValidationResult(passed=True, corrected_payload=current)

            if not auto_correct:
                break

            current = self._auto_correct(current)

        return ValidationResult(passed=False, issues=issues, corrected_payload=current)

    def _schema_validation(self, payload: dict[str, Any]) -> list[ValidationIssue]:
        required_sections = ["income_statement", "balance_sheet", "cashflow"]
        issues: list[ValidationIssue] = []
        for section in required_sections:
            if section not in payload or not isinstance(payload[section], dict):
                issues.append(
                    ValidationIssue(
                        layer="schema",
                        code="missing_section",
                        detail=f"{section} missing or invalid",
                    )
                )
        return issues

    def _arithmetic_validation(self, payload: dict[str, Any]) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        income = payload.get("income_statement", {})
        balance = payload.get("balance_sheet", {})
        cashflow = payload.get("cashflow", {})

        for year, values in income.items():
            revenue = self._num(values.get("revenue"))
            cogs = self._num(values.get("cogs"))
            gross_profit = self._num(values.get("gross_profit"))
            if None not in (revenue, cogs, gross_profit):
                expected = revenue - cogs
                if not self._close(expected, gross_profit):
                    issues.append(
                        ValidationIssue(
                            layer="arithmetic",
                            code="income_gross_profit_mismatch",
                            detail=f"year {year}: expected {expected}, got {gross_profit}",
                        )
                    )

        for year, values in balance.items():
            assets = self._num(values.get("total_assets"))
            liabilities = self._num(values.get("total_liabilities"))
            equity = self._num(values.get("total_equity"))
            if None not in (assets, liabilities, equity):
                expected = liabilities + equity
                if not self._close(expected, assets):
                    issues.append(
                        ValidationIssue(
                            layer="arithmetic",
                            code="balance_equation_mismatch",
                            detail=f"year {year}: assets {assets} != liabilities+equity {expected}",
                        )
                    )

        for year, values in cashflow.items():
            operating = self._num(values.get("operating_cashflow"))
            investing = self._num(values.get("investing_cashflow"))
            financing = self._num(values.get("financing_cashflow"))
            net_change = self._num(values.get("net_cash_change"))
            if None not in (operating, investing, financing, net_change):
                expected = operating + investing + financing
                if not self._close(expected, net_change):
                    issues.append(
                        ValidationIssue(
                            layer="arithmetic",
                            code="cashflow_net_change_mismatch",
                            detail=f"year {year}: expected {expected}, got {net_change}",
                        )
                    )

        return issues

    def _cross_statement_validation(self, payload: dict[str, Any]) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        income = payload.get("income_statement", {})
        cashflow = payload.get("cashflow", {})

        years = set(income.keys()) & set(cashflow.keys())
        for year in years:
            income_ni = self._num(income.get(year, {}).get("net_profit"))
            cashflow_ni = self._num(cashflow.get(year, {}).get("net_income"))
            if None not in (income_ni, cashflow_ni) and not self._close(income_ni, cashflow_ni):
                issues.append(
                    ValidationIssue(
                        layer="cross_statement",
                        code="net_income_mismatch",
                        detail=f"year {year}: income net {income_ni} != cashflow net {cashflow_ni}",
                    )
                )

        return issues

    def _multi_year_validation(self, payload: dict[str, Any]) -> list[ValidationIssue]:
        issues: list[ValidationIssue] = []
        income = payload.get("income_statement", {})

        sorted_years = sorted(income.keys())
        for idx in range(1, len(sorted_years)):
            prev_year = sorted_years[idx - 1]
            year = sorted_years[idx]
            prev_revenue = self._num(income.get(prev_year, {}).get("revenue"))
            revenue = self._num(income.get(year, {}).get("revenue"))
            if None in (prev_revenue, revenue) or prev_revenue == 0:
                continue

            change_ratio = abs((revenue - prev_revenue) / prev_revenue)
            if change_ratio > 3.0:
                issues.append(
                    ValidationIssue(
                        layer="multi_year",
                        code="revenue_outlier",
                        detail=f"year {year}: revenue change ratio {change_ratio:.2f}",
                    )
                )

        return issues

    def _auto_correct(self, payload: dict[str, Any]) -> dict[str, Any]:
        corrected = {**payload}
        income = {k: dict(v) for k, v in payload.get("income_statement", {}).items()}

        for year, values in income.items():
            revenue = self._num(values.get("revenue"))
            cogs = self._num(values.get("cogs"))
            if None not in (revenue, cogs):
                values["gross_profit"] = revenue - cogs

            pbt = self._num(values.get("profit_before_tax"))
            tax = self._num(values.get("tax"))
            if None not in (pbt, tax):
                values["net_profit"] = pbt - tax

        corrected["income_statement"] = income
        return corrected

    def _num(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _close(self, expected: float, actual: float) -> bool:
        delta = abs(expected - actual)
        baseline = max(abs(expected), 1.0)
        return (delta / baseline) <= self.tolerance_ratio
