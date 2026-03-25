
SHARED_CURRENCY_SCALE_INSTRUCTION = """
CRITICAL DATA EXTRACTION RULES:

1. CURRENCY DETECTION:
   - You must detect the currency of the table.
   - Look for headers like "Rs 000", "Rs '000", "Rs. '000", "Rs Ths", "Rs Thousands", "Rs Mn", "Rs Mill", "LKR '000", "LKR Mn".
   - IGNORE tables where the header or footnote says "USD", "US$", "In US Dollars", or similar. If the table is in USD, return an empty `rows` list.
   - Output `detected_currency`: "LKR" (or "USD" if ignored).

2. SCALE NORMALIZATION:
   - The canonical unit for this system is "Rs 000" (Thousands of LKR).
   - "Rs Mn" or "Rs Million" -> multiply raw value by 1,000.
   - "Rs Bn" or "Rs Billion" -> multiply raw value by 1,000,000.
   - "Rs 000" or "Rs '000" -> multiply raw value by 1.
   - Output `scale_multiplier`: The number you multiply the column by to get Rs '000 (e.g., 1000 for Mn, 1 for '000).

3. VALUE PARSING:
   - For each extracted value, you must return:
     - `raw_value`: The exact string from the PDF (e.g., "1,234", "(450)").
     - `normalised_value`: The numeric value converted to Rs '000.
       - Example 1: Table in Rs Mn. Raw "50". Normalised = 50 * 1000 = 50000.
       - Example 2: Table in Rs '000. Raw "50". Normalised = 50 * 1 = 50.
       - Example 3: Negative "(50)" in Rs Mn. Normalised = -50 * 1000 = -50000.
"""

SHARED_JSON_SCHEMA_FIELDS = """
    "detected_currency": "string (LKR or USD)",
    "scale_multiplier": "number (e.g. 1.0, 1000.0, 1000000.0)",
"""

SHARED_ROW_SCHEMA_FIELDS = """
            "values": {
                "<Exact Column Header>": {
                    "raw_value": "string",
                    "normalised_value": "number"
                }
            },
"""
