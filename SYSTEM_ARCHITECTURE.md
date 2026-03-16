# SYSTEM ARCHITECTURE FOR UNIVERSAL CSE ANNUAL-REPORT ANALYSIS ENGINE

The system must treat every annual report as a structured knowledge source containing financial, operational, governance, risk, and sustainability information. Sri Lankan listed company reports follow the same macro-structure regardless of sector. Banking, diversified holdings, retail, manufacturing, and finance companies all publish the same core components such as financial statements, management discussion, governance disclosures, and value-creation frameworks.

The analysis engine must therefore operate in five layers:

1. Document ingestion and structure detection
2. Data extraction and normalization
3. Derived metrics computation
4. Pattern detection and multi-year analytics
5. Automated analytical report generation

## 1. UNIVERSAL DATA EXTRACTION MODEL

Every annual report should be parsed into standardized entities regardless of company sector.

### A. Corporate Metadata

Extract basic identity data.

**Fields:**
- Company Name
- CSE Ticker Symbol
- Sector / Industry
- Reporting Period
- Financial Year End
- Group vs Company reporting scope
- Subsidiaries
- Auditor
- Reporting frameworks (IFRS, SLFRS, GRI, SASB)

**Purpose:**
Dataset normalization across companies

**Example evidence:** Annual reports specify reporting scope and frameworks used.

## 2. FINANCIAL STATEMENT DATA EXTRACTION

The system must extract every line item from the 4 core statements.

### A. Income Statement

**Raw fields:**
- Revenue
- Cost of Sales
- Gross Profit
- Operating Expenses
- Operating Profit
- Finance Cost
- Profit Before Tax
- Income Tax
- Net Profit
- Other Comprehensive Income

**Derived metrics:**
- Gross Profit Margin
- Operating Margin
- Net Profit Margin
- EBITDA
- EBITDA Margin
- Interest Coverage

**Example:** financial metrics present in reports: revenue, profit, margins, EPS.

### B. Statement of Financial Position (Balance Sheet)

**Assets:**
- Current Assets
- Cash
- Receivables
- Inventories
- Short term investments
- Non Current Assets
- Property Plant Equipment
- Investment property
- Goodwill
- Intangibles

**Liabilities:**
- Current liabilities
- Payables
- Short term debt
- Non current liabilities
- Long term debt
- Deferred tax

**Equity:**
- Share capital
- Retained earnings
- Reserves

**Derived metrics:**
- Current Ratio
- Debt to Equity
- Asset Turnover
- Equity Ratio

### C. Cash Flow Statement

**Operating Activities:**
- Net cash from operations

**Investing Activities:**
- Capex
- acquisitions

**Financing Activities:**
- loans
- dividends
- share issuance

**Derived metrics:**
- Free Cash Flow
- Cash Conversion Ratio
- Capex Ratio

### D. Statement of Changes in Equity

**Extract:**
- Opening equity
- Profit contribution
- Dividend distributions
- Share issues
- Reserve movements

**Purpose:**
Shareholder value tracking

## 3. SHAREHOLDER AND MARKET DATA

Extract market-related metrics.

**Fields:**
- Earnings Per Share
- Dividend Per Share
- Dividend Payout Ratio
- Market Capitalization
- Share Price
- Price Earnings Ratio
- Net Asset Value per Share

**Example:** annual reports contain EPS, dividend, market capitalization and valuation metrics.

**Derived metrics:**
- Dividend Yield
- Market to Book Ratio
- Total Shareholder Return

## 4. SEGMENTAL AND BUSINESS DATA

Extract performance by business segment.

**Examples:**
- **Banking:**
  - retail banking
  - corporate banking
  - treasury
- **Conglomerates:**
  - transportation
  - retail
  - leisure
  - property

**Example:** diversified group reports provide segment performance across industries.

**Fields:**
- Segment Revenue
- Segment Profit
- Segment Assets

**Derived metrics:**
- Segment Growth
- Segment Contribution to Total Revenue

## 5. TEN-YEAR AND MULTI-YEAR DATA

Annual reports normally include 10 year financial summaries.

**Extract:**
- Revenue trend
- Profit trend
- Assets trend
- EPS trend
- Dividend trend

**Derived analytics:**
- CAGR revenue
- CAGR profit
- Profit volatility
- Asset growth

## 6. STRATEGY AND BUSINESS MODEL DATA

Extract qualitative strategy information.

**Fields:**
- Vision
- Mission
- Strategic pillars
- Business model description
- Value creation framework

