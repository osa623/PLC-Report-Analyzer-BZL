from fastapi import APIRouter, Depends

from core.dependencies import get_parsing_service
from models.schemas import ProcessRequest, ProcessResponse

router = APIRouter()


@router.post("/parse-document", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    parsing_service = Depends(get_parsing_service),
) -> ProcessResponse:
    details = processor_service.process(request.report_id, request.file_path)
    status = str(details.get("status", "SUCCESS")) if isinstance(details, dict) else "failed"
    return ProcessResponse(
        report_id=request.report_id,
        service="document_parser",
        status=status,
        details=details,
    )
