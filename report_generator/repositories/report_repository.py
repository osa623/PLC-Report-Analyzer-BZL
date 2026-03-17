class ReportRepository:
    """Legacy compatibility placeholder. Final report persistence is handled in ReportService."""

    def persist_result(self, report_id: str, payload: dict) -> None:
        _ = report_id
        _ = payload
