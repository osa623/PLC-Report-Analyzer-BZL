from services.processor import ProcessingService


class Worker:
    def __init__(self, service: ProcessingService) -> None:
        self.service = service

    def run(self, report_id: str, sector: str) -> dict:
        return self.service.process(report_id, sector)
