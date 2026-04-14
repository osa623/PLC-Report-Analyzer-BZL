from __future__ import annotations

from extractors import balance_sheet, cashflow, equity, esg, governance, income_statement, notes, risk, segment


def run_parallel_extraction(chunks: list[dict], structure: dict, config) -> dict:
    # Deterministic extraction execution order for reproducible output.
    financial_statements = {
        "income_statement": income_statement.extract(chunks),
        "balance_sheet": balance_sheet.extract(chunks),
        "cashflow": cashflow.extract(chunks),
        "equity": equity.extract(chunks),
    }
    narrative_sections = {
        "notes": notes.extract(chunks),
        "risk": risk.extract(chunks),
        "governance": governance.extract(chunks),
        "esg": esg.extract(chunks),
        "segment": segment.extract(chunks),
    }
    return {
        "financial_statements": financial_statements,
        "narrative_sections": narrative_sections,
        "structure": structure,
    }
