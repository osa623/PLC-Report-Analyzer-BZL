from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "company_overview"
DISPLAY_NAME = "About the Company"
PROMPT = build_section_prompt(
    section_title="About the Company",
    section_key=SECTION_KEY,
    hints="Also match headings like About Us, Company Profile, Corporate Profile, Business Overview."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
