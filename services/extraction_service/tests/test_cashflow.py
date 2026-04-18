from services.extraction_service.extractors.cashflow import extract


def test_cashflow_extract_from_normalized():
    normalized = {
        "cash_flow": {
            "2024": {
                "Opening Cash": "1,000",
                "Net Cash Flow": "(200)",
                "Closing Cash": None,
                "Net Income": "500",
            },
            "2023": {
                "Opening Cash": "800",
                "Net Cash Flow": "200",
                "Closing Cash": "1,000",
                "Net Income": "400",
            },
        }
    }

    res = extract(normalized)
    labels = {r["label"]: r for r in res}

    assert "Opening Cash" in labels
    assert labels["Opening Cash"]["value"] == 1000.0
    assert "Net Cash Flow" in labels
    assert labels["Net Cash Flow"]["value"] == -200.0
    assert "Closing Cash" in labels
    # Closing Cash should be computed as opening + net = 800.0
    assert (
        labels["Closing Cash"]["value"] == 800.0 + (-200.0)
        or labels["Closing Cash"]["value"] == 800.0
    )
    assert "Net Income" in labels
    assert labels["Net Income"]["value"] == 500.0
