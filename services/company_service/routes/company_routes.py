from fastapi import APIRouter, Query
from services.cse_service import search_company, fetch_company_profile

router = APIRouter()


# -------------------------
# SEARCH ENDPOINT
# -------------------------
@router.get("/search")
def search(q: str = Query(...)):
    return search_company(q)


# -------------------------
# PROFILE ENDPOINT
# -------------------------
@router.get("/company")
def company(q: str):
    return fetch_company_profile(q)