from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "notes_financial_statements"
DISPLAY_NAME = "Notes to Financial Statements"
PROMPT = build_section_prompt(
    section_title="Notes to Financial Statements",
    section_key=SECTION_KEY,
    hints="Also match headings like Notes, Accounting Policies, Note 1, Notes to Accounts."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
