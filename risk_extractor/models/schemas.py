from pydantic import BaseModel


class ProcessRequest(BaseModel):
    report_id: str
    file_path: str


class ProcessResponse(BaseModel):
    report_id: str
    service: str
    status: str
    details: dict
