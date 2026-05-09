from services.analysis_service.strict_pipeline import build_strict_analysis_result
from services.extraction_service.strict_pipeline import build_strict_extraction_dataset
from services.reporting_service.strict_pipeline import build_strict_report


def test_strict_extraction_keeps_most_complete_duplicate_year_and_converts_to_lkr_millions():
    payload = build_strict_extraction_dataset(
        [
            {
                "document_year": 2023,
                "strict_statements": {
                    "balance_sheet": {
                        "total_assets": 1_200_000_000,
                        "total_liabilities": 800_000_000,
                        "total_equity": 400_000_000,
                    },
                    "income_statement": {
                        "revenue_or_interest_income": 700_000_000,
                        "net_profit": 90_000_000,
                    },
                    "cashflow_statement": {
                        "operating_cash_flow": 120_000_000,
                    },
                },
            },
            {
                "document_year": 2023,
                "strict_statements": {
                    "balance_sheet": {
                        "total_assets": 1_200_000_000,
                        "total_liabilities": 800_000_000,
                        "total_equity": 400_000_000,
                        "current_assets": 300_000_000,
                        "current_liabilities": 200_000_000,
                        "cash_and_equivalents": 150_000_000,
                        "borrowings": 250_000_000,
                    },
                    "income_statement": {
                        "revenue_or_interest_income": 700_000_000,
                        "cost_of_revenue": 300_000_000,
                        "gross_profit": 400_000_000,
                        "operating_profit": 110_000_000,
                        "net_profit": 90_000_000,
                    },
                    "cashflow_statement": {
                        "operating_cash_flow": 120_000_000,
                        "investing_cash_flow": -50_000_000,
                        "financing_cash_flow": -20_000_000,
                        "net_cash_change": 50_000_000,
                        "opening_cash": 100_000_000,
                        "closing_cash": 150_000_000,
                    },
                },
            },
        ]
    )

    year_2023 = payload["years"]["2023"]
    assert payload["currency"] == "LKR_millions"
    assert year_2023["balance_sheet"]["total_assets"] == 1200.0
    assert year_2023["balance_sheet"]["cash_and_cash_equivalents"] == 150.0
    assert year_2023["income_statement"]["operating_profit"] == 110.0
    assert year_2023["cash_flow"]["closing_cash"] == 150.0
    assert year_2023["extraction_confidence"] == 100


def test_strict_extraction_prefers_group_and_falls_back_to_company_for_same_year():
    payload = build_strict_extraction_dataset(
        [
            {
                "pdf_name": "Example_Bank_2017.pdf",
                "statements": {
                    "income_statement": {
                        "currency": "Rs 000",
                        "sections": [
                            {
                                "name": "Main Section",
                                "rows": [
                                    {
                                        "label": "Gross income",
                                        "2017 (Bank)": "106,295,194",
                                        "2016 (Company)": "95,990,771",
                                        "2017 (Group)": "119.759.106",
                                    },
                                    {
                                        "label": "PROFIT FOR THE YEAR",
                                        "2017 (Company)": "16,466,790",
                                        "2016 (Group)": "15,664,962",
                                    },
                                ],
                            }
                        ],
                    }
                },
            }
        ]
    )

    year_2017 = payload["years"]["2017"]["income_statement"]
    year_2016 = payload["years"]["2016"]["income_statement"]

    assert year_2017["revenue_or_interest_income"] == 119759.0
    assert year_2017["net_profit"] == 16467.0
    assert year_2016["revenue_or_interest_income"] == 95991.0
    assert year_2016["net_profit"] == 15665.0


