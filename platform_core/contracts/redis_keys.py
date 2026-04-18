from __future__ import annotations


class RedisKeys:
    """Canonical Redis key helpers for pipeline datasets and outputs."""

    @staticmethod
    def document_chunks(report_id: str) -> str:
        return f"report:{report_id}:document_chunks"

    @staticmethod
    def structure(report_id: str) -> str:
        return f"report:{report_id}:structure"

    @staticmethod
    def extracted(report_id: str) -> str:
        return f"report:{report_id}"

    @staticmethod
    def governance(report_id: str) -> str:
        return f"report:{report_id}:governance"

    @staticmethod
    def risk(report_id: str) -> str:
        return f"report:{report_id}:risk"

    @staticmethod
    def esg(report_id: str) -> str:
        return f"report:{report_id}:esg"

    @staticmethod
    def strategy(report_id: str) -> str:
        return f"report:{report_id}:strategy"

    @staticmethod
    def canonical_raw(report_id: str) -> str:
        return f"report:{report_id}:canonical_raw"

    @staticmethod
    def canonical_validated(report_id: str) -> str:
        return f"report:{report_id}:canonical_validated"

    @staticmethod
    def ratios(report_id: str) -> str:
        return f"report:{report_id}:ratios"

    @staticmethod
    def sector_kpis(report_id: str) -> str:
        return f"report:{report_id}:sector_kpis"

    @staticmethod
    def patterns(report_id: str) -> str:
        return f"report:{report_id}:patterns"

    @staticmethod
    def final_report(report_id: str) -> str:
        return f"report:{report_id}:final_report"

    @staticmethod
    def batch_comparative(batch_id: str) -> str:
        return f"report:batch:{batch_id}:comparative"

    @staticmethod
    def batch_eligibility(batch_id: str) -> str:
        return f"report:batch:{batch_id}:eligibility"
