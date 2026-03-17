class ReportRepository:
    """Legacy compatibility placeholder. KPI persistence is handled in SectorKPIService."""

    def persist_result(self, report_id: str, payload: dict) -> None:
        _ = report_id
        _ = payload
