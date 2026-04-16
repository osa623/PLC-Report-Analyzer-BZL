from src.extraction.section_extractor_common import build_section_prompt

SECTION_KEY = "subsidiaries"
DISPLAY_NAME = "Subsidiaries"
PROMPT = build_section_prompt(
    section_title="Subsidiaries",
    section_key=SECTION_KEY,
    hints="Also match headings like Subsidiary Companies, Group Structure, Controlled Entities, Investment in Subsidiaries."
)


def extract(extractor, uploaded_file):
    return extractor._extract_single_statement(uploaded_file, PROMPT, DISPLAY_NAME)
