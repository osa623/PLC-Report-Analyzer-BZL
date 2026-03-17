from fastapi import APIRouter, Depends

from core.dependencies import get_report_service
from models.schemas import ProcessRequest, ProcessResponse
from services.report_service import ReportService

router = APIRouter()


@router.post("/generate-report", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    report_service: ReportService = Depends(get_report_service),
) -> ProcessResponse:
    status = report_service.process(request.report_id)
    return ProcessResponse(report_id=request.report_id, status=status)
