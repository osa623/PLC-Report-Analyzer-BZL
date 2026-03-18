from fastapi import APIRouter, Depends

from core.dependencies import get_parsing_service
from models.schemas import ProcessRequest, ProcessResponse

router = APIRouter()


@router.post("/parse-document", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    parsing_service = Depends(get_parsing_service),
) -> ProcessResponse:
    status = parsing_service.process(request.report_id, request.file_path)
    return ProcessResponse(
        report_id=request.report_id,
        status=status,
    )
