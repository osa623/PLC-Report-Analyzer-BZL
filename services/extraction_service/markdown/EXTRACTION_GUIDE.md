# Financial Statement Data Extraction Guide

## Overview
This feature extracts financial statement data from selected PDF pages using **schema-based mapping** that follows the predefined target schema. The system automatically maps extracted fields to canonical field names and organizes data by Bank/Group and Year1/Year2 structure.

## Key Features

### 🎯 Schema-Based Extraction
- Uses predefined field schema from `target_schema_bank.py`
- Automatically maps extracted labels to canonical field names using fuzzy matching and synonym dictionaries
- Supports three statement types:
  - Income Statement
  - Financial Position Statement (Balance Sheet)
  - Cash Flow Statement

### 🏦 Entity & Year Detection
- Automatically detects **Bank** vs **Group** columns
- Identifies **Year1** and **Year2** data columns
- Organizes data according to the TARGET_FIELDS structure

### 📊 Output Structure
Data is organized hierarchically:
```
Bank
  ├── Year1
  │   ├── Income_Statement
  │   ├── Financial Position Statement
  │   └── Cash Flow Statement
  └── Year2
      ├── Income_Statement
      ├── Financial Position Statement
      └── Cash Flow Statement
Group
  ├── Year1
  │   └── (same statements)
  └── Year2
      └── (same statements)
```

## How to Use

### 1. Navigate to PDF Details
- From the dashboard, click on any PDF to view its details
- The system will automatically extract and display three types of financial statements

### 2. Select Pages for Extraction
- Each statement card displays thumbnails of the relevant pages
- **Click the checkbox** in the top-left corner of any page thumbnail to select it
- You can select **multiple pages** for each statement type
- Selected pages will have a checkmark and highlighted border

### 3. Extract Data
- Once you've selected the pages, click the **"Extract Data"** button
- The system will:
  - Extract all tables from the selected pages
  - Use the **Mapping Engine** to match row labels to canonical field names
  - Use the **Column Interpreter** to detect Bank/Group and Year columns
  - Organize data according to the schema structure

## Output Files

### JSON File Structure
```json
{
  "pdf_id": "company_name_year",
  "extraction_date": "2026-01-06T...",
  "data": {
    "Bank": {
      "Year1": {
        "Income_Statement": {
          "Gross income": "150000000",
          "Interest income": "120000000",
          "Interest expenses": "45000000",
          "Net interest income": "75000000",
          ...
        },
        "Financial Position Statement": {
          "Cash and cash equivalents": "50000000",
          "Total assets": "2500000000",
          ...
        },
        "Cash Flow Statement": {
          "Cash flows from operating activities": "85000000",
          ...
        }
      },
      "Year2": {
        "Income_Statement": { ... },
        "Financial Position Statement": { ... },
        "Cash Flow Statement": { ... }
      }
    },
    "Group": {
      "Year1": { ... },
      "Year2": { ... }
    }
  },
  "metadata": {
    "pages_processed": {
      "Income_Statement": [5, 6],
      "Financial Position Statement": [7, 8],
      "Cash Flow Statement": [9, 10]
    },
    "fields_found": {
      "Income_Statement": {
        "Bank_Year1": 35,
        "Bank_Year2": 35,
        "Group_Year1": 35,
        "Group_Year2": 35
      }
    }
  }
}
```

### Excel File Structure
The Excel file contains multiple sheets:

#### Summary Sheet
- PDF ID
- Extraction date
- Statements processed

#### Entity-Year-Statement Sheets
Separate sheets for each combination:
- `Bank_Year1_Income_Statement`
- `Bank_Year2_Income_Statement`
- `Group_Year1_Income_Statement`
- ... (and so on)

Each sheet has:
- **Field**: Canonical field name from schema
- **Value**: Extracted and normalized value

#### Comprehensive View Sheets
- `Bank_Year1_All`: All statements combined for Bank Year1
- `Bank_Year2_All`: All statements combined for Bank Year2
- `Group_Year1_All`: All statements combined for Group Year1
- `Group_Year2_All`: All statements combined for Group Year2

## Intelligent Mapping System

### Mapping Engine
The system uses a cascading mapping strategy:

1. **Exact Match**: Direct match with canonical field names
2. **Synonym Lookup**: Uses `term_mapping_bank.py` for known variations
3. **Fuzzy Matching**: Uses edit distance to match similar labels (threshold: 85%)
4. **Semantic Matching**: Can use LLM/embedding-based matching (optional)

