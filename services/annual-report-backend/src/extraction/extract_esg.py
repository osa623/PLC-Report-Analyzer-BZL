from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "esg_report"
DISPLAY_NAME = "Sustainability / ESG Report"
PROMPT = build_section_prompt(
    section_title="Sustainability / ESG Report",
    section_key=SECTION_KEY,
    hints="Also match headings like Sustainability Report, ESG, Environmental Social Governance, Climate, CSR."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
