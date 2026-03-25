from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from core.dependencies import get_extraction_service, get_job_service
from models.schemas import (
    AsyncJobSubmitRequest,
    AsyncJobSubmitResponse,
    ParentJobStatusResponse,
    ProcessRequest,
    ProcessResponse,
)
from services.extraction_service import ExtractionService
from services.job_service import JobService

router = APIRouter()


@router.post("/extract-financials", response_model=ProcessResponse)
def process_document(
    request: ProcessRequest,
    extraction_service: ExtractionService = Depends(get_extraction_service),
) -> ProcessResponse:
    status = extraction_service.process(request.report_id, request.file_path)
    return ProcessResponse(
        report_id=request.report_id,
        status=status,
    )


@router.post("/jobs/submit", response_model=AsyncJobSubmitResponse)
def submit_async_jobs(
    request: AsyncJobSubmitRequest,
    background_tasks: BackgroundTasks,
    extraction_service: ExtractionService = Depends(get_extraction_service),
    job_service: JobService = Depends(get_job_service),
) -> AsyncJobSubmitResponse:
    result = job_service.submit_job(request.report_ids)
    background_tasks.add_task(job_service.process_parent_job, result["parent_job_id"], extraction_service)
    return AsyncJobSubmitResponse(**result)


@router.get("/jobs/{parent_job_id}", response_model=ParentJobStatusResponse)
def get_parent_job_status(
    parent_job_id: str,
    job_service: JobService = Depends(get_job_service),
) -> ParentJobStatusResponse:
    payload = job_service.get_parent_with_children(parent_job_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="parent_job_not_found")
    return ParentJobStatusResponse(**payload)
