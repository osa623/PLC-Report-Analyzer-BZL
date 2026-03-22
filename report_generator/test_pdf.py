import os
from pathlib import Path

from services.pdf_builder import PDFBuilder

def test_comparative():
    builder = PDFBuilder()
    
    mock_batch = {
        "batch_id": "test-batch-123",
        "company": {"name": "Test Company", "symbol": "TST", "sector": "Technology"},
        "years_analyzed": [2021, 2022, 2023],
        "financial_health": {
            "overall_score": 75,
            "profitability_score": 80,
            "liquidity_score": 60,
            "growth_score": 90,
            "efficiency_score": 70,
            "stability_score": 50
        },
        "investment_signals": [
            {"category": "Revenue", "signal": "Bullish", "strength": 0.8, "description": "High growth"}
        ],
        "metric_trends": [
            {
                "display_name": "Revenue",
                "values": [
                    {"year": 2021, "value": 100},
                    {"year": 2022, "value": 150},
                    {"year": 2023, "value": 200}
                ],
                "cagr": 0.41,
                "latest_yoy_change": 0.33
            }
        ],
        "growth_analysis": {
            "revenue_growth_rates": [
                {"year": 2022, "value": 0.5},
                {"year": 2023, "value": 0.33}
            ]
        },
        "cashflow_breakdown": [
            {"year": 2021, "operating": 50, "investing": -20, "financing": -10, "net": 20},
            {"year": 2022, "operating": 60, "investing": -30, "financing": 0, "net": 30},
        ],
        "dupont_analysis": [
            {"year": 2022, "net_margin": 0.1, "asset_turnover": 1.2, "equity_multiplier": 2.0, "roe": 0.24}
        ],
        "risk_heatmap": {
            "liquidity_risk": {2021: 0.1, 2022: 0.8, 2023: 0.2},
            "margin_compression": {2021: 0.5, 2022: 0.4, 2023: 0.1}
        }
    }
    
    out_dir = Path("output_test")
    out_dir.mkdir(exist_ok=True)
    out_path = str((out_dir / "comparative_test.pdf").resolve())
    
    builder.build_comparative_report(out_path, mock_batch)
    print(f"Generated comparative report at {out_path}")

if __name__ == "__main__":
    test_comparative()
