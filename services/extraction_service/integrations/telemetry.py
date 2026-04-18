import logging
from prometheus_client import Counter, Histogram

logger = logging.getLogger(__name__)

# Counts
DOCAI_CALLS = Counter("extraction_docai_calls_total", "Total Document AI calls")
DOCAI_ERRORS = Counter("extraction_docai_errors_total", "Document AI errors total")
TEXTRACT_CALLS = Counter("extraction_textract_calls_total", "Total Textract calls")
TEXTRACT_ERRORS = Counter("extraction_textract_errors_total", "Textract errors total")
GEMINI_CALLS = Counter("extraction_gemini_calls_total", "Total Gemini calls")
GEMINI_ERRORS = Counter("extraction_gemini_errors_total", "Gemini errors total")

# Latency histograms (seconds)
DOCAI_LATENCY = Histogram(
    "extraction_docai_latency_seconds", "Document AI call latency seconds"
)
TEXTRACT_LATENCY = Histogram(
    "extraction_textract_latency_seconds", "Textract call latency seconds"
)
GEMINI_LATENCY = Histogram(
    "extraction_gemini_latency_seconds", "Gemini call latency seconds"
)

# Pipeline
PIPELINE_DURATION = Histogram(
    "extraction_pipeline_duration_seconds",
    "End-to-end extraction pipeline duration seconds",
)
CACHE_HITS = Counter("extraction_cache_hits_total", "Extraction cache hits total")
CACHE_MISSES = Counter("extraction_cache_misses_total", "Extraction cache misses total")


def configure_logging():
    # Basic JSON logging configuration can be expanded in production
    try:
        from pythonjsonlogger import jsonlogger

        handler = logging.StreamHandler()
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s"
        )
        handler.setFormatter(formatter)
        root = logging.getLogger()
        if not root.handlers:
            root.addHandler(handler)
        root.setLevel(logging.INFO)
    except Exception:
        logger.info("python-json-logger not available; using default logging")


def start_metrics_server(port: int = 8000):
    try:
        from prometheus_client import start_http_server

        start_http_server(port)
        logger.info("Prometheus metrics server started on port %s", port)
    except Exception:
        logger.exception("Failed to start Prometheus metrics server")
