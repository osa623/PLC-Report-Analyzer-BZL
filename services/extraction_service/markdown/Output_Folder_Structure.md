# AI Extractor: Output Folder Structure & Processing Workflow

## 1. Directory Hierarchy
The extracted data is organized hierarchically to facilitate easy retrieval and categorization:

```text
root/
└── [Sector_Name]/               # e.g., Banking, Technology, Energy
    └── [Company_Name]/          # e.g., JPMorgan, Apple, Shell
        └── [Year]/              # e.g., 2023, 2024
            └── [Data_Files].json
```

## 2. Input Naming Convention
To automate the extraction process, input PDF files must follow a standardized naming format:
- **Format:** `{SectorName}_{CompanyName}_{Year}.pdf`
- **Example:** `Banking_GoldmanSachs_2023.pdf`

## 3. Automation Logic
The system follows these steps to process a file:

1.  **Filename Parsing:** Split the input filename by the underscore (`_`) delimiter to identify the `Sector`, `Company`, and `Year`.
2.  **Directory Validation:** Check if the path `/[Sector]/[Company]/[Year]/` exists; if not, create it recursively.
3.  **Data Extraction:** Run the AI extraction model on the source PDF.
4.  **File Serialization:** Save the resulting JSON outputs (e.g., balance sheets, cash flows, metadata) into the calculated directory.
