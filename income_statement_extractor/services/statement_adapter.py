class FinancialStatementAdapter:
    def normalize(self, raw_statement: dict) -> dict:
        return {
            "periods": raw_statement.get("periods", []),
            "line_items": raw_statement.get("line_items", []),
        }
