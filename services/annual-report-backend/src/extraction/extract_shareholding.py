from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "shareholding"
DISPLAY_NAME = "Shareholding Information"
PROMPT = build_section_prompt(
    section_title="Shareholding Information",
    section_key=SECTION_KEY,
    hints="Also match headings like Shareholder Information, Shareholder Structure, Top Shareholders, Ownership Structure."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
