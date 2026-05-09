# TWO-STAGE EXTRACTION PIPELINE - ARCHITECTURE

## Overview

This codebase implements a robust two-stage pipeline for extracting financial statements from bank annual reports (500+ pages).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT: PDF Annual Report                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE A: PAGE LOCATION                                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Table of Contents Detection                        │  │
│  │    - Parse ToC to find statement page numbers         │  │
│  │    - Compute PDF page offset                          │  │
│  │                                                         │  │
│  │ 2. Heading Scanner                                     │  │
│  │    - Scan for statement titles in headers             │  │
│  │    - Use text layer or lightweight OCR                │  │
│  │                                                         │  │
│  │ 3. Layout Analyzer                                     │  │
│  │    - Detect numeric density, tables, year headers     │  │
│  │    - Identify Bank/Group headers, Note columns        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  OUTPUT: Ranked candidate pages with confidence scores       │
│  {                                                            │
│    "Income_Statement": [                                     │
│      {"page_range": [25, 27], "confidence": 0.92,           │
│       "evidence": [...], "sources": ["toc", "heading"]}     │
│    ],                                                        │
│    ...                                                       │
│  }                                                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE B: STRUCTURED EXTRACTION                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 1. Table Detection & Structure Analysis                │  │
│  │    - Extract table cells with bounding boxes           │  │
│  │    - Identify rows and columns by structure            │  │
│  │                                                         │  │
│  │ 2. Column Interpretation                                │  │
│  │    - Parse headers to identify:                        │  │
│  │      * Bank vs Group columns                           │  │
│  │      * Year1 vs Year2 columns                          │  │
│  │      * Note/Description columns                        │  │
│  │                                                         │  │
│  │ 3. Row Extraction & Value Normalization                │  │
│  │    - Extract cells by structure (not line-based)       │  │
│  │    - Normalize numeric values:                         │  │
│  │      * (1,234) → -1234 (brackets = negative)          │  │
│  │      * "–" → null (dash = missing)                    │  │
│  │      * Strip currency, commas, preserve decimals      │  │
│  │      * Detect and prevent column shifts                │  │
│  │                                                         │  │
│  │ 4. Row Label Mapping (Cascading Strategy)              │  │
│  │    a) Exact match to canonical schema                  │  │
│  │    b) Synonym dictionary lookup                        │  │
│  │    c) Fuzzy matching (edit distance)                   │  │
│  │    d) Semantic/LLM fallback (optional, strict)         │  │
│  │                                                         │  │
│  │ 5. Validation & Confidence Scoring                     │  │
│  │    - Magnitude plausibility checks                     │  │
│  │    - Sign convention validation                        │  │
│  │    - Column consistency (Bank/Group not swapped)       │  │
│  │    - Reconciliation checks (totals with tolerance)     │  │
│  │    - Per-field and per-statement confidence            │  │
│  └───────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT GENERATION                                           │
│                                                               │
│  1. Canonical JSON (matches target schema)                   │
│     {                                                        │
│       "Bank": {                                              │
│         "Year1": {"Income_Statement": {...}, ...},          │
│         "Year2": {...}                                       │
│       },                                                     │
│       "Group": {...}                                         │
│     }                                                        │
│                                                               │
│  2. Review Payload (for manual review if needed)             │
│     {                                                        │
│       "review_required": true/false,                         │
│       "statement_details": {                                 │
│         "Income_Statement": {                               │
│           "pages_used": [25, 27],                           │
│           "confidence": 0.85,                                │
│           "table_snapshots": [...],                          │
│           "mapping_decisions": [...],                        │
│           "validation_failures": [...]                       │
│         }                                                    │
│       },                                                     │
│       "warnings": [...]                                      │
│     }                                                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Principles

### 1. Table-First Extraction (Not OCR-First)
- Extract table structure first: rows, columns, cells
- Only OCR when text layer is insufficient
- Use cell bounding boxes to prevent line-based errors

### 2. Column Detection by Header Parsing
- Don't assume column positions
- Parse headers to identify Bank/Group and Year1/Year2
- Handle multi-row headers

### 3. Robust Numeric Normalization
- Brackets = negative: `(1,234)` → `-1234`
- Dashes = null: `–` → `None`
- Preserve decimals: `1,234.56` → `1234.56`
- Detect column shifts by checking consistency

