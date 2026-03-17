class ReportRepository:
    """Legacy compatibility placeholder. Ratio persistence is handled in RatioService."""

    def persist_result(self, report_id: str, payload: dict) -> None:
        _ = report_id
        _ = payload
