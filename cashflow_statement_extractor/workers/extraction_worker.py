from services.extraction_service import ExtractionService


class ExtractionWorker:
    def __init__(self, service: ExtractionService) -> None:
        self.service = service

    def run(self, report_id: str, file_path: str) -> str:
        return self.service.process(report_id, file_path)
