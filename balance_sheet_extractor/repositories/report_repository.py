import json

from sqlalchemy import text
from sqlalchemy.orm import Session


class ReportRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def persist_result(self, report_id: str, payload: dict) -> None:
        query = text(
            """
            INSERT INTO balance_sheets (report_id, payload)
            VALUES (:report_id, CAST(:payload AS jsonb))
            """
        )
        self.db.execute(query, {"report_id": report_id, "payload": json.dumps(payload)})
        self.db.commit()
