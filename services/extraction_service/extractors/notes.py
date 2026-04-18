from __future__ import annotations


def extract(chunks: list[dict]) -> list[str]:
    return [chunk["text"][:200] for chunk in chunks[:5]]
