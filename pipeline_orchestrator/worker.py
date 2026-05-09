import asyncio
import json
import logging
import os
from typing import Dict, Any

from platform_core.job_framework import RedisQueue, BaseWorker

logger = logging.getLogger("pipeline_orchestrator.worker")


class ExtractionWorker(BaseWorker):
    async def handle(self, job: Dict[str, Any]):
        job_id = job.get("job_id")
        pdf_folder_path = job.get("pdf_folder_path")
        pdf_path = job.get("pdf_path")
        if pdf_folder_path:
            try:
                from .full_pipeline import run_full_pipeline
                from . import storage

                await storage.set_job_status(job_id, "RUNNING", {"pdf_folder_path": pdf_folder_path})
                result = run_full_pipeline(pdf_folder_path, job.get("report_id") or job_id)
                await storage.set_job_status(job_id, "COMPLETED", {"output": result})
                logger.info("Job %s completed via full pipeline", job_id)
                return
            except Exception:
                try:
                    from . import storage

                    await storage.set_job_status(job_id, "FAILED")
                except Exception:
                    pass
                logger.exception("Job %s failed during full pipeline", job_id)
                return

        if not pdf_path or not os.path.exists(pdf_path):
            logger.error("Job %s: missing pdf_path %s", job_id, pdf_path)
            return

        try:
            from services.extraction_service.src.pipeline.pdf_image_orchestrator import process_annual_reports
            from . import storage

            await storage.set_job_status(job_id, "RUNNING")

            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()

            out_json = pdf_path.replace('.pdf', '.json')
            result = process_annual_reports([pdf_bytes])
            with open(out_json, "w", encoding="utf-8") as fo:
                json.dump(result, fo, indent=2)

            await storage.set_job_status(job_id, "COMPLETED", {"output_path": out_json})
            logger.info("Job %s completed, output=%s", job_id, out_json)
        except Exception:
            try:
                from . import storage

                await storage.set_job_status(job_id, "FAILED")
            except Exception:
                pass
            logger.exception("Job %s failed during extraction", job_id)


async def run_worker():
    q = RedisQueue("pipeline:jobs", url=os.environ.get("REDIS_URL", "redis://localhost:6379/0"))
    w = ExtractionWorker(q)
    await w.run()


if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker())
