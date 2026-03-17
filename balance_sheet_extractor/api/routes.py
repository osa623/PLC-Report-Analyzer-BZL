from fastapi import APIRouter, Depends

from core.dependencies import get_extraction_service
from models.schemas import ProcessRequest, ProcessResponse
from services.extraction_service import ExtractionService

router = APIRouter()


@router.post("/extract-financials", response_model=ProcessResponse)
def extract_financials(
    request: ProcessRequest,
    extraction_service: ExtractionService = Depends(get_extraction_service),
) -> ProcessResponse:
    status = extraction_service.process(request.report_id, request.file_path)
    return ProcessResponse(report_id=request.report_id, status=status)
