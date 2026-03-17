from fastapi import APIRouter, Depends

from core.dependencies import get_kpi_service
from models.schemas import ProcessRequest, ProcessResponse
from services.kpi_service import SectorKPIService

router = APIRouter()


@router.post("/sector-kpis", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    kpi_service: SectorKPIService = Depends(get_kpi_service),
) -> ProcessResponse:
    status = kpi_service.process(request.report_id, request.sector)
    return ProcessResponse(report_id=request.report_id, status=status)
