from fastapi import Depends
from sqlalchemy.orm import Session

from core.database import get_db
from repositories.report_repository import ReportRepository
from services.processor import ProcessingServiceFactory


def get_repository(db: Session = Depends(get_db)) -> ReportRepository:
    return ReportRepository(db)


def get_processor_service(
    repository: ReportRepository = Depends(get_repository),
):
    return ProcessingServiceFactory.create(repository)