**Example:** reports describe value creation models and strategy pillars.

**Analysis tasks:**
- strategy shift detection
- investment priorities
- growth initiatives

## 7. RISK ANALYSIS DATA

Extract enterprise risk information.

**Typical categories:**
- Credit risk
- Market risk
- Liquidity risk
- Operational risk
- Cyber risk
- Climate risk

**Purpose:**
- risk trend detection
- regulatory compliance evaluation

## 8. ESG AND SUSTAINABILITY DATA

Extract sustainability metrics.

**Categories:**
- **Environmental:**
  - emissions
  - energy use
  - water consumption
- **Social:**
  - employee count
  - gender diversity
  - training hours
- **Governance:**
  - board structure
  - independent directors

Reports frequently follow global sustainability standards such as GRI or SDGs.

**Derived analytics:**
- ESG score
- Sustainability maturity index

## 9. CAPITAL MODEL ANALYSIS

Integrated reports usually define multiple capital categories.

**Common capitals:**
- Financial capital
- Human capital
- Digital capital
- Social capital
- Natural capital
- Intellectual capital

**Example:** integrated reports describe value creation across multiple capitals.

**Your system must extract:**
- Investments per capital
- Strategic initiatives per capital

## 10. GOVERNANCE DATA EXTRACTION

Extract corporate governance details.

**Fields:**
- Board members
- Independent directors
- Committees:
  - audit committee
  - remuneration committee
  - risk committee
- Director remuneration

**Purpose:**
Governance quality assessment.

## 11. OPERATIONAL KPIs

These vary by sector.

- **Banking:**
  - Loans portfolio
  - Deposit base
  - Non-performing loan ratio
  - Capital adequacy
- **Retail:**
  - Store count
  - Inventory turnover
- **Logistics:**
  - Port throughput
  - Container volume

**System requirement:**
Sector-specific KPI modules.

## 12. MACRO AND INDUSTRY CONTEXT

Extract economic environment information.

**Examples:**
- Inflation
- Interest rates
- GDP outlook

Used to correlate company performance with macro trends.

## 13. PATTERN DETECTION MODULE

After extraction, run advanced analytics.

- **Growth patterns:**
  - Revenue growth acceleration
  - Profit expansion
- **Efficiency patterns:**
  - Margin improvement
  - Cost reduction
- **Financial stability:**
  - Debt growth
  - Liquidity deterioration
- **Shareholder value:**
  - Dividend trend
  - EPS growth
- **Risk signals:**
  - Profit volatility
  - Cash flow stress

## 14. MULTI-COMPANY COMPARISON ENGINE

Once all companies are normalized:

Build comparative datasets.

**Metrics:**
- Sector ranking
- Profitability ranking
- Asset efficiency
- Dividend ranking

**Example:**
- Top banks by ROE
- Top conglomerates by revenue growth

## 15. AUTOMATED REPORT GENERATION

Final output must produce a structured analytical document.

**Structure:**
1. Executive Summary
2. Company Overview
3. Financial Performance Analysis
4. Balance Sheet Analysis
5. Cash Flow Analysis
6. Segment Performance
7. Market Valuation
8. Strategic Direction
9. Risk Assessment
10. ESG Performance
11. Peer Comparison
12. Long Term Financial Trends
13. Final Investment Insight

## 16. RECOMMENDED SYSTEM ARCHITECTURE

**Pipeline:**

```
PDF Reports
      │
Document Parser
      │
Section Classifier
      │
Financial Table Extractor
      │
Text NLP Engine
      │
Structured Financial Database
      │
Analytics Engine
      │
Pattern Detection Models
      │
Report Generator
```

## 17. TECHNOLOGY STACK

**Recommended stack:**

- **Document parsing:**
  - PDFPlumber
  - LayoutLM
  - PaddleOCR
- **Table extraction:**
  - Camelot
  - Tabula
- **NLP:**
  - FinBERT
  - Llama-Index
- **Data storage:**
  - PostgreSQL
  - Vector DB
- **Analytics:**
  - Pandas
  - DuckDB
- **Report generation:**
  - LLM + template engine

## 18. CORE DESIGN PRINCIPLE

Do not build a system tied to one company format.

Instead build a CSE Integrated Reporting Ontology containing standardized entities:
- Company
- FinancialStatement
- Segment
- Capital
- Risk
- Strategy
- ESGMetric
- MarketMetric

Every annual report must be mapped to this ontology.