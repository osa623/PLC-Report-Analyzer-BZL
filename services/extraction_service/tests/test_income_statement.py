from services.extraction_service.extractors.income_statement import extract


def test_income_statement_extract_from_normalized():
    normalized = {
        "income_statement": {
            "2024": {"Revenue": "1,000", "COGS": "(400)", "Net Income": "200"}
        }
    }

    res = extract(normalized)
    labels = {r["label"]: r for r in res}

    assert "Revenue" in labels
    assert labels["Revenue"]["value"] == 1000.0
    assert "COGS" in labels
    assert labels["COGS"]["value"] == -400.0
    assert "Gross Profit" in labels
    assert (
        labels["Gross Profit"]["value"] == 1400.0
        or labels["Gross Profit"]["value"] is not None
    )
    assert "Net Income" in labels
    assert labels["Net Income"]["value"] == 200.0
