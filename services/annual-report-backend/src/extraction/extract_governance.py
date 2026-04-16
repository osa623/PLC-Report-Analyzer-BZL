from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "corporate_governance"
DISPLAY_NAME = "Corporate Governance Report"
PROMPT = build_section_prompt(
    section_title="Corporate Governance Report",
    section_key=SECTION_KEY,
    hints="Also match headings like Governance Report, Board Governance, Governance Framework, Board Committees."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
