from fastapi import APIRouter, Depends

from core.dependencies import get_worker
from models.schemas import ProcessRequest, ProcessResponse
from workers.extraction_worker import ExtractionWorker

router = APIRouter()


@router.post("/extract-esg", response_model=ProcessResponse)
def extract_esg(
    request: ProcessRequest,
    worker: ExtractionWorker = Depends(get_worker),
) -> ProcessResponse:
    status = worker.run(request.report_id, request.file_path)
    return ProcessResponse(report_id=request.report_id, status=status)
