# Bank Financial Statement AI Extractor

An intelligent PDF extraction system designed to automatically extract structured financial data from bank annual reports and financial statements.

## Features

- **Multi-Format Support**: Handles both text-based and image-based PDFs using OCR
- **Intelligent Section Detection**: Automatically locates Income Statements, Balance Sheets, and Cash Flow Statements
- **AI-Powered Extraction**: Uses OpenAI GPT-4 or Anthropic Claude for accurate data extraction
- **Financial Validation**: Validates extracted data against accounting rules
- **Confidence Scoring**: Provides confidence scores for extracted values
- **Batch Processing**: Process multiple PDFs in one run
- **Standardized Output**: Maps extracted data to standardized field names

## Project Structure

```
Ai Extractor/
├── config/
│   ├── keywords.py              # Keywords for section detection
│   ├── settings.yaml            # Configuration settings
│   ├── target_schema_bank.py    # Target fields for banks
│   └── term_mapping_bank.py     # Field name mappings
├── data/
│   ├── raw/                     # Input PDF files
│   ├── processed/               # Extracted JSON files
│   └── temp/                    # Temporary files
├── logs/                        # Log files
├── src/
│   ├── extraction/              # Data extraction modules
│   ├── pdf/                     # PDF processing modules
│   ├── pipeline/                # Main pipeline
│   ├── storage/                 # Data storage
│   ├── utils/                   # Utilities
│   └── validation/              # Validation modules
├── scripts/
│   ├── run_single_pdf.py        # Run single PDF extraction
│   └── run_batch.py             # Run batch extraction
└── tests/                       # Test files
```

## Installation

### Prerequisites

- Python 3.8 or higher
- Tesseract OCR (for image-based PDFs)
- OpenAI API key or Anthropic API key

### Step 1: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 2: Install Tesseract OCR

**Windows:**
```bash
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
# Add tesseract to PATH
```

**Linux:**
```bash
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

### Step 3: Configure API Keys

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
# OR
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Step 4: Configure Settings

Edit `config/settings.yaml` to customize:
- Entity type (bank/insurance/finance)
- AI provider and model
- OCR settings
- Validation rules
- Output preferences

## Usage

### Extract from Single PDF

```bash
python scripts/run_single_pdf.py "data/raw/bank_annual_report.pdf"
```

With options:
```bash
python scripts/run_single_pdf.py "data/raw/bank_annual_report.pdf" \
    --company "ABC Bank" \
    --output "my_output.json"
```

### Batch Process Multiple PDFs

```bash
python scripts/run_batch.py "data/raw/hnb/"
```

With options:
```bash
python scripts/run_batch.py "data/raw/" \
    --config "config/settings.yaml" \
    --no-summary
```

### Use as Python Module

```python
from src.pipeline.extract import ExtractionPipeline

# Initialize pipeline
pipeline = ExtractionPipeline("config/settings.yaml")

# Extract from single PDF
result = pipeline.extract_from_pdf(
    "data/raw/bank_report.pdf",
    company_name="ABC Bank"
)

# Access extracted data
print(result['data']['income_statement'])
print(result['confidence'])
print(result['validation'])
```

## Configuration

### Key Configuration Options

**Entity Settings:**
```yaml
entity:
  type: "bank"                    # bank, insurance, finance
  default_currency: "LKR"
  default_unit: "thousands"
```

**AI Settings:**
```yaml
ai:
  provider: "openai"              # openai, anthropic
  model: "gpt-4-turbo-preview"
  temperature: 0.1
```

**OCR Settings:**
```yaml
ocr:
  enabled: true
  engine: "tesseract"
  confidence_threshold: 60
```

**Validation Settings:**
```yaml
validation:
  min_confidence_score: 0.7
  check_balance_sheet_equation: true
  tolerance_percentage: 0.01      # 1%
```

## Output Format

Extracted data is saved as JSON:

```json
{
  "metadata": {
    "company_name": "ABC Bank",
    "extraction_date": "2024-01-15T10:30:00",
    "period": {"year": 2023, "type": "year_ended"},
    "currency": "LKR",
    "unit": "thousands"
  },
  "data": {
    "income_statement": {
      "Interest income": 125000,
      "Interest expenses": 45000,
      "Net interest income": 80000,
      ...
    },
    "balance_sheet": {
      "Total assets": 5000000,
      "Total liabilities": 4500000,
      ...
    },
    "cash_flow": {
      ...
    }
  },
  "validation": {
    "income_statement": true,
    "balance_sheet": true,
    "cash_flow": true
  },
  "confidence": {
    "income_statement": {"confidence": 0.85},
    "balance_sheet": {"confidence": 0.92},
    "overall": 0.88
  }
}
```

## Target Schema

The system extracts the following data for banks:

### Income Statement
- Gross income, Interest income, Interest expenses
- Net interest income, Fee and commission income
- Operating expenses, Personnel expenses
- Profit before/after tax, Earnings per share
- And 30+ more fields...

### Financial Position Statement (Balance Sheet)
- Cash and cash equivalents, Loans and advances
- Financial assets, Investment properties
- Deposits, Borrowings, Equity
- And 30+ more fields...

### Cash Flow Statement
- Operating activities, Investing activities
- Financing activities, Cash flow reconciliation
- And 60+ more fields...

See `config/target_schema_bank.py` for the complete list.

## Extending for Other Entities

To use this system for insurance companies or other financial institutions:

1. Create new schema file: `config/target_schema_insurance.py`
2. Create new term mapping: `config/term_mapping_insurance.py`
3. Update `config/settings.yaml` to reference new files
4. Update `config/keywords.py` with entity-specific keywords

## Validation Rules

The system validates:

1. **Balance Sheet Equation**: Assets = Liabilities + Equity
2. **Income Statement**: PBT - Tax = PAT
3. **Cash Flow**: Opening + Net Change = Closing
4. **Tolerance**: All validations use configurable tolerance (default 1%)

## Troubleshooting

### OCR Not Working
- Verify Tesseract is installed: `tesseract --version`
- Check tesseract is in system PATH
- Increase `ocr.confidence_threshold` in settings

### Low Confidence Scores
- Use higher resolution PDFs
- Enable OCR preprocessing: `ocr.preprocess: true`
- Adjust AI temperature: lower values = more conservative

### Missing Fields
- Check `logs/` for extraction details
- Verify field names in term_mapping
- Ensure PDF contains the required sections

### API Errors
- Verify API keys in `.env` file
- Check API rate limits and quotas
- Increase `ai.timeout` in settings

## Performance

- **Single PDF**: 30-60 seconds
- **Batch Processing**: ~45 seconds per PDF
- **OCR Processing**: Adds 10-20 seconds per PDF

Performance depends on:
- PDF size and complexity
- Number of pages
- OCR requirements
- API response times

## License

This project is part of the Stock Exchange Prediction Model Project.

## Support

For issues and questions:
- Check the logs in `logs/` directory
- Review configuration in `config/settings.yaml`
- Ensure all dependencies are installed

## Version

**Version:** 1.0
**Last Updated:** December 2024
