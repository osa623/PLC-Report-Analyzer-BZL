import logging

try:
    from prometheus_client import Counter, Histogram
except Exception:
    Counter = None
    Histogram = None

logger = logging.getLogger(__name__)


class _NoopMetric:
    def inc(self, *args, **kwargs):
        return None

    def observe(self, *args, **kwargs):
        return None


def _counter(name: str, description: str):
    if Counter is None:
        return _NoopMetric()
    return Counter(name, description)


def _histogram(name: str, description: str):
    if Histogram is None:
        return _NoopMetric()
    return Histogram(name, description)

# Counts
DOCAI_CALLS = _counter("extraction_docai_calls_total", "Total Document AI calls")
DOCAI_ERRORS = _counter("extraction_docai_errors_total", "Document AI errors total")
TEXTRACT_CALLS = _counter("extraction_textract_calls_total", "Total Textract calls")
TEXTRACT_ERRORS = _counter("extraction_textract_errors_total", "Textract errors total")
GEMINI_CALLS = _counter("extraction_gemini_calls_total", "Total Gemini calls")
GEMINI_ERRORS = _counter("extraction_gemini_errors_total", "Gemini errors total")

# Latency histograms (seconds)
DOCAI_LATENCY = _histogram(
    "extraction_docai_latency_seconds", "Document AI call latency seconds"
)
TEXTRACT_LATENCY = _histogram(
    "extraction_textract_latency_seconds", "Textract call latency seconds"
)
GEMINI_LATENCY = _histogram(
    "extraction_gemini_latency_seconds", "Gemini call latency seconds"
)

# Pipeline
PIPELINE_DURATION = _histogram(
    "extraction_pipeline_duration_seconds",
    "End-to-end extraction pipeline duration seconds",
)
CACHE_HITS = _counter("extraction_cache_hits_total", "Extraction cache hits total")
CACHE_MISSES = _counter("extraction_cache_misses_total", "Extraction cache misses total")


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
