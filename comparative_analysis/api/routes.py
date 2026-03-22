from fastapi import APIRouter, Depends

from core.dependencies import get_comparative_service
from models.schemas import ComparativeRequest, ComparativeResponse, BatchResultRequest
from services.comparative_service import ComparativeService

router = APIRouter()


@router.post("/analyze-comparative", response_model=ComparativeResponse)
def analyze_comparative(
    request: ComparativeRequest,
    service: ComparativeService = Depends(get_comparative_service),
) -> ComparativeResponse:
    status = service.process(
        batch_id=request.batch_id,
        report_ids=request.report_ids,
        company_info={
            "symbol": request.company.symbol,
            "name": request.company.name,
            "sector": request.company.sector,
        },
    )
    return ComparativeResponse(batch_id=request.batch_id, status=status)


@router.post("/get-batch-result")
def get_batch_result(
    request: BatchResultRequest,
    service: ComparativeService = Depends(get_comparative_service),
) -> dict:
    result = service.get_result(request.batch_id)
    if result is None:
        return {"status": "not_found", "batch_id": request.batch_id}
    return result
