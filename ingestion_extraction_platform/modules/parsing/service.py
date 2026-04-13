from __future__ import annotations

import math
from pathlib import Path
from typing import Any

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover
    PdfReader = None


def _chunk_text(text: str, chunk_size: int = 1800) -> list[str]:
    if not text:
        return []
    total = int(math.ceil(len(text) / chunk_size))
    return [text[i * chunk_size : (i + 1) * chunk_size] for i in range(total)]


def parse_document(file_path: str) -> list[dict[str, Any]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"file_not_found:{file_path}")

    chunks: list[dict[str, Any]] = []

    if path.suffix.lower() == ".pdf" and PdfReader is not None:
        reader = PdfReader(str(path))
        for page_idx, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            for offset, chunk in enumerate(_chunk_text(text)):
                chunk_id = f"p{page_idx}_c{offset + 1}"
                chunks.append(
                    {
                        "chunk_id": chunk_id,
                        "text": chunk,
                        "page_number": page_idx,
                        "token_count": max(1, len(chunk) // 4),
                        "bbox": None,
                    }
                )
    else:
        raw = path.read_text(encoding="utf-8", errors="ignore")
        for offset, chunk in enumerate(_chunk_text(raw)):
            chunk_id = f"p1_c{offset + 1}"
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk,
                    "page_number": 1,
                    "token_count": max(1, len(chunk) // 4),
                    "bbox": None,
                }
            )

    return chunks
