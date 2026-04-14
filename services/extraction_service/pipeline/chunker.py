from __future__ import annotations


def chunk_pages(pages: list[str], chunk_size: int = 2) -> list[dict]:
    chunks: list[dict] = []
    for i in range(0, len(pages), chunk_size):
        chunk_text = "\n".join(pages[i : i + chunk_size])
        chunks.append({"chunk_id": f"chunk-{i//chunk_size+1}", "text": chunk_text})
    return chunks
