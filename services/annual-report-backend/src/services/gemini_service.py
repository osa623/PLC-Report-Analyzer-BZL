"""
Gemini 2.0 Financial Data Extraction Service

Extracts structured financial data from PDFs using separate API calls
for each statement type (Income Statement, Balance Sheet, Cash Flow)
to avoid token-limit truncation on large annual reports.
"""

import os
import re
import json
import time
import logging
import importlib.util
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List

from src.extraction.extract_future_outlook import PROMPT as PROMPT_FUTURE_OUTLOOK
from src.extraction.extract_governance import PROMPT as PROMPT_GOVERNANCE
from src.extraction.extract_esg import PROMPT as PROMPT_ESG
from src.extraction.extract_shareholding import PROMPT as PROMPT_SHAREHOLDING
from src.extraction.extract_notes import PROMPT as PROMPT_NOTES
from src.extraction.extract_subsidiaries import PROMPT as PROMPT_SUBSIDIARIES
from src.extraction.extract_company_overview import PROMPT as PROMPT_COMPANY_OVERVIEW
from src.extraction.table_reconstruction import (
    extract_plain_text_blob,
    extract_table_from_pdf_layers,
    normalize_table,
    reconstruct_table_from_text_block,
)

logger = logging.getLogger(__name__)

# ── Gemini Configuration ──────────────────────────────────────────────
if importlib.util.find_spec("dotenv"):
    from dotenv import load_dotenv

    load_dotenv()

try:
    import google.generativeai as genai
except ModuleNotFoundError:
    genai = None

GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("LLM_MODEL", "gemini-2.5-flash")

if genai is None:
    logger.error("google-generativeai is not installed")
elif not GEMINI_API_KEY:
    logger.error("GOOGLE_API_KEY not found in environment variables!")
else:
    genai.configure(api_key=GEMINI_API_KEY)


# ── Per-statement prompts ─────────────────────────────────────────────

_COMMON_RULES = """
**Extraction rules (apply strictly):**
- Extract ALL row items (line items / account names) exactly as written in the PDF.
- Extract ALL column headers (years, periods) exactly as written.
- Extract ALL numerical values, preserving signs (negative numbers).
- Use `null` for cells that are empty or contain dashes.
- Numbers must be plain numbers (no commas, no currency symbols). Keep negative signs.
- Extract LKR / Sri Lankan Rupee statement values only. Ignore foreign-currency note tables.
- If the statement has BOTH Group/Consolidated AND Company/Separate columns, preserve Group/Consolidated columns first and label all headers clearly.
- Preserve the exact hierarchy of line items (sub-items, totals, sub-totals).
- For numbers in thousands or millions, note the unit in the `notes` field.
- Return ONLY valid JSON. No markdown, no explanations, no code fences.
- If the statement is NOT found in this PDF, return exactly: `null`
"""

PROMPT_INCOME_STATEMENT = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Income Statement** (also called "Statement of Profit or Loss", "Statement of Comprehensive Income", or similar).

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Item", "Group 2024", "Group 2023", "Company 2024", "Company 2023"],
  "rows": [
    {{"item": "Revenue", "values": [123456, 112233, 100000, 95000]}},
    {{"item": "Cost of Sales", "values": [-98000, -87000, -80000, -75000]}}
  ],
  "page_numbers": [10, 11],
  "notes": "Amounts in thousands of LKR"
}}

{_COMMON_RULES}
"""

PROMPT_BALANCE_SHEET = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Balance Sheet** (also called "Statement of Financial Position" or similar).

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Item", "Group 2024", "Group 2023", "Company 2024", "Company 2023"],
  "rows": [
    {{"item": "Total Assets", "values": [500000, 450000, 400000, 380000]}}
  ],
  "page_numbers": [12, 13],
  "notes": "Amounts in thousands of LKR"
}}

{_COMMON_RULES}
"""

