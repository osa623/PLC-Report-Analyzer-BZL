# System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        USER INTERFACE (React Frontend)                      │
│                        http://localhost:3000                                │
│                                                                             │
│  ┌──────────────┐         ┌──────────────────┐         ┌─────────────┐    │
│  │  Dashboard   │────────▶│   PDFDetail      │────────▶│  Results    │    │
│  │  (PDF List)  │         │  (Extraction)    │         │  (Summary)  │    │
│  └──────────────┘         └──────────────────┘         └─────────────┘    │
│         │                          │                                        │
│         │ Select PDF               │ Select Pages + Extract                │
│         ▼                          ▼                                        │
└─────────────────────────────────────────────────────────────────────────────┘
          │                          │
          │ POST /api/pdfs/{id}/extract
          │                          │ POST /api/pdfs/{id}/extract-data
          │                          │ (selectedPages: {income: [5,6], ...})
          ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    FLASK API SERVER (api_server.py)                         │
│                    http://localhost:5000                                    │
│                                                                             │
│  ┌─────────────────────┐                 ┌─────────────────────┐          │
│  │  /api/pdfs/{id}/    │                 │  /api/pdfs/{id}/    │          │
│  │  extract            │                 │  extract-data       │          │
│  │                     │                 │                     │          │
│  │  1. Call PageLocator│                 │  1. Get PDF path    │          │
│  │  2. Find statements │                 │  2. Extract tables  │          │
│  │  3. Generate images │                 │  3. Interpret cols  │          │
│  │  4. Return metadata │                 │  4. Map labels      │          │
│  └─────────────────────┘                 │  5. Normalize nums  │          │
│           │                               │  6. Generate files  │          │
│           │                               └─────────────────────┘          │
│           │                                        │                        │
└───────────┼────────────────────────────────────────┼────────────────────────┘
            │                                        │
            ▼                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                         EXTRACTION PIPELINE                                 │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                     STAGE A: PAGE LOCATION                         │   │
│  │                                                                     │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐          │   │
│  │  │     TOC      │   │   Heading    │   │   Layout     │          │   │
│  │  │  Detector    │   │   Scanner    │   │  Analyzer    │          │   │
│  │  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘          │   │
│  │         │                   │                   │                  │   │
│  │         └───────────────────┼───────────────────┘                  │   │
│  │                             ▼                                      │   │
│  │                    ┌─────────────────┐                            │   │
│  │                    │  PageLocator    │                            │   │
│  │                    │  (Orchestrator) │                            │   │
│  │                    └────────┬────────┘                            │   │
│  │                             │                                      │   │
│  │                             ▼                                      │   │
│  │        Income: Pages 15-17 (confidence: 0.95)                     │   │
│  │        Balance: Pages 20-22 (confidence: 0.88)                    │   │
│  │        CashFlow: Pages 25-27 (confidence: 0.92)                   │   │
│  └─────────────────────────────┬───────────────────────────────────────┘   │
│                                │                                            │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                   IMAGE GENERATION                                  │  │
│  │                                                                     │  │
│  │  PyMuPDF (fitz) → Convert pages to PNG (2x zoom)                  │  │
│  │  Save to: app/statement_images/{pdf_id}_{type}_page_{num}.png    │  │
│  │  Serve via: http://localhost:5000/api/images/{filename}           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                                ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                  STAGE B: DATA EXTRACTION                          │  │
│  │                  (After user selects pages)                         │  │
│  │                                                                     │  │
│  │  ┌──────────────────┐                                              │  │
│  │  │ TableExtractor   │ ← Extract tables from selected pages        │  │
│  │  │ (pdfplumber)     │                                              │  │
│  │  └────────┬─────────┘                                              │  │
│  │           │                                                         │  │
│  │           ▼                                                         │  │
│  │  ┌──────────────────┐                                              │  │
│  │  │ Column           │ ← Identify: description, bank_year1,         │  │
│  │  │ Interpreter      │   bank_year2, group_year1, group_year2       │  │
│  │  └────────┬─────────┘                                              │  │
│  │           │                                                         │  │
│  │           ▼                                                         │  │
│  │  ┌──────────────────┐                                              │  │
│  │  │ Mapping Engine   │ ← Map row labels to canonical fields         │  │
│  │  │                  │   Strategy: Exact → Synonym → Fuzzy         │  │
│  │  └────────┬─────────┘                                              │  │
│  │           │                                                         │  │
│  │           ▼                                                         │  │
│  │  ┌──────────────────┐                                              │  │
│  │  │ Numeric          │ ← Clean and normalize values                 │  │
│  │  │ Normalizer       │   Handle brackets, currency, separators     │  │
│  │  └────────┬─────────┘                                              │  │
│  │           │                                                         │  │
│  │           ▼                                                         │  │
│  │  ┌──────────────────┐                                              │  │
│  │  │ Canonical        │ ← Build output structure per                 │  │
│  │  │ Builder          │   TARGET_FIELDS schema                       │  │
│  │  └────────┬─────────┘                                              │  │
│  └───────────┼─────────────────────────────────────────────────────────┘  │
│              │                                                             │
│              ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    OUTPUT GENERATION                                │  │
│  │                                                                     │  │
│  │  JSON File: {pdf_id}_extracted_{timestamp}.json                   │  │
│  │  Excel File: {pdf_id}_extracted_{timestamp}.xlsx                  │  │
│  │  Location: data/processed/extracted_json/                          │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Structure Flow

