from services.processor import ProcessingService


class Worker:
    def __init__(self, service: ProcessingService) -> None:
        self.service = service

    def run(self, report_id: str, file_path: str | None = None) -> dict:
        return self.service.process(report_id, file_path)
