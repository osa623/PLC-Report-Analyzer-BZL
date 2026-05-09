from services.observability_service import ObservabilityService

class ExtractionService:
    def __init__(self):
        self.observability = ObservabilityService()
        self.observability.trace_context()
        self.observability.capture(
            report_id="1",
            statement_type="dummy",
            status="success"
        )
        self.observability_trace = None
        self.observability_metadata = None
