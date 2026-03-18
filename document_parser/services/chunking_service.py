import re
import uuid
from collections import Counter

from models.schemas import ChunkMetadata, DocumentChunk, ParsedPage

_SECTION_PATTERNS: dict[str, re.Pattern[str]] = {
    "financial statements": re.compile(r"\bfinancial\s+statements?\b", flags=re.IGNORECASE),
    "notes": re.compile(r"\bnotes?\b", flags=re.IGNORECASE),
    "risk": re.compile(r"\brisk\b", flags=re.IGNORECASE),
    "governance": re.compile(r"\bgovernance\b", flags=re.IGNORECASE),
}

_NUMBER_PATTERN = re.compile(r"(?<!\w)(?:\(?\d[\d,]*(?:\.\d+)?\)?)(?!\w)")


class ChunkingService:
    def __init__(self, max_pages_per_chunk: int = 3) -> None:
        self.max_pages_per_chunk = max(1, min(3, max_pages_per_chunk))

    def detect_possible_section(self, text: str) -> str | None:
        for section, pattern in _SECTION_PATTERNS.items():
            if pattern.search(text):
                return section
        return None

    def table_score(self, text: str) -> float:
        lines = [line.rstrip() for line in text.splitlines() if line.strip()]
        if not lines:
            return 0.0

        numeric_chars = sum(1 for ch in text if ch.isdigit())
        text_chars = sum(1 for ch in text if not ch.isspace())
        numeric_density = (numeric_chars / text_chars) if text_chars else 0.0

        multi_number_lines = 0
        aligned_spacing_lines = 0
        for line in lines:
            number_count = len(_NUMBER_PATTERN.findall(line))
            if number_count >= 2:
                multi_number_lines += 1

            token_count = len(line.split())
            if token_count >= 4 and len(re.findall(r"\s{2,}", line)) >= 2:
                aligned_spacing_lines += 1

        multi_number_ratio = multi_number_lines / len(lines)
        aligned_ratio = aligned_spacing_lines / len(lines)

        score = (numeric_density * 0.5) + (multi_number_ratio * 0.35) + (aligned_ratio * 0.15)
        return max(0.0, min(1.0, score))

    @staticmethod
    def classify_chunk_type(score: float) -> str:
        if score >= 0.65:
            return "table"
        if score >= 0.35:
            return "mixed"
        return "text"

    @staticmethod
    def classify_text_density(text: str) -> str:
        lines = text.splitlines()
        non_empty_lines = [line for line in lines if line.strip()]
        if not non_empty_lines:
            return "low"

        non_space_chars = sum(len("".join(line.split())) for line in non_empty_lines)
        avg_chars_per_line = non_space_chars / max(1, len(non_empty_lines))

        if avg_chars_per_line < 20:
            return "low"
        if avg_chars_per_line < 55:
            return "medium"
        return "high"

    def build_page(self, page_number: int, page_text: str) -> ParsedPage:
        normalized = "\n".join(line.rstrip() for line in page_text.splitlines())
        cleaned = re.sub(r"[\t\f\v\r]+", " ", normalized)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

        line_count = len([line for line in cleaned.splitlines() if line.strip()])
        score = self.table_score(cleaned)

        return ParsedPage(
            page_number=page_number,
            content=cleaned,
            text_density=self.classify_text_density(cleaned),
            line_count=line_count,
            possible_section=self.detect_possible_section(cleaned),
            table_score=score,
        )

    def should_split(self, current_pages: list[ParsedPage], next_page: ParsedPage) -> bool:
        if not current_pages:
            return False

        if len(current_pages) >= self.max_pages_per_chunk:
            return True

        prev_page = current_pages[-1]

        if prev_page.possible_section != next_page.possible_section and next_page.possible_section is not None:
            return True

        prev_density = {"low": 0.2, "medium": 0.6, "high": 1.0}[prev_page.text_density]
        next_density = {"low": 0.2, "medium": 0.6, "high": 1.0}[next_page.text_density]
        density_jump = abs(prev_density - next_density)

        table_type_prev = self.classify_chunk_type(prev_page.table_score)
        table_type_next = self.classify_chunk_type(next_page.table_score)
        layout_change = table_type_prev != table_type_next

        return density_jump >= 0.4 or layout_change

    def build_chunks(self, pages: list[ParsedPage]) -> list[DocumentChunk]:
        if not pages:
            return []

        chunks: list[DocumentChunk] = []
        current: list[ParsedPage] = []

        def flush() -> None:
            if not current:
                return

            chunk_lines = []
            for page in current:
                if page.content:
                    chunk_lines.append(f"[Page {page.page_number}]\n{page.content}")
            combined_content = "\n\n".join(chunk_lines)

            line_count = sum(page.line_count for page in current)
            density_votes = Counter(page.text_density for page in current)
            density = density_votes.most_common(1)[0][0]

            section_votes = [page.possible_section for page in current if page.possible_section]
            possible_section = Counter(section_votes).most_common(1)[0][0] if section_votes else None

            avg_table_score = sum(page.table_score for page in current) / len(current)
            chunk_type = self.classify_chunk_type(avg_table_score)

            chunks.append(
                DocumentChunk(
                    chunk_id=str(uuid.uuid4()),
                    page_start=current[0].page_number,
                    page_end=current[-1].page_number,
                    content=combined_content,
                    chunk_type=chunk_type,
                    metadata=ChunkMetadata(
                        text_density=density,
                        line_count=line_count,
                        possible_section=possible_section,
                    ),
                )
            )

        for page in pages:
            if self.should_split(current, page):
                flush()
                current = []
            current.append(page)

        flush()
        return chunks
