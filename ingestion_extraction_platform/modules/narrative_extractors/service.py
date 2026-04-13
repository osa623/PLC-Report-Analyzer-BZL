from __future__ import annotations

import re
from typing import Any

SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _extract_narrative(chunks: list[dict[str, Any]], keywords: list[str], label: str) -> dict[str, Any]:
    items: list[dict[str, Any]] = []

    for chunk in chunks:
        text = chunk.get("text", "")
        if not any(keyword in text.lower() for keyword in keywords):
            continue

        for sentence in SENTENCE_SPLIT.split(text):
            sentence = sentence.strip()
            if not sentence:
                continue
            if any(keyword in sentence.lower() for keyword in keywords):
                items.append(
                    {
                        "label": label,
                        "description": sentence[:1000],
                        "source_chunk_id": chunk.get("chunk_id"),
                        "page_number": chunk.get("page_number"),
                    }
                )

    return {"items": items, "count": len(items)}


def run_narrative_extractors(chunks: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        "governance": _extract_narrative(chunks, ["governance", "board", "director"], "governance"),
        "risk": _extract_narrative(chunks, ["risk", "uncertain", "exposure"], "risk"),
        "esg": _extract_narrative(chunks, ["sustainability", "esg", "environment", "social"], "esg"),
        "strategy": _extract_narrative(chunks, ["strategy", "strategic", "plan"], "strategy"),
    }