PROMPT_CASH_FLOW = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Cash Flow Statement** (also called "Statement of Cash Flows" or similar).

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Item", "Group 2024", "Group 2023", "Company 2024", "Company 2023"],
  "rows": [
    {{"item": "Cash from Operations", "values": [80000, 75000, 70000, 65000]}}
  ],
  "page_numbers": [14],
  "notes": "Amounts in thousands of LKR"
}}

{_COMMON_RULES}
"""

PROMPT_COMPREHENSIVE_INCOME = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Statement of Profit or Loss and Other Comprehensive Income** (also called "Statement of Comprehensive Income", "Statement of Other Comprehensive Income", or any section showing Other Comprehensive Income items such as revaluation surplus, foreign currency translation differences, fair value changes on financial instruments, actuarial gains/losses, etc.).

Do NOT extract the basic Income Statement / Statement of Profit or Loss if it is separate. Extract the section that explicitly shows Other Comprehensive Income items and Total Comprehensive Income.

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Item", "Group 2024", "Group 2023", "Company 2024", "Company 2023"],
  "rows": [
    {{"item": "Profit for the year", "values": [50000, 45000, 40000, 38000]}},
    {{"item": "Other comprehensive income:", "values": [null, null, null, null]}},
    {{"item": "Revaluation surplus", "values": [2000, 1500, 1800, 1200]}},
    {{"item": "Total comprehensive income", "values": [52000, 46500, 41800, 39200]}}
  ],
  "page_numbers": [11],
  "notes": "Amounts in thousands of LKR"
}}

{_COMMON_RULES}
"""

PROMPT_CHANGES_IN_EQUITY = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Statement of Changes in Equity** (also called "Statement of Changes in Shareholders' Equity", "Statement of Changes in Shareholders' Funds", or similar).

This statement shows movements in equity components like Share Capital, Share Premium, Revaluation Reserve, Retained Earnings, Non-controlling Interest, Total Equity etc. over the reporting period.

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Item", "Share Capital", "Share Premium", "Revaluation Reserve", "Retained Earnings", "Total Equity"],
  "rows": [
    {{"item": "Balance at 1 January 2024", "values": [100000, 50000, 20000, 150000, 320000]}},
    {{"item": "Profit for the year", "values": [null, null, null, 50000, 50000]}},
    {{"item": "Dividends paid", "values": [null, null, null, -20000, -20000]}},
    {{"item": "Balance at 31 December 2024", "values": [100000, 50000, 20000, 180000, 350000]}}
  ],
  "page_numbers": [15, 16],
  "notes": "Amounts in thousands of LKR"
}}

{_COMMON_RULES}
"""

PROMPT_AUDITORS_REPORT = f"""You are a financial data extraction expert. Analyze the uploaded PDF and extract ONLY the **Independent Auditor's Report** (also called "Report of the Independent Auditors", "Auditor's Report", or similar).

This is primarily a text-based section. Extract each major section of the auditor's report as a structured entry.

Return a JSON object with this EXACT structure:
{{
  "title": "Exact title as appears in the PDF",
  "headers": ["Section", "Content"],
  "rows": [
    {{"item": "Addressee", "values": ["To the Shareholders of XYZ Company"]}},
    {{"item": "Opinion", "values": ["In our opinion, the financial statements give a true and fair view..."]}},
    {{"item": "Basis for Opinion", "values": ["We conducted our audit in accordance with..."]}},
    {{"item": "Key Audit Matters", "values": ["Revenue Recognition: We identified..."]}},
    {{"item": "Going Concern", "values": ["We have nothing to report..."]}},
    {{"item": "Responsibilities of Management", "values": ["Management is responsible for the preparation..."]}},
    {{"item": "Auditor's Responsibilities", "values": ["Our objectives are to obtain reasonable assurance..."]}},
    {{"item": "Report on Other Legal and Regulatory Requirements", "values": ["As required by..."]}},
    {{"item": "Signature / Firm", "values": ["[Audit firm name], Chartered Accountants, [Date]"]}}
  ],
  "page_numbers": [42, 43, 44],
  "notes": "Text content from auditor's report"
}}

