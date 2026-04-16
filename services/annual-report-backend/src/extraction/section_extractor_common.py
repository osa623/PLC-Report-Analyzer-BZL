"""
Common helpers for narrative/table annual-report section extraction.
"""

from textwrap import dedent


def build_section_prompt(section_title: str, section_key: str, hints: str = "") -> str:
    hint_block = f"Additional detection hints:\n{hints}\n" if hints else ""

    return dedent(
        f"""
        You are a financial document parsing engine.
        Detect and extract ONLY the section: "{section_title}".

        Strict extraction workflow:
        1) Detect the section start heading using heading matching and fuzzy variants.
        2) Detect section end using the next major heading/chapter boundary.
        3) Within boundaries, extract:
           - tables
           - paragraphs
           - subsections (nested headings)

        {hint_block}
        Return only valid JSON with this exact schema:
        {{
          "section": "{section_key}",
          "title": "Detected title",
          "page_numbers": [1, 2],
          "subsections": [
            {{
              "title": "Subsection title",
              "type": "table",
              "headers": ["col1", "col2"],
              "rows": [
                {{"label": "row label", "values": ["v1", "v2"]}}
              ],
              "paragraphs": []
            }},
            {{
              "title": "Subsection title",
              "type": "text",
              "headers": [],
              "rows": [],
              "paragraphs": ["Paragraph 1", "Paragraph 2"]
            }}
          ],
          "summary": "Short summary of the extracted section"
        }}

        Rules:
        - Preserve row labels, column headers, and numeric values for tables.
        - Preserve paragraph boundaries for text.
        - Use empty arrays when a field does not apply.
        - If section is not found, return exactly: null
        - Do not return markdown or commentary.
        """
    ).strip()
