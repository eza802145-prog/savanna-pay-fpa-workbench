# Savanna Pay FP&A Workbench — Automated Balance Sheet & Reporting Pack

**Entity:** Savanna Pay Ltd  
**Registered Office:** 125 Itire Road, Lawson Bus Stop, Surulere, Lagos  
**FP&A Desk Contact:** 08060677222 · [ezea80214@gmail.com](mailto:ezea80214@gmail.com)  
**Currency:** Nigerian Naira (NGN)  

---

## Executive Overview

The **Savanna Pay FP&A Workbench** automates the month-end Balance Sheet (Statement of Financial Position) close by replacing manual Trial Balance copy-paste workflows with a repeatable **Power Query ETL pipeline**, a governed **Chart of Accounts (COA) mapping table**, dynamic **`SUMIFS` / `XLOOKUP` reporting schedules**, and **fintech liquidity & safeguarding controls**.

Instead of cleaning raw ERP exports by hand each month, FP&A drops the new period's Trial Balance CSV/Excel export into the source folder and clicks **Refresh All** to produce an audited, multi-period Balance Sheet and Management Dashboard.

---

## Repository Architecture

```text
savanna-pay-fpa-workbench/
├── README.md
├── workbook/
│   └── Savanna_Pay_FPA_Workbench.xlsx
├── data/
│   ├── savanna_pay_tb_2026_01.csv
│   ├── savanna_pay_tb_2026_02.csv
│   └── savanna_pay_coa_mapping.csv
├── power_query/
│   ├── transform_trial_balance.pq
│   └── merge_coa_mapping.pq
└── docs/
    ├── balance_sheet_dashboard.png
    └── power_query_lineage.png
```

---

## Key Fintech Balance Sheet Structure

The Chart of Accounts (`data/savanna_pay_coa_mapping.csv`) and Trial Balances (`data/savanna_pay_tb_*.csv`) model regulated payment-service and digital-lending operations:

| Section | Key Fintech Balance Sheet Lines | Governance Purpose |
|---|---|---|
| **Non-Current Assets** | Fixed Assets (POS Terminals & Hardware), Software Capitalization (Core Switch IP) | Tracks field fleet & proprietary switching platform capex |
| **Current Assets** | Corporate Operating Cash, Restricted Settlement/Escrow Cash, Payment Processor Receivables, Gross Loans to Customers, Loan Loss Allowance, Treasury Bills & Placements | Separates unrestricted corporate cash from CBN-safeguarded escrow funds & IFRS 9 ECL reserves |
| **Current Liabilities** | Customer Wallet Balances, Agent Float Liabilities, Merchant Settlement Payables, Deferred Transaction Revenue, Accrued Processor Fees, Corporate Taxes Payable, Short-term Borrowings | Monitors on-demand e-money obligations, T+1 merchant payouts, and statutory tax accruals |
| **Non-Current Liabilities** | Long-term Borrowings (Series B Venture Debt) | Tracks senior facility leverage & covenant headroom |
| **Equity** | Share Capital, Paid-In Capital (Share Premium), Retained Earnings, Profit for the Period (YTD) | Ties closing Retained Earnings + YTD Net Income from P&L to Balance Sheet |

---

## End-to-End Automation Workflow

### 1. Power Query Ingestion & Cleaning (`power_query/transform_trial_balance.pq`)
1. Connects dynamically via `Folder.Files(...)` to all monthly Trial Balance exports.
2. Strips blank spacer rows, ERP subtotal lines, and footer check rows.
3. Splits combined `Account_Code_Name` (`"1210 - Restricted Settlement/Escrow Cash"`) into explicit `Text` `AccountCode` and `AccountName` keys.
4. Parses currency strings (`"₦41,200,000,000.00"` or `"(₦780,000,000.00)"`) into `Currency.Type` and computes `NetAmount = Debit - Credit`.
5. Deduplicates accidental duplicate rows (`Table.Distinct`) and validates that **Total Debit − Total Credit = 0.00** per period.

### 2. COA Mapping & Exception Catch (`power_query/merge_coa_mapping.pq`)
- Executes a **Left Outer Join** (`JoinKind.LeftOuter`) from `TB_Clean` to `BS_Map` on `AccountCode`.
- Flags any newly introduced GL account as `UNMAPPED` so close blockers surface before management review.
- Applies `PresentationSign` (`+1` Assets, `-1` Liabilities & Equity) to output clean positive balances on the Balance Sheet while preserving contra-asset sign on Loan Loss Allowance.

### 3. Dynamic Output Layer & Close Controls (`Financial_Position`)
- **Formula Engine:** `=SUMIFS(TB_Clean[Presented_Balance], TB_Clean[BS_LineItem], $A10, TB_Clean[Period_Key], B$6)`
- **Accounting Equation Guardrail:** `Assets - Liabilities - Equity = 0.00` verified across every reporting column.
- **Core Fintech Ratios:**
  - **Current Ratio:** `Total Current Assets / Total Current Liabilities` (Target `>= 1.25x`)
  - **Customer Funds Safeguarding Cover:** `Restricted Settlement/Escrow Cash / (Customer Wallet Balances + Agent Float Liabilities)` (Target `>= 100.0%`)
  - **Debt-to-Equity:** `(Short-term Borrowings + Long-term Borrowings) / Total Equity`
  - **Loan Loss Allowance Coverage:** `|Loan Loss Allowance| / Gross Loans to Customers`

---

## Monthly Close Checklist (1-Click Refresh)
1. Export new month-end Trial Balance CSV into `data/`.
2. Click **Data > Refresh All** in Excel (or **Run Nov Refresh** / **Upload CSV** in the web workbench).
3. Confirm **Trial Balance Check = 0.00** and **Unmapped Accounts = 0**.
4. Review Safeguarding Cover (`>= 100%`) and period-over-period variances before publishing.
