export type PeriodKey = 'Aug-26' | 'Sept-26' | 'Oct-26' | 'Nov-26';

export type BalanceSheetSection =
  | 'NON-CURRENT ASSETS'
  | 'CURRENT ASSETS'
  | 'CURRENT LIABILITIES'
  | 'NON-CURRENT LIABILITIES'
  | 'EQUITY';

export type BalanceSheetLineItem =
  | 'Property & Equipment (net)'
  | 'Intangible Assets'
  | 'Cash & Bank - Operating'
  | 'Cash & Bank - Settlement'
  | 'Customer Funds (Restricted)'
  | 'Settlement & Other Receivables'
  | 'Gross Loans to Customers'
  | 'Loan Loss Allowance'
  | 'Treasury Bills & Placements'
  | 'Prepayments & Deferred Tax'
  | 'Customer Wallet Balances'
  | 'Agent Float Liabilities'
  | 'Settlement Payables'
  | 'Trade & Other Payables'
  | 'Tax Payable'
  | 'Short-term Borrowings'
  | 'Long-term Borrowings'
  | 'Share Capital & Premium'
  | 'Retained Earnings b/f'
  | 'Profit for the Period (YTD)';

export interface RawTrialBalanceRow {
  id: string;
  sourceSheet: 'Aug_TB' | 'Sep_TB' | 'Oct_TB' | 'Nov_TB' | 'Custom_TB';
  rawColumns: Record<string, string>;
  rowTypeHint?: 'blank' | 'total' | 'duplicate' | 'valid';
}

export interface CleanedTrialBalanceRow {
  id: string;
  period: PeriodKey;
  periodDate: string;
  sourceSheet: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  netAmount: number; // Debit - Credit (Assets positive, Liabilities/Equity negative)
  bsSection: BalanceSheetSection | 'UNMAPPED';
  bsLineItem: BalanceSheetLineItem | 'UNMAPPED';
  presentationSign: 1 | -1; // Converts TB netAmount into Financial_Position sign
  isMapped: boolean;
}

export interface BSMapEntry {
  accountCode: string;
  accountName: string;
  bsSection: BalanceSheetSection;
  bsLineItem: BalanceSheetLineItem;
  normalBalance: 'Debit' | 'Credit';
  presentationSign: 1 | -1;
  notes?: string;
}

export interface TrialBalanceValidationResult {
  period: PeriodKey;
  sourceSheet: string;
  rowCountRaw: number;
  blankOrTotalRemoved: number;
  duplicatesRemoved: number;
  rowCountClean: number;
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  isZeroBalanced: boolean;
  unmappedCount: number;
  unmappedNetAmount: number;
}

export interface PowerQueryStepSummary {
  stepNumber: number;
  id: string;
  name: string;
  powerQueryFunction: string;
  description: string;
  mCode: string;
  rowsIn: number;
  rowsOut: number;
  issuesResolved: string;
}

export interface LineItemRowResult {
  lineItem: BalanceSheetLineItem;
  section: BalanceSheetSection;
  isContraAsset?: boolean;
  values: Record<PeriodKey, number>;
  changeVsPrior: number;
  changePct: number | null;
  favorableDirection: 'up' | 'down' | 'neutral';
  contributingAccounts: CleanedTrialBalanceRow[];
}

export interface FinancialPositionSummary {
  activePeriods: PeriodKey[];
  latestPeriod: PeriodKey;
  priorPeriod: PeriodKey;
  lineRows: LineItemRowResult[];
  subtotals: {
    nonCurrentAssets: Record<PeriodKey, number>;
    currentAssets: Record<PeriodKey, number>;
    totalAssets: Record<PeriodKey, number>;
    currentLiabilities: Record<PeriodKey, number>;
    nonCurrentLiabilities: Record<PeriodKey, number>;
    totalLiabilities: Record<PeriodKey, number>;
    totalEquity: Record<PeriodKey, number>;
    totalLiabilitiesAndEquity: Record<PeriodKey, number>;
  };
  equationCheck: Record<PeriodKey, number>;
  equationStatus: Record<PeriodKey, 'Balances' | 'Out of Balance'>;
  ratios: {
    currentRatio: Record<PeriodKey, number>;
    safeguardingCoverPct: Record<PeriodKey, number>;
    debtToEquity: Record<PeriodKey, number>;
    loanAllowanceCoveragePct: Record<PeriodKey, number>;
  };
}

export interface DimPeriodEntry {
  periodKey: PeriodKey;
  periodEndDate: string;
  fiscalLabel: string;
  priorPeriod: PeriodKey | null;
  quarter: string;
}

export interface CloseControlItem {
  id: string;
  category: 'Accruals' | 'Reclassifications' | 'Intercompany' | 'Variance Review';
  title: string;
  guidance: string;
  checked: boolean;
  note: string;
}

export type DisplayScale = 'full' | 'millions';

export type WorkspaceView =
  | 'dashboard'
  | 'financial_position'
  | 'power_query'
  | 'worksheets';
