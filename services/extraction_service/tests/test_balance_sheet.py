from services.extraction_service.extractors.balance_sheet import extract


def test_balance_sheet_extract_from_normalized():
    normalized = {
        "balance_sheet": {
            "2024": {
                "Total Assets": "2,000",
                "Total Liabilities": "1,200",
                "Total Equity": None,
            }
        }
    }

    res = extract(normalized)
    labels = {r["label"]: r for r in res}

    assert "Total Assets" in labels
    assert labels["Total Assets"]["value"] == 2000.0
    assert "Total Liabilities" in labels
    assert labels["Total Liabilities"]["value"] == 1200.0
    assert "Total Equity" in labels
    assert labels["Total Equity"]["value"] == 800.0
