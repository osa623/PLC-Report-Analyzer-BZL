from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from .mongo_client import get_mongo_db

COLLECTION = "companies"
ANALYSIS_COLLECTION = "analysis_results"
HISTORY_COLLECTION = "analysis_history"


def _slugify(name: str) -> str:
    """Convert company name to a URL-safe slug for use as _id."""
    if not name:
        return "unknown"
    slug = name.strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")
    return slug or "unknown"


def _deep_merge_no_overwrite(target: dict[str, Any], source: dict[str, Any]) -> None:
    """Recursively merges source dict into target dict without overwriting existing non-dict keys."""
    for key, value in source.items():
        if key not in target:
            target[key] = value
        elif isinstance(target[key], dict) and isinstance(value, dict):
            _deep_merge_no_overwrite(target[key], value)


def upsert_company_financials(company_name: str, sector: str | None, years_data: dict[str, Any]) -> str:
    """Insert or merge financial data for a company.
    
    If the company already exists, merge new years into existing financials
    WITHOUT overwriting existing year data (additive merge).
    
    Args:
        company_name: e.g. 'Dialog Axiata PLC'
        sector: e.g. 'Telecommunications' or 'General'
        years_data: dict keyed by year string, e.g.
            {'2024': {'income_statement': {...}, 'balance_sheet': {...}, 'cash_flow': {...}}}
    
    Returns: company_id (the slug)
    """
    db = get_mongo_db()
    company_id = _slugify(company_name)
    existing = db[COLLECTION].find_one({"_id": company_id})
    
    now = datetime.now(timezone.utc)
    target_sector = sector or "General"
    
    if not existing:
        doc = {
            "_id": company_id,
            "name": company_name,
            "sector": target_sector,
            "financials": years_data,
            "created_at": now,
            "updated_at": now,
        }
        db[COLLECTION].insert_one(doc)
    else:
        existing_financials = existing.get("financials") or {}
        _deep_merge_no_overwrite(existing_financials, years_data)
        
        db[COLLECTION].update_one(
            {"_id": company_id},
            {
                "$set": {
                    "financials": existing_financials,
                    "updated_at": now,
                    "sector": sector or existing.get("sector") or "General"
                }
            }
        )
    return company_id


def get_company(company_id: str) -> dict[str, Any] | None:
    """Fetch full company document by slug ID."""
    db = get_mongo_db()
    return db[COLLECTION].find_one({"_id": company_id})


def get_company_financials(company_id: str) -> dict[str, Any] | None:
    """Fetch only the financials dict for a company."""
    db = get_mongo_db()
    company = db[COLLECTION].find_one({"_id": company_id}, {"financials": 1})
    return company.get("financials") if company else None


def update_company_financials(company_id: str, financials: dict[str, Any]) -> bool:
    """Full replacement of financials (used after user edits in review screen)."""
    db = get_mongo_db()
    result = db[COLLECTION].update_one(
        {"_id": company_id},
        {
            "$set": {
                "financials": financials,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    return result.modified_count > 0 or result.matched_count > 0


def list_companies() -> list[dict[str, Any]]:
    """Return all companies (id, name, sector, updated_at) without financials."""
    db = get_mongo_db()
    cursor = db[COLLECTION].find({}, {"_id": 1, "name": 1, "sector": 1, "updated_at": 1})
    companies = []
    for doc in cursor:
        companies.append({
            "id": doc["_id"],
            "name": doc.get("name", ""),
            "sector": doc.get("sector", "General"),
            "updated_at": doc.get("updated_at")
        })
    return companies


def save_analysis_result(company_id: str, report_id: str, analysis_data: dict[str, Any]) -> str:
    """Save analysis results to analysis_results collection.
    Returns the inserted document ID."""
    db = get_mongo_db()
    doc = {
        "company_id": company_id,
        "report_id": report_id,
        "analyzed_at": datetime.now(timezone.utc),
        "ratios": analysis_data.get("yearly_ratios", {}),
        "patterns": analysis_data.get("growth_metrics", {}),
        "risk": analysis_data.get("validation_gates", {}),
        "scores": analysis_data.get("scores", {}),
        "evaluated_equations_by_year": analysis_data.get("evaluated_equations_by_year", {}),
        "sector_adjustments": analysis_data.get("sector_adjustments", {}),
        "version": "1.0"
    }
    result = db[ANALYSIS_COLLECTION].insert_one(doc)
    return str(result.inserted_id)


def get_latest_analysis(company_id: str) -> dict[str, Any] | None:
    """Get the most recent analysis result for a company."""
    db = get_mongo_db()
    cursor = db[ANALYSIS_COLLECTION].find({"company_id": company_id}).sort("analyzed_at", -1).limit(1)
    results = list(cursor)
    if results:
        res = dict(results[0])
        res["_id"] = str(res["_id"])
        return res
    return None


def save_analysis_history_entry(company_id: str, report_id: str, scores: dict[str, Any]) -> None:
    """Append a run entry to the analysis_history collection.
    Creates the history document if it doesn't exist."""
    db = get_mongo_db()
    run_entry = {
        "report_id": report_id,
        "timestamp": datetime.now(timezone.utc),
        "version": "v1.0",
        "scores": scores
    }
    db[HISTORY_COLLECTION].update_one(
        {"company_id": company_id},
        {
            "$push": {
                "runs": {
                    "$each": [run_entry],
                    "$position": 0  # Prepend to display newest runs first
                }
            }
        },
        upsert=True
    )


def get_analysis_history(company_id: str) -> dict[str, Any] | None:
    """Get the full analysis history for a company."""
    db = get_mongo_db()
    history = db[HISTORY_COLLECTION].find_one({"company_id": company_id})
    if history:
        history = dict(history)
        history["_id"] = str(history["_id"])
        return history
    return None
