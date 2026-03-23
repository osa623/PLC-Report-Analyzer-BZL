import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    def __init__(self, service_name: str) -> None:
        super().__init__()
        self.service_name = service_name

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "logger": record.name,
            "message": record.getMessage(),
        }

        if hasattr(record, "report_id"):
            payload["report_id"] = getattr(record, "report_id")
        if hasattr(record, "job_id"):
            payload["job_id"] = getattr(record, "job_id")
        if hasattr(record, "request_id"):
            payload["request_id"] = getattr(record, "request_id")
        if hasattr(record, "error_code"):
            payload["error_code"] = getattr(record, "error_code")

        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=True)


def configure_logging(service_name: str, log_level: str) -> None:
    root = logging.getLogger()
    root.handlers.clear()

    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(service_name=service_name))

    root.addHandler(handler)
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))
