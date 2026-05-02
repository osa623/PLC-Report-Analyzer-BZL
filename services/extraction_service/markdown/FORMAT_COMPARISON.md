# Extraction Format Comparison

## Old Format (Simple Table Extraction)

### Structure
```json
{
  "statements": {
    "income": {
      "data": {
        "5 (Page 240)": "(8,525,272,891)",
        "6 (Page 240)": "1,077,337,861"
      }
    }
  }
}
```

### Issues
- ❌ Row labels are just numbers ("5", "6")
- ❌ No canonical field names
- ❌ No Bank/Group separation
- ❌ No Year1/Year2 separation
- ❌ Hard to validate completeness
- ❌ Inconsistent across different PDFs

## New Format (Schema-Based Extraction)

### Structure
```json
{
  "data": {
    "Bank": {
      "Year1": {
        "Income_Statement": {
          "Gross income": "150234567890",
          "Interest income": "125678901234",
          "Net interest income": "80000000000"
        }
      },
      "Year2": {
        "Income_Statement": { ... }
      }
    },
    "Group": {
      "Year1": { ... },
      "Year2": { ... }
    }
  }
}
```

### Benefits
- ✅ Canonical field names from schema
- ✅ Bank/Group entities separated
- ✅ Year1/Year2 periods separated
- ✅ Easy to validate against schema
- ✅ Consistent across all PDFs
- ✅ Ready for financial analysis
- ✅ Intelligent label mapping

## Migration Path

The new system completely replaces the old extraction logic. When you click "Extract Data":

1. **Old Way**: 
   - Extract tables → Save whatever labels found → No mapping

2. **New Way**:
   - Extract tables → Interpret columns → Map labels to schema → Organize by Bank/Group/Year

## Example Transformation

### Input (PDF Table)
```
                                Bank        Bank        Group       Group
                                2024        2023        2024        2023
Interest Income                 125.4       120.1       135.8       130.2
Interest Expenses              (45.2)      (43.1)      (48.5)      (46.3)
Net Interest Income             80.2        77.0        87.3        83.9
```

### Old Output
```json
{
  "Interest Income (Page 5)": ["125.4", "120.1", "135.8", "130.2"],
  "Interest Expenses (Page 5)": ["(45.2)", "(43.1)", "(48.5)", "(46.3)"]
}
```

### New Output
```json
{
  "Bank": {
    "Year1": {
      "Income_Statement": {
        "Interest income": "125400000000",
        "Interest expenses": "45200000000",
        "Net interest income": "80200000000"
      }
    },
    "Year2": {
      "Income_Statement": {
        "Interest income": "120100000000",
        "Interest expenses": "43100000000",
        "Net interest income": "77000000000"
      }
    }
  },
  "Group": {
    "Year1": {
      "Income_Statement": {
        "Interest income": "135800000000",
        "Interest expenses": "48500000000",
        "Net interest income": "87300000000"
      }
    },
    "Year2": {
      "Income_Statement": {
        "Interest income": "130200000000",
        "Interest expenses": "46300000000",
        "Net interest income": "83900000000"
      }
    }
  }
}
```

## Key Improvements

### 1. Canonical Field Names
**Before**: "Interest Income (Page 5)"  
**After**: "Interest income" (from schema)

### 2. Entity Separation
**Before**: All values in array  
**After**: Separated into Bank and Group

### 3. Year Separation
**Before**: All years mixed  
**After**: Organized as Year1 and Year2

### 4. Value Normalization
**Before**: "(45.2)" as string  
**After**: "45200000000" as normalized number

### 5. Validation
**Before**: No way to check completeness  
**After**: Compare against STATEMENT_FIELDS schema

### 6. Consistency
**Before**: Different PDFs have different field names  
**After**: All PDFs use same canonical names

## Excel File Comparison

### Old Format
One sheet per statement type:
- Income Statement (mixed Bank/Group/Years)
- Balance Sheet (mixed Bank/Group/Years)
- Cash Flow Statement (mixed Bank/Group/Years)

### New Format
Separate sheets for each combination:
- Bank_Year1_Income_Statement
- Bank_Year2_Income_Statement
- Bank_Year1_Financial Position
- Bank_Year2_Financial Position
- Bank_Year1_Cash Flow Sta
- Bank_Year2_Cash Flow Sta
- Group_Year1_Income_Statement
- Group_Year2_Income_Statement
- (etc.)

Plus comprehensive sheets:
- Bank_Year1_All (all statements combined)
- Bank_Year2_All
- Group_Year1_All
- Group_Year2_All

## For Developers

### Old API Endpoint
```python
# Simple extraction
tables = extract_tables_pdfplumber(pdf_path, page_idx)
for row in table:
    label = row[0]
    values = row[1:]
    data[f"{label} (Page {page})"] = values
```

### New API Endpoint
```python
# Schema-based extraction
tables = extract_tables_pdfplumber(pdf_path, page_idx)
interpretation = column_interpreter.interpret_columns(table)
for row in table:
    label = row[0]
    mapping = mapping_engine.map_label(label, statement_type)
    if mapping.canonical_key:
        for col_idx, value in enumerate(row[1:]):
            entity = interpretation['entity_cols'][col_idx]
            year = interpretation['year_cols'][col_idx]
            data[entity][year][statement_type][mapping.canonical_key] = normalize(value)
```

## Usage Remains The Same

From the user's perspective, the workflow is identical:
1. Select PDF
2. View statements
3. Select pages
4. Click "Extract Data"

The difference is entirely in the output quality and structure!
