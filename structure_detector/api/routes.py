from fastapi import APIRouter, Depends

from core.dependencies import get_processor_service
from models.schemas import ProcessRequest, ProcessResponse

router = APIRouter()


@router.post("/detect-structure", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    processor_service = Depends(get_processor_service),
) -> ProcessResponse:
    details = processor_service.process(request.report_id, request.file_path)
    status = str(details.get("status", "SUCCESS")) if isinstance(details, dict) else "failed"
    return ProcessResponse(
        report_id=request.report_id,
        service="structure_detector",
        status=status,
        details=details,
    )
