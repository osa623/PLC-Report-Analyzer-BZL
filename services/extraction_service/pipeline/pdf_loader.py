from __future__ import annotations

from pypdf import PdfReader


def load_pdf_pages(file_path: str) -> list[str]:
    reader = PdfReader(file_path)
    pages: list[str] = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return pages