### 1. Input: PDF File
```
data/raw/commercial/commercial_bank_2023.pdf
```

### 2. Stage A Output: Page Locations + Images
```json
{
  "income": {
    "pages": [14, 16],
    "confidence": 0.95,
    "images": [
      {
        "url": "http://localhost:5000/api/images/commercial_income_page_15.png",
        "page": 15
      },
      {
        "url": "http://localhost:5000/api/images/commercial_income_page_16.png",
        "page": 16
      }
    ]
  },
  "balance": {...},
  "cashflow": {...}
}
```

### 3. User Selection
```json
{
  "selectedPages": {
    "income": [15, 16],
    "balance": [20, 21],
    "cashflow": [25]
  }
}
```

### 4. Stage B Output: Extracted Data
```json
{
  "pdf_id": "commercial_commercial_bank_2023",
  "extraction_date": "2026-01-06T10:30:00",
  "data": {
    "Bank": {
      "Year1": {
        "Income_Statement": {
          "Interest income": "5000000",
          "Interest expenses": "2000000",
          "Net interest income": "3000000",
          ...
        },
        "Financial Position Statement": {...},
        "Cash Flow Statement": {...}
      },
      "Year2": {...}
    },
    "Group": {...}
  },
  "metadata": {
    "pages_processed": {
      "Income_Statement": [15, 16],
      "Financial Position Statement": [20, 21],
      "Cash Flow Statement": [25]
    },
    "fields_found": {
      "Income_Statement": {
        "Bank_Year1": 25,
        "Bank_Year2": 25,
        "Group_Year1": 25,
        "Group_Year2": 25
      }
    }
  }
}
```

## Component Responsibilities

| Component | Input | Output | Purpose |
|-----------|-------|--------|---------|
| **PageLocator** | PDF path | Statement page ranges + confidence | Find where statements are located |
| **TOCDetector** | PDF | Page numbers from table of contents | Quick statement location |
| **HeadingScanner** | PDF | Page numbers with statement titles | Backup location method |
| **LayoutAnalyzer** | PDF | Page numbers with table patterns | Layout-based detection |
| **TableExtractor** | PDF + page numbers | DataFrames with table data | Extract raw tables |
| **ColumnInterpreter** | DataFrame rows | Column type assignments | Identify what each column represents |
| **MappingEngine** | Row labels + statement type | Canonical field names | Map labels to schema |
| **NumericNormalizer** | Cell values | Clean numeric values | Normalize numbers |
| **CanonicalBuilder** | Mapped data | TARGET_FIELDS structure | Build output structure |

## Configuration Files

### target_schema_bank.py
```python
# Defines what fields to extract for each statement
STATEMENT_FIELDS = {
    "Income_Statement": [
        "Interest income",
        "Interest expenses",
        ...
    ],
    "Financial Position Statement": [...],
    "Cash Flow Statement": [...]
}

# Defines the output structure
TARGET_FIELDS = {
    "Bank": {
        "Year1": STATEMENT_FIELDS,
        "Year2": STATEMENT_FIELDS
    },
    "Group": {
        "Year1": STATEMENT_FIELDS,
        "Year2": STATEMENT_FIELDS
    }
}
```

### term_mapping_bank.py
```python
# Defines synonyms for fuzzy matching
TERM_MAPPING = {
    "Interest income": [
        "interest income",
        "interest revenue",
        "total interest income"
    ],
    ...
}
```

## API Endpoints

| Endpoint | Method | Purpose | Input | Output |
|----------|--------|---------|-------|--------|
| `/api/health` | GET | Health check | - | Status |
| `/api/pdfs` | GET | List all PDFs | - | PDF array |
| `/api/pdfs/by-category` | GET | PDFs by category | - | Categorized PDFs |
| `/api/pdfs/{id}/extract` | POST | Extract statements | PDF ID | Statement metadata + images |
| `/api/pdfs/{id}/extract-data` | POST | Extract data | PDF ID + selected pages | Extracted data + files |
| `/api/images/{filename}` | GET | Serve image | Filename | PNG image |
| `/api/pdfs/{id}/submit` | POST | Submit statements | PDF ID + statements | Success response |

## File Naming Conventions

### Images
```
{pdf_id}_{statement_type}_page_{page_number}.png

Examples:
commercial_commercial_bank_2023_income_page_15.png
commercial_commercial_bank_2023_balance_page_20.png
commercial_commercial_bank_2023_cashflow_page_25.png
```

### Output Files
```
{pdf_id}_extracted_{timestamp}.json
{pdf_id}_extracted_{timestamp}.xlsx

Examples:
commercial_commercial_bank_2023_extracted_20260106_103045.json
commercial_commercial_bank_2023_extracted_20260106_103045.xlsx
```

## System Requirements

### Backend
- Python 3.8+
- Flask, Flask-CORS
- pdfplumber
- PyMuPDF (fitz)
- pandas, openpyxl
- rapidfuzz
- sentence-transformers

### Frontend
- Node.js 16+
- React 18
- Vite
- Axios
- React Router
- Tailwind CSS

### Hardware
- Minimum 4GB RAM
- 2GB free disk space (for PDFs and images)
- CPU with 2+ cores recommended

### Network
- Backend: Port 5000
- Frontend: Port 3000
- Both services on same machine (localhost)