**Special rules for Auditor's Report:**
- Extract the FULL text content of each section, not summaries.
- Preserve paragraph structure within each section's content.
- If a section is not present, omit that row.
- The "values" array should contain a single string element for each row.
- Return ONLY valid JSON. No markdown, no explanations, no code fences.
- If the auditor's report is NOT found in this PDF, return exactly: `null`
"""

# Statement extraction config: (key, prompt, display_name) — original 3 for backward compat
STATEMENT_CONFIGS = [
    ("income_statement", PROMPT_INCOME_STATEMENT, "Income Statement"),
    ("balance_sheet",    PROMPT_BALANCE_SHEET,    "Balance Sheet"),
    ("cash_flow",        PROMPT_CASH_FLOW,        "Cash Flow Statement"),
]

# All available statement types for per-statement extraction
ALL_STATEMENT_CONFIGS = {
    "income_statement":        (PROMPT_INCOME_STATEMENT, "Income Statement"),
    "balance_sheet":           (PROMPT_BALANCE_SHEET, "Statement of Financial Position"),
    "cash_flow":               (PROMPT_CASH_FLOW, "Cash Flow Statement"),
    "comprehensive_income":    (PROMPT_COMPREHENSIVE_INCOME, "Statement of Comprehensive Income"),
    "changes_in_equity":       (PROMPT_CHANGES_IN_EQUITY, "Statement of Changes in Equity"),
    "auditors_report":         (PROMPT_AUDITORS_REPORT, "Independent Auditor's Report"),
    "future_outlook":          (PROMPT_FUTURE_OUTLOOK, "Future Outlook"),
    "corporate_governance":    (PROMPT_GOVERNANCE, "Corporate Governance Report"),
    "esg_report":              (PROMPT_ESG, "Sustainability / ESG Report"),
    "shareholding":            (PROMPT_SHAREHOLDING, "Shareholding Information"),
    "notes_financial_statements": (PROMPT_NOTES, "Notes to Financial Statements"),
    "subsidiaries":            (PROMPT_SUBSIDIARIES, "Subsidiaries"),
    "company_overview":        (PROMPT_COMPANY_OVERVIEW, "About the Company"),
}

FULL_REPORT_SECTION_CONFIGS = {
    "income_statement": (PROMPT_INCOME_STATEMENT, "Income Statement"),
    "balance_sheet": (PROMPT_BALANCE_SHEET, "Statement of Financial Position"),
    "cash_flow": (PROMPT_CASH_FLOW, "Cash Flow Statement"),
    "comprehensive_income": (PROMPT_COMPREHENSIVE_INCOME, "Statement of Comprehensive Income"),
    "equity_changes": (PROMPT_CHANGES_IN_EQUITY, "Statement of Changes in Equity"),
    "auditor_report": (PROMPT_AUDITORS_REPORT, "Independent Auditor's Report"),
    "future_outlook": (PROMPT_FUTURE_OUTLOOK, "Future Outlook"),
    "corporate_governance": (PROMPT_GOVERNANCE, "Corporate Governance Report"),
    "esg_report": (PROMPT_ESG, "Sustainability / ESG Report"),
    "shareholding": (PROMPT_SHAREHOLDING, "Shareholding Information"),
    "notes_financial_statements": (PROMPT_NOTES, "Notes to Financial Statements"),
    "subsidiaries": (PROMPT_SUBSIDIARIES, "Subsidiaries"),
    "company_overview": (PROMPT_COMPANY_OVERVIEW, "About the Company"),
}

FINANCIAL_SECTION_KEYS = {
    "income_statement",
    "balance_sheet",
    "cash_flow",
    "comprehensive_income",
    "changes_in_equity",
    "equity_changes",
}

TEXT_SECTION_KEYS = {
    "future_outlook",
    "corporate_governance",
    "esg_report",
    "company_overview",
}

FINANCIAL_KEYWORDS = {
    "income_statement": ["income statement", "statement of profit", "profit or loss", "revenue"],
    "balance_sheet": ["statement of financial position", "balance sheet", "assets", "liabilities"],
    "cash_flow": ["cash flow", "operating activities", "investing activities", "financing activities"],
    "comprehensive_income": ["comprehensive income", "other comprehensive income", "total comprehensive"],
    "changes_in_equity": ["changes in equity", "share capital", "retained earnings", "total equity"],
    "equity_changes": ["changes in equity", "share capital", "retained earnings", "total equity"],
}


class GeminiFinancialExtractor:
    """Extracts structured financial data from PDFs using Gemini 2.0."""

    def __init__(self):
        if genai is None:
            raise RuntimeError("google-generativeai is not installed")
        if not GEMINI_API_KEY:
            raise ValueError("GOOGLE_API_KEY is not configured")
        self.model = genai.GenerativeModel(GEMINI_MODEL)
        self._file_cache = {}  # pdf_path -> (uploaded_file, timestamp)

    # ── Gemini file upload with caching ───────────────────────────────

    def _get_or_upload_file(self, pdf_path: Path):
        """Upload PDF to Gemini or reuse cached reference if still active."""
        cache_key = str(pdf_path)
        if cache_key in self._file_cache:
            ref, ts = self._file_cache[cache_key]
            age = time.time() - ts
            # Reuse if less than 45 min old — skip the slow get_file() check
            # for recently cached files (under 5 min), trust the cache
            if age < 2700:
                if age < 300:
                    logger.info(f"Reusing cached Gemini file (age {age:.0f}s): {ref.name}")
                    return ref
                # Older than 5 min — verify it's still active
                try:
                    info = genai.get_file(ref.name)
                    if info.state.name == "ACTIVE":
                        logger.info(f"Reusing cached Gemini file (verified): {ref.name}")
                        return ref
                except Exception:
                    pass
            # Stale or dead — remove
            self._file_cache.pop(cache_key, None)

        uploaded = genai.upload_file(
            str(pdf_path),
            mime_type="application/pdf",
            display_name=pdf_path.name,
        )
        logger.info(f"Uploaded to Gemini: {uploaded.name}")
        self._wait_for_file_active(uploaded)
        self._file_cache[cache_key] = (uploaded, time.time())
        return uploaded

    def cleanup_cached_file(self, pdf_path: str):
        """Remove a cached Gemini file reference and delete from Gemini."""
        cache_key = str(pdf_path)
        entry = self._file_cache.pop(cache_key, None)
        if entry:
            try:
                genai.delete_file(entry[0].name)
                logger.info(f"Deleted cached Gemini file: {entry[0].name}")
            except Exception:
                pass

    # ── Single-statement extraction ───────────────────────────────────

    def extract_single(self, pdf_path: str, statement_key: str, progress_callback=None) -> dict:
        """
        Extract a SINGLE financial statement type from a PDF.
        Uses cached Gemini upload if available.

        Args:
            pdf_path: Absolute path to the PDF file
            statement_key: Key from ALL_STATEMENT_CONFIGS
            progress_callback: Optional callable(step, total, message)

        Returns:
            Dict with the statement data, or None if not found.
        """
        config = ALL_STATEMENT_CONFIGS.get(statement_key)
        if not config:
            raise ValueError(f"Unknown statement type: '{statement_key}'. "
                             f"Valid keys: {list(ALL_STATEMENT_CONFIGS.keys())}")

        prompt, display_name = config
        pdf_path = Path(pdf_path)
        total_steps = 4  # validate, upload/cache, extract, done

        def emit(step, message):
            if progress_callback:
                try:
                    progress_callback(step, total_steps, message)
                except Exception:
                    pass

        # Step 1: Validate
        emit(1, "Validating PDF file...")
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError(f"Not a PDF file: {pdf_path.name}")

        # Step 2: Upload or reuse cached
        emit(2, "Preparing document for AI processing...")
        try:
            uploaded_file = self._get_or_upload_file(pdf_path)
        except Exception as e:
            raise RuntimeError(f"Failed to upload PDF to AI service: {e}") from e

        # Step 3: Extract the specific statement
        emit(3, f"Extracting {display_name}...")
        logger.info(f"Extracting single statement: {display_name}")

        start = time.time()
        section_data = self._extract_single_statement(uploaded_file, prompt, display_name)
        section_data = self._post_process_section(statement_key, section_data, str(pdf_path))
        elapsed = time.time() - start
        rows = self._row_count(section_data)
        logger.info(f"  {display_name} done in {elapsed:.1f}s — {rows} rows")

        # Step 4: Done
        emit(4, f"{display_name} extraction complete — {rows} rows")

        return section_data

    def extract_from_pdf(self, pdf_path: str, progress_callback=None) -> dict:
        """
        Upload a PDF to Gemini and extract financial statements.
        Each statement type gets its own API call to avoid truncation.

        Args:
            pdf_path: Absolute path to the PDF file
            progress_callback: Optional callable(step: int, total: int, message: str)

        Returns:
            Dict with income_statement, balance_sheet, cash_flow, additional_sections
        """
        pdf_path = Path(pdf_path)
        total_steps = 8  # validate, upload, wait, IS, BS, CF, combine, done

        def emit(step, message):
            if progress_callback:
                try:
                    progress_callback(step, total_steps, message)
                except Exception:
                    pass

        # ── Step 1: Validate ──────────────────────────────────────────
        emit(1, "Validating PDF file...")

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError(f"Not a PDF file: {pdf_path.name}")

        file_size_mb = pdf_path.stat().st_size / (1024 * 1024)
        if file_size_mb > 100:
            raise ValueError(f"PDF too large ({file_size_mb:.1f} MB). Maximum is 100 MB.")

        # ── Step 2: Upload ────────────────────────────────────────────
        emit(2, "Uploading document for processing...")
        logger.info(f"Uploading PDF: {pdf_path.name} ({file_size_mb:.1f} MB)")

        uploaded_file = None
        try:
            uploaded_file = genai.upload_file(
                str(pdf_path),
                mime_type="application/pdf",
                display_name=pdf_path.name,
            )
            logger.info(f"Upload complete: {uploaded_file.name}")

            # ── Step 3: Wait for processing ───────────────────────────
            emit(3, "Processing document structure...")
            self._wait_for_file_active(uploaded_file)

            # ── Steps 4-6: Extract each statement separately ──────────
            result = {"additional_sections": []}

            for idx, (key, prompt, display_name) in enumerate(STATEMENT_CONFIGS):
                step_num = 4 + idx
                emit(step_num, f"Extracting {display_name}...")
                logger.info(f"Extracting {display_name}...")

                start = time.time()
                section_data = self._extract_single_statement(uploaded_file, prompt, display_name)
                section_data = self._post_process_section(key, section_data, str(pdf_path))
                elapsed = time.time() - start
                logger.info(f"  {display_name} done in {elapsed:.1f}s — "
                            f"{self._row_count(section_data)} rows")

                result[key] = section_data

            # ── Step 7: Combine ───────────────────────────────────────
            emit(7, "Combining extracted data...")

            is_rows = self._row_count(result.get('income_statement'))
            bs_rows = self._row_count(result.get('balance_sheet'))
            cf_rows = self._row_count(result.get('cash_flow'))
            total_rows = is_rows + bs_rows + cf_rows

            # ── Step 8: Complete ──────────────────────────────────────
            emit(8, f"Extraction complete — {total_rows} rows extracted")
            logger.info(f"Done — IS:{is_rows} BS:{bs_rows} CF:{cf_rows}")

            return result

        except Exception as e:
            logger.error(f"Extraction failed: {e}", exc_info=True)

            error_str = str(e).lower()
            if "quota" in error_str or "rate" in error_str or "429" in error_str:
                raise RuntimeError(
                    "Service rate limit reached. Please wait a moment and try again."
                ) from e
            elif "permission" in error_str or "403" in error_str:
                raise RuntimeError(
                    "Service access denied. Please check configuration."
                ) from e
            elif "not found" in error_str or "404" in error_str:
                raise RuntimeError(
                    "Extraction service unavailable. Please try again later."
                ) from e
            else:
                raise RuntimeError(f"Extraction failed: {e}") from e

        finally:
            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                    logger.info("Cleaned up uploaded file")
                except Exception:
                    pass

    def extract_full_report(self, pdf_path: str, progress_callback=None, max_workers: int = 6) -> dict:
        """
        Extract all financial and non-financial report sections in parallel.

        Returns payload with all section keys required by the full-report endpoint.
        """
        pdf_path = Path(pdf_path)

        def emit(current, total, message, details=None):
            if progress_callback:
                try:
                    progress_callback(current, total, message, details or {})
                except Exception:
                    pass

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        if pdf_path.suffix.lower() != ".pdf":
            raise ValueError(f"Not a PDF file: {pdf_path.name}")

        total_steps = len(FULL_REPORT_SECTION_CONFIGS) + 3
        step = 1
        emit(step, total_steps, "Validating PDF for full-report extraction")

        uploaded_file = None
        try:
            step += 1
            emit(step, total_steps, "Uploading document for full-report extraction")
            uploaded_file = self._get_or_upload_file(pdf_path)

            result = {key: None for key in FULL_REPORT_SECTION_CONFIGS.keys()}

            step += 1
            emit(step, total_steps, "Running parallel section extraction")

            future_map = {}
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                for key, (prompt, display_name) in FULL_REPORT_SECTION_CONFIGS.items():
                    future = executor.submit(self._extract_single_statement, uploaded_file, prompt, display_name)
                    future_map[future] = (key, display_name)

                completed = 0
                for future in as_completed(future_map):
                    key, display_name = future_map[future]
                    try:
                        section_data = future.result()
                    except Exception as exc:
                        logger.warning(f"{display_name} extraction failed: {exc}")
                        section_data = {
                            "section": key,
                            "title": display_name,
                            "subsections": [],
                            "summary": "",
                            "error": str(exc),
                        }

                    result[key] = self._post_process_section(key, section_data, str(pdf_path))
                    completed += 1
                    emit(
                        step + completed,
                        total_steps,
                        f"{display_name} complete ({completed}/{len(FULL_REPORT_SECTION_CONFIGS)})",
                        {
                            "section_key": key,
                            "status": "done",
                            "completed": completed,
                            "total": len(FULL_REPORT_SECTION_CONFIGS),
                        }
                    )

            return result
        finally:
            if uploaded_file:
                try:
                    genai.delete_file(uploaded_file.name)
                except Exception:
                    pass

    # ── Core: extract one statement ───────────────────────────────────

    def _extract_single_statement(self, uploaded_file, prompt: str, display_name: str, retries: int = 4):
        """
        Send a single extraction prompt to Gemini for one statement type.
        Returns the parsed dict or None if not found.
        Retries on parse failure.
        """
        last_err = None

        for attempt in range(1, retries + 1):
            try:
                response = self.model.generate_content(
                    [uploaded_file, prompt],
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.0,
                        max_output_tokens=50000,
                        response_mime_type="application/json",
                    ),
                )

                parsed = self._parse_section_response(response)
                return parsed  # can be None (statement not found) or a dict

            except Exception as e:
                last_err = e
                logger.warning(
                    f"  {display_name} attempt {attempt}/{retries} failed: {e}"
                )
                if attempt < retries:
                    time.sleep(2)

        logger.error(f"  {display_name}: all {retries} attempts failed")
        # Return None rather than crashing — the other statements may still succeed
        return None

    def _post_process_section(self, section_key: str, section_data: Any, pdf_path: str) -> Dict[str, Any]:
        """
        Normalize all outputs into stable schemas.

        Financial statements are always returned as structured tables.
        Narrative sections are normalized to paragraph/bullets structures.
        """
        key = section_key or ""

        if key in FINANCIAL_SECTION_KEYS:
            return self._ensure_financial_table(key, section_data, pdf_path)

        if key in TEXT_SECTION_KEYS:
            return self._ensure_text_section(key, section_data)

        if isinstance(section_data, dict):
            return section_data

        return {
            "section": key,
            "title": key.replace("_", " ").title(),
            "value": section_data,
        }

    def _ensure_financial_table(self, section_key: str, section_data: Any, pdf_path: str) -> Dict[str, Any]:
        """Guarantee finance sections always return a structured table payload."""
        title = self._derive_title(section_key, section_data)

        headers, rows = self._extract_table_from_model_payload(section_data)
        if rows:
            normalized = normalize_table(headers, rows)
            return {
                "section": section_key,
                "title": title,
                **normalized,
            }

        blob = extract_plain_text_blob(section_data)
        reconstructed = reconstruct_table_from_text_block(blob)
        if reconstructed:
            normalized = normalize_table(reconstructed.headers, reconstructed.rows)
            return {
                "section": section_key,
                "title": title,
                **normalized,
            }

        layered = extract_table_from_pdf_layers(
            pdf_path=pdf_path,
            section_keywords=FINANCIAL_KEYWORDS.get(section_key, []),
        )
        if layered:
            normalized = normalize_table(layered.headers, layered.rows)
            return {
                "section": section_key,
                "title": title,
                **normalized,
            }

        # Never return raw text for financial statements.
        return {
            "section": section_key,
            "title": title,
            "headers": ["Item"],
            "rows": [],
            "row_count": 0,
            "column_count": 1,
        }

    def _ensure_text_section(self, section_key: str, section_data: Any) -> Dict[str, Any]:
        """Normalize narrative sections into paragraphs + bullets arrays."""
        title = self._derive_title(section_key, section_data)

        paragraphs: List[str] = []
        bullets: List[str] = []

        if isinstance(section_data, dict):
            raw_paragraphs = section_data.get("paragraphs")
            if isinstance(raw_paragraphs, list):
                paragraphs.extend(str(p).strip() for p in raw_paragraphs if str(p).strip())

            raw_rows = section_data.get("rows")
            if isinstance(raw_rows, list):
                for row in raw_rows:
                    if isinstance(row, dict):
                        item = str(row.get("item", "")).strip()
                        values = row.get("values")
                        if item and isinstance(values, list) and values:
                            bullets.append(f"{item}: {values[0]}")
                        elif item:
                            bullets.append(item)
                    elif isinstance(row, str) and row.strip():
                        bullets.append(row.strip())

            raw_subsections = section_data.get("subsections")
            if isinstance(raw_subsections, list):
                for subsection in raw_subsections:
                    if not isinstance(subsection, dict):
                        continue
                    for p in subsection.get("paragraphs", []) or []:
                        if str(p).strip():
                            paragraphs.append(str(p).strip())
                    for b in subsection.get("bullets", []) or []:
                        if str(b).strip():
                            bullets.append(str(b).strip())

        if not paragraphs:
            blob = extract_plain_text_blob(section_data)
            if blob:
                for line in blob.splitlines():
                    txt = line.strip()
                    if not txt:
                        continue
                    if txt.startswith(("-", "*", "•")):
                        bullets.append(txt.lstrip("-*• ").strip())
                    else:
                        paragraphs.append(txt)

        # De-duplicate while preserving order.
        paragraphs = list(dict.fromkeys(paragraphs))
        bullets = list(dict.fromkeys(bullets))

        return {
            "section": section_key,
            "title": title,
            "paragraphs": paragraphs,
            "bullets": bullets,
        }

    @staticmethod
    def _derive_title(section_key: str, section_data: Any) -> str:
        if isinstance(section_data, dict):
            title = section_data.get("title")
            if isinstance(title, str) and title.strip():
                return title.strip()
        return section_key.replace("_", " ").title()

    @staticmethod
    def _extract_table_from_model_payload(section_data: Any) -> tuple[list[Any], list[list[Any]]]:
        """Extract headers/rows from current and legacy payload shapes."""
        if not isinstance(section_data, dict):
            return [], []

        headers = section_data.get("headers") if isinstance(section_data.get("headers"), list) else []
        rows = section_data.get("rows") if isinstance(section_data.get("rows"), list) else []

        normalized_rows: List[List[Any]] = []

        if rows and isinstance(rows[0], dict):
            for row in rows:
                item = row.get("item") or row.get("label")
                values = row.get("values") if isinstance(row.get("values"), list) else []
                if item is None and not values:
                    continue
                normalized_rows.append([item, *values])

        elif rows and isinstance(rows[0], list):
            normalized_rows = [list(r) for r in rows]

        # Fallback: inspect subsection tables if root is not directly tabular.
        if not normalized_rows:
            subsections = section_data.get("subsections")
            if isinstance(subsections, list):
                for subsection in subsections:
                    if not isinstance(subsection, dict):
                        continue
                    if subsection.get("type") != "table":
                        continue
                    sub_headers = subsection.get("headers") if isinstance(subsection.get("headers"), list) else []
                    sub_rows = subsection.get("rows") if isinstance(subsection.get("rows"), list) else []
                    if sub_rows and isinstance(sub_rows[0], dict):
                        for row in sub_rows:
                            item = row.get("item") or row.get("label")
                            values = row.get("values") if isinstance(row.get("values"), list) else []
                            normalized_rows.append([item, *values])
                    elif sub_rows and isinstance(sub_rows[0], list):
                        normalized_rows.extend([list(r) for r in sub_rows])

                    if not headers and sub_headers:
                        headers = sub_headers

        return headers, normalized_rows

    # ── Private helpers ───────────────────────────────────────────────

    @staticmethod
    def _wait_for_file_active(uploaded_file, timeout: int = 120):
        """Poll until the uploaded file is in ACTIVE state."""
        start = time.time()
        while time.time() - start < timeout:
            file_info = genai.get_file(uploaded_file.name)
            if file_info.state.name == "ACTIVE":
                return
            if file_info.state.name == "FAILED":
                raise RuntimeError("Document processing failed")
            logger.info(f"  File state: {file_info.state.name}, waiting...")
            time.sleep(2)
        raise RuntimeError(f"Document processing timed out after {timeout}s")

    @staticmethod
    def _parse_section_response(response) -> dict | None:
        """
        Parse a single-statement response.
        Returns the section dict, or None if the model returned null / empty.
        Includes truncation-repair logic.
        """
        text = response.text.strip()

        # Strip markdown code fences robustly
        if text.startswith("```"):
            text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
            text = re.sub(r'\n?```\s*$', '', text)
            text = text.strip()

        # Handle explicit null / empty
        if text.lower() in ('null', 'none', ''):
            return None

        # ── Attempt 1: direct parse ──────────────────────────────────
        parse_error = None
        try:
            data = json.loads(text)
            if data is None:
                return None
            if isinstance(data, dict):
                return data
            logger.warning(f"Unexpected response type: {type(data)}")
            return None
        except json.JSONDecodeError as e:
            parse_error = e
            logger.warning(f"Direct JSON parse failed ({len(text)} chars): {e}")
            logger.warning(f"Last 300 chars: ...{text[-300:]}")

        # ── Attempt 2: truncation repair ─────────────────────────────
        repaired = text
        repaired = re.sub(r',\s*$', '', repaired)
        repaired = re.sub(r':\s*$', ': null', repaired)
        repaired = re.sub(r',\s*"[^"]*$', '', repaired)
        repaired = re.sub(r'"[^"]*$', '""', repaired)
        # Remove trailing partial number
        repaired = re.sub(r',\s*-?\d*\.?\d*$', '', repaired)

        open_braces = repaired.count('{') - repaired.count('}')
        open_brackets = repaired.count('[') - repaired.count(']')
        repaired += ']' * max(open_brackets, 0)
        repaired += '}' * max(open_braces, 0)

        try:
            data = json.loads(repaired)
            logger.info(f"Truncation repair succeeded ({len(text)} → {len(repaired)} chars)")
            if isinstance(data, dict):
                return data
            return None
        except json.JSONDecodeError:
            logger.error(f"Repair also failed. First 1000 chars: {text[:1000]}")
            raise RuntimeError(
                "Received an incomplete response. Please try again."
            ) from parse_error

    @staticmethod
    def _row_count(section) -> int:
        if section and isinstance(section, dict):
            return len(section.get("rows", []))
        return 0