### 4. Cascading Mapping with Confidence
- Try exact → synonyms → fuzzy → semantic
- Track confidence and method for each match
- Store unmatched rows as "unknown" for review

### 5. Validation at Multiple Levels
- Field-level: magnitude, sign, format
- Statement-level: reconciliation, consistency
- Cross-statement: logical relationships

### 6. Review-Ready Output
- Low confidence → flag for review
- Provide all context: pages, tables, mappings, warnings
- Enable targeted manual correction

## Module Structure

```
src/
├── locator/           # Stage A: Page Location
│   ├── toc_detector.py
│   ├── heading_scanner.py
│   ├── layout_analyzer.py
│   └── page_locator.py (orchestrator)
│
├── extractor/         # Stage B: Extraction Components
│   ├── table_detector.py
│   ├── column_interpreter.py
│   ├── row_extractor.py
│   └── numeric_normalizer.py
│
├── mapper/            # Row Label Mapping
│   ├── exact_matcher.py
│   ├── fuzzy_matcher.py
│   ├── semantic_matcher.py
│   └── mapping_engine.py (orchestrator)
│
├── validator/         # Validation & Confidence
│   ├── accounting_rules.py
│   ├── confidence_score.py
│   ├── magnitude_checker.py
│   ├── column_consistency.py
│   └── reconciliation.py
│
├── schema/            # Output Generation
│   ├── canonical_builder.py
│   ├── metadata_builder.py
│   └── review_payload.py
│
└── pipeline/          # Main Orchestration
    └── two_stage_pipeline.py
```

## Usage

### Command Line

```bash
# Basic usage
python scripts/run_pipeline.py path/to/annual_report.pdf

# With options
python scripts/run_pipeline.py path/to/report.pdf \
    --min-confidence 0.6 \
    --no-intermediates
```

### Python API

```python
from src.pipeline.two_stage_pipeline import TwoStagePipeline

# Create pipeline
pipeline = TwoStagePipeline(config={
    'min_page_confidence': 0.5,
    'fuzzy_threshold': 85.0,
    'validation_tolerance': 0.01
})

# Extract
result = pipeline.extract('path/to/report.pdf')

# Check status
if result['overall_status'] == 'SUCCESS':
    canonical_data = result['canonical_output']
    # Use extracted data
elif result['overall_status'] == 'NEEDS_REVIEW':
    review_payload = result['review_payload']
    # Send to review UI
```

## Testing

```bash
# Run all tests
pytest tests/ -v

# Run specific test modules
pytest tests/test_numeric_normalizer.py -v
pytest tests/test_column_interpreter.py -v
pytest tests/test_mapping_engine.py -v
pytest tests/test_page_locator.py -v
```

## Configuration

Key configuration parameters in `config/settings.yaml`:

```yaml
# Page location
min_page_confidence: 0.5

# Mapping
fuzzy_threshold: 85.0

# Validation
validation_tolerance: 0.01  # 1% tolerance for reconciliation

# OCR (only when needed)
ocr_engine: tesseract
ocr_lang: eng
```

## Target Schema

The canonical output matches the schema defined in `config/target_schema_bank.py`:

- **Three mandatory statements**:
  - Income Statement
  - Financial Position Statement
  - Cash Flow Statement

- **Four perspectives** (Bank/Group × Year1/Year2):
  - Bank Year1 (most recent)
  - Bank Year2 (previous year)
  - Group Year1 (consolidated, most recent)
  - Group Year2 (consolidated, previous year)

## Performance Optimization

### For 500+ Page PDFs:

1. **Selective OCR**: Only OCR pages identified in Stage A
2. **Parallel Processing**: Can process statements in parallel
3. **Caching**: Cache ToC and page text to avoid re-extraction
4. **Progressive Loading**: Don't load all pages into memory

## Error Handling

The pipeline handles errors at multiple levels:

- **Page location failures**: Try alternate strategies (ToC → heading → layout)
- **Extraction errors**: Flag for review with context
- **Validation failures**: Mark as NEEDS_REVIEW with specific warnings
- **Mapping failures**: Store as "unknown" for manual review

## Future Enhancements

1. **Semantic Matcher**: Add LLM-based fallback for difficult mappings
2. **Table Detector**: Improve table structure detection
3. **Review UI**: Build web interface for reviewing flagged extractions
4. **Multi-format**: Extend to insurance and other financial institutions
5. **Incremental Processing**: Process updates to existing extractions
