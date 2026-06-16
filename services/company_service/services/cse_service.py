import requests

BASE_URL = "https://www.cse.lk/api"
HEADERS = {"User-Agent": "Mozilla/5.0"}


def search_company(query: str):
    """Search companies via tradeSummary endpoint, filter by name/symbol match."""
    try:
        res = requests.post(
            f"{BASE_URL}/tradeSummary",
            json={},
            headers=HEADERS,
            timeout=10
        )

        if res.status_code != 200 or not res.text.strip():
            return []

        companies = res.json().get("reqTradeSummery", [])
        q = query.lower()

        results = []
        for c in companies:
            name = c.get("name", "")
            symbol = c.get("symbol", "")

            if q in name.lower() or q in symbol.lower():
                results.append({
                    "name": name,
                    "symbol": symbol,
                    "sector": None
                })

        return results[:20]

    except Exception as e:
        print("CSE SEARCH ERROR:", e)
        return []


def fetch_company_profile(symbol: str):
    """Fetch company profile via companyProfile endpoint.
    Returns only: companyName, ticker, sector, logo."""
    try:
        res = requests.post(
            f"{BASE_URL}/companyProfile",
            data={"symbol": symbol},
            headers=HEADERS,
            timeout=10
        )

        if res.status_code != 200 or not res.text.strip():
            return None

        data = res.json()
        info = data.get("reqComSumInfo", [{}])[0]
        logo_data = data.get("reqLogo", {})

        logo_url = None
        if logo_data and logo_data.get("path"):
            logo_url = f"https://www.cse.lk/{logo_data['path']}"

        return {
            "companyName": info.get("name"),
            "ticker": info.get("symbol"),
            "sector": info.get("sector"),
            "logo": logo_url
        }

    except Exception as e:
        print("CSE PROFILE ERROR:", e)
        return None