def test_strict_analysis_rejects_incomplete_and_inconsistent_years():
    extraction_dataset = {
        "company": "Example PLC",
        "currency": "LKR_millions",
        "years": {
            "2022": {
                "balance_sheet": {
                    "total_assets": 1000.0,
                    "total_liabilities": 600.0,
                    "total_equity": 400.0,
                    "current_assets": 300.0,
                    "current_liabilities": 200.0,
                    "cash_and_cash_equivalents": 90.0,
                    "total_debt": 150.0,
                },
                "income_statement": {
                    "revenue": 500.0,
                    "cost_of_sales": 250.0,
                    "gross_profit": 250.0,
                    "operating_profit": 90.0,
                    "net_profit": 70.0,
                },
                "cash_flow": {
                    "operating_cash_flow": 80.0,
                    "investing_cash_flow": -20.0,
                    "financing_cash_flow": -10.0,
                    "net_cash_flow": 50.0,
                    "opening_cash": 40.0,
                    "closing_cash": 90.0,
                },
                "extraction_confidence": 100,
            },
            "2023": {
                "balance_sheet": {
                    "total_assets": 1200.0,
                    "total_liabilities": 700.0,
                    "total_equity": 300.0,
                    "current_assets": 320.0,
                    "current_liabilities": 220.0,
                    "cash_and_cash_equivalents": 100.0,
                    "total_debt": 180.0,
                },
                "income_statement": {
                    "revenue": 550.0,
                    "cost_of_sales": 270.0,
                    "gross_profit": 280.0,
                    "operating_profit": 95.0,
                    "net_profit": 75.0,
                },
                "cash_flow": {
                    "operating_cash_flow": 85.0,
                    "investing_cash_flow": -25.0,
                    "financing_cash_flow": -10.0,
                    "net_cash_flow": 40.0,
                    "opening_cash": 90.0,
                    "closing_cash": 120.0,
                },
                "extraction_confidence": 100,
            },
            "2024": {
                "balance_sheet": {
                    "total_assets": 1400.0,
                    "total_liabilities": 800.0,
                    "total_equity": 600.0,
                    "current_assets": 350.0,
                    "current_liabilities": 250.0,
                    "cash_and_cash_equivalents": 130.0,
                    "total_debt": 200.0,
                },
                "income_statement": {
                    "revenue": None,
                    "cost_of_sales": 300.0,
                    "gross_profit": 320.0,
                    "operating_profit": 100.0,
                    "net_profit": 82.0,
                },
                "cash_flow": {
                    "operating_cash_flow": 95.0,
                    "investing_cash_flow": -30.0,
                    "financing_cash_flow": -5.0,
                    "net_cash_flow": 60.0,
                    "opening_cash": 120.0,
                    "closing_cash": 180.0,
                },
                "extraction_confidence": 94,
            },
        },
    }

    analysis = build_strict_analysis_result(extraction_dataset)

    assert analysis["valid_years"] == ["2022"]
    assert sorted(analysis["rejected_years"]) == ["2023", "2024"]
    assert any(flag["code"] == "BALANCE_SHEET_EQUATION_FAILED" and flag["year"] == "2023" for flag in analysis["validation_flags"])
    assert any(flag["code"] == "CASH_RECONCILIATION_FAILED" and flag["year"] == "2023" for flag in analysis["validation_flags"])
    assert any(flag["code"] == "MINIMUM_COMPLETENESS_FAILED" and flag["year"] == "2024" for flag in analysis["validation_flags"])
    assert analysis["financial_ratios"]["2022"]["Current Ratio"] == 1.5


def test_strict_report_returns_diagnostic_when_no_year_survives():
    extraction_dataset = {
        "company": "Example PLC",
        "currency": "LKR_millions",
        "years": {
            "2024": {
                "balance_sheet": {
                    "total_assets": 1400.0,
                    "total_liabilities": 800.0,
                    "total_equity": 600.0,
                    "current_assets": 350.0,
                    "current_liabilities": 250.0,
                    "cash_and_cash_equivalents": 130.0,
                    "total_debt": 200.0,
                },
                "income_statement": {
                    "revenue": None,
                    "cost_of_sales": 300.0,
                    "gross_profit": 320.0,
                    "operating_profit": 100.0,
                    "net_profit": 82.0,
                },
                "cash_flow": {
                    "operating_cash_flow": 95.0,
                    "investing_cash_flow": -30.0,
                    "financing_cash_flow": -5.0,
                    "net_cash_flow": 60.0,
                    "opening_cash": 120.0,
                    "closing_cash": 180.0,
                },
                "extraction_confidence": 94,
            },
        },
    }

    analysis = build_strict_analysis_result(extraction_dataset)
    report = build_strict_report(extraction_dataset, analysis)

    assert report["status"] == "VALIDATION_FAILED"
    assert "2024" in report["missing_fields_by_year"]
