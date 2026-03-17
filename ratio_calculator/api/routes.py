from fastapi import APIRouter, Depends

from core.dependencies import get_ratio_service
from models.schemas import ProcessRequest, ProcessResponse
from services.ratio_service import RatioService

router = APIRouter()


@router.post("/calculate-ratios", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    ratio_service: RatioService = Depends(get_ratio_service),
) -> ProcessResponse:
    status = ratio_service.process(request.report_id)
    return ProcessResponse(report_id=request.report_id, status=status)
