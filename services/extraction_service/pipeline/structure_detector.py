from __future__ import annotations


def detect_structure(chunks: list[dict]) -> dict:
    sections = {
        "income_statement": [],
        "balance_sheet": [],
        "cashflow": [],
        "equity": [],
        "notes": [],
        "risk": [],
        "governance": [],
        "esg": [],
        "segment": [],
    }
    for chunk in chunks:
        text = chunk["text"].lower()
        for key in sections:
            if key.replace("_", " ") in text:
                sections[key].append(chunk["chunk_id"])
    return {"sections": sections}
