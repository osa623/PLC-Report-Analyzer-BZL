from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "future_outlook"
DISPLAY_NAME = "Future Outlook"
PROMPT = build_section_prompt(
    section_title="Future Outlook",
    section_key=SECTION_KEY,
    hints="Also match headings like Outlook, Future Prospects, Forward Looking Statement, Strategic Outlook."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
