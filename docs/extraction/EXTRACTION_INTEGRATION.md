# Extraction Service Integration (Document AI + Textract + Gemini)

This document explains the integration pattern implemented for the Extraction Service.

Overview
- Primary OCR: Google Document AI
- Secondary OCR (fallback): Amazon Textract
- Normalizer: Gemini (only for tables, semantic labels, column alignment)
- Caching: Redis (OCR outputs + Gemini responses)

Process flow
1. Receive PDF bytes.
2. Compute content hash and check Redis cache.
3. Call Document AI (primary). If confidence >= threshold, continue.
4. If Document AI confidence < threshold, call Textract and merge results.
5. Call Gemini normalizer to align tables, label sections, and produce final structured JSON.
6. Cache final JSON and return.

Example structured JSON (trimmed):

```
{
  "document_hash": "...",
  "ocr": {
    "raw_texts": {"primary": "...", "fallback": "..."},
    "structured": {"pages": [...], "tables": [...]},
    "confidence": 0.95
  },
  "normalized": {
    "income_statement": {"2024": {...}, "2023": {...}},
    "balance_sheet": {...},
    "cash_flow": {...},
    "notes": [...],
    "sections": [...]  
  },
  "meta": {"gemini": {"prompt_version": "tables_v1"}, "final_confidence": 0.90}
}
```

Notes & Next steps
- Replace placeholder clients with real API calls and robust error handling.
- Instrument latency and error metrics for Document AI, Textract, and Gemini calls.
- Add retry policies and circuit-breakers per external dependency.
- Harden caching and cache invalidation policies.