Example mappings:
```
"Interest Income from Loans" → "Interest income"
"Fee & Commission Revenue" → "Fee and commission income"
"Total Comprehensive Income" → "PROFIT FOR THE YEAR"
```

### Column Interpretation
Automatically detects column types:
- **Description columns**: Row labels (usually first column)
- **Bank columns**: Detected by keywords "Bank", "Company", "Entity"
- **Group columns**: Detected by "Group", "Consolidated"
- **Year columns**: Extracts year from headers (e.g., "2023", "2024")

### Value Normalization
- Removes currency symbols and formatting
- Handles parentheses for negative values
- Converts thousands/millions notation (e.g., "1,234.5" → "1234500")
- Preserves decimal precision

## File Location
Both JSON and Excel files are saved to:
```
Fundamental Analysis/Models/Ai Extractor/data/processed/statement_jsons/
```

File naming convention:
- `{pdf_id}_extracted_{timestamp}.json`
- `{pdf_id}_extracted_{timestamp}.xlsx`

## Tips for Best Results

1. **Select Complete Pages**: Ensure selected pages contain the full statement tables
2. **Include Header Rows**: Make sure table headers are visible in selected pages
3. **Multiple Pages**: If a statement spans multiple pages, select all relevant pages
4. **Review Mappings**: Check the JSON metadata to see which fields were successfully mapped
5. **Check Confidence**: Higher mapping confidence indicates better field matching

## Schema Coverage

The system attempts to extract ALL fields defined in the schema:

### Income Statement (40+ fields)
Including: Gross income, Interest income, Net interest income, Fee and commission income, Operating expenses, Profit before tax, etc.

### Financial Position Statement (35+ fields)
Including: Cash equivalents, Loans and advances, Total assets, Due to depositors, Total liabilities, etc.

### Cash Flow Statement (65+ fields)
Including: Operating activities, Investing activities, Financing activities, and detailed line items

## API Endpoint

### POST `/api/pdfs/<pdf_id>/extract-data`

**Request Body:**
```json
{
  "selectedPages": {
    "income": [5, 6],
    "balance": [7, 8],
    "cashflow": [9, 10]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data extracted successfully using schema-based mapping",
  "pdf_id": "company_name_year",
  "statements_processed": ["Income_Statement", "Financial Position Statement", "Cash Flow Statement"],
  "json_file": "company_name_year_extracted_20260106_120000.json",
  "excel_file": "company_name_year_extracted_20260106_120000.xlsx",
  "output_dir": "/path/to/processed/statement_jsons",
  "total_fields_extracted": 245,
  "extraction_summary": {
    "Bank": {
      "Year1": 65,
      "Year2": 62
    },
    "Group": {
      "Year1": 63,
      "Year2": 55
    }
  }
}
```

## Tips

1. **Select Relevant Pages Only**: Only select pages that contain the actual statement tables to avoid extracting irrelevant data

2. **Review Page Thumbnails**: Use the page thumbnails to verify you're selecting the correct pages before extraction

3. **Check Confidence Scores**: Higher confidence scores indicate better page detection by the system

4. **Multiple Extractions**: You can extract data multiple times with different page selections - each extraction creates new timestamped files

## API Endpoint

### POST `/api/pdfs/<pdf_id>/extract-data`

**Request Body:**
```json
{
  "selectedPages": {
    "income": [5, 6],
    "balance": [7, 8],
    "cashflow": [9, 10]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Data extracted successfully",
  "pdf_id": "company_name_year",
  "statements_extracted": ["income", "balance", "cashflow"],
  "json_file": "company_name_year_extracted_20260106_120000.json",
  "excel_file": "company_name_year_extracted_20260106_120000.xlsx",
  "output_dir": "/path/to/processed/statement_jsons",
  "total_items": 127
}
```

## Troubleshooting

### No Tables Found
- Ensure the selected pages actually contain tables
- Some PDF formats may not be compatible with table extraction
- Try selecting different pages

### Missing Data
- Complex table layouts may not extract correctly
- Check the Excel file to see what was extracted
- Manual review may be needed for complex statements

### Error During Extraction
- Check the backend logs for detailed error messages
- Ensure the PDF file is not corrupted
- Verify all dependencies are installed (especially `openpyxl`)

## Next Steps

After extraction, you can:
- Import the JSON file into your analysis pipeline
- Open the Excel file for manual review and adjustment
- Use the data for ratio calculations and financial analysis
- Feed the structured data into machine learning models
