from fastapi import APIRouter, Depends

from core.dependencies import get_pattern_service
from models.schemas import ProcessRequest, ProcessResponse
from services.pattern_service import PatternService

router = APIRouter()


@router.post("/detect-patterns", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    pattern_service: PatternService = Depends(get_pattern_service),
) -> ProcessResponse:
    status = pattern_service.process(request.report_id)
    return ProcessResponse(report_id=request.report_id, status=status)
