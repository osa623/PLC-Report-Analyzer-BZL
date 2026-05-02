"""Keywords for identifying sections in bank financial statements."""

# Keywords to identify Income Statement section
INCOME_STATEMENT_KEYWORDS = [
    "income statement",
    "statement of profit or loss",
    "statement of comprehensive income",
    "profit and loss",
    "p&l statement",
    "statement of income",
    "consolidated income statement",
    "statement of profit and loss and other comprehensive income"
]

# Keywords to identify Financial Position Statement
BALANCE_SHEET_KEYWORDS = [
    "statement of financial position",
    "financial position",
    "statement of assets and liabilities",
    "consolidated statement of financial position",
    "position statement"
]

# Keywords to identify Cash Flow Statement
CASH_FLOW_KEYWORDS = [
    "cash flow statement",
    "statement of cash flows",
    "cash flows",
    "consolidated statement of cash flows",
    "statement of cashflow"
]

# Keywords to identify Notes section
NOTES_KEYWORDS = [
    "notes to the financial statements",
    "notes to financial statements",
    "notes",
    "notes to accounts"
]

# Keywords for financial periods
PERIOD_KEYWORDS = [
    "for the year ended",
    "as at",
    "as of",
    "year ended",
    "period ended",
    "quarter ended",
    "six months ended",
    "nine months ended",
    "december",
    "march",
    "june",
    "september"
]

# Currency keywords
CURRENCY_KEYWORDS = [
    "rs",
    "lkr",
    "rupees",
    "sri lankan rupees",
    "thousands",
    "millions",
    "'000",
    "000",
    "million"
]

# Table indicators
TABLE_INDICATORS = [
    "note",
    "total",
    "subtotal",
    "assets",
    "liabilities",
    "equity",
    "revenue",
    "expenses"
]

# Bank-specific keywords
BANK_SPECIFIC_KEYWORDS = [
    "interest income",
    "interest expense",
    "net interest income",
    "loan portfolio",
    "deposits",
    "advances",
    "non-performing loans",
    "capital adequacy",
    "tier 1 capital",
    "tier 2 capital"
]
