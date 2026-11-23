import {
  BALANCE_SHEET_STRUCTURE,
  ENTITY_PROFILE,
  POWER_QUERY_M_STEPS,
} from '../data/savannaPayData';
import {
  BSMapEntry,
  CleanedTrialBalanceRow,
  DisplayScale,
  FinancialPositionSummary,
  LineItemRowResult,
  PeriodKey,
  PowerQueryStepSummary,
  RawTrialBalanceRow,
  TrialBalanceValidationResult,
} from '../types/fpa';

/**
 * Parses currency strings like "₦3,970,000,000.00", "NGN 883,000,000.00",
 * "(₦960,000,000.0)", or "-" into numeric NGN values.
 */
export function parseCurrencyString(raw: string | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '-' || trimmed === '—') return 0;
  const isParenNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  const cleaned = trimmed
    .replace(/[₦,\s()]/g, '')
    .replace(/^NGN/i, '')
    .trim();
  const parsed = Number.parseFloat(cleaned);
  if (Number.isNaN(parsed)) return 0;
  return isParenNegative ? -Math.abs(parsed) : parsed;
}

/**
 * Normalizes messy period date formats ("2026-08-31", "30/09/2026", "Oct 31, 2026")
 */
export function normalizePeriodFromRaw(
  rawDate: string | undefined,
  sourceSheet: string
): { period: PeriodKey; isoDate: string } {
  if (sourceSheet === 'Aug_TB' || rawDate?.includes('08-31')) {
    return { period: 'Aug-26', isoDate: '2026-08-31' };
  }
  if (sourceSheet === 'Sep_TB' || rawDate?.includes('09/2026')) {
    return { period: 'Sept-26', isoDate: '2026-09-30' };
  }
  if (sourceSheet === 'Oct_TB' || rawDate?.toLowerCase().includes('oct')) {
    return { period: 'Oct-26', isoDate: '2026-10-31' };
  }
  return { period: 'Nov-26', isoDate: '2026-11-30' };
}

/**
 * Splits combined strings like "1010 - Cash & Bank" or "1010 | Cash & Bank"
 */
export function splitAccountCodeAndName(rawAccount: string): {
  accountCode: string;
  accountName: string;
} {
  const delimiterMatch = rawAccount.match(/^(\d{3,6})\s*[-|:]\s*(.+)$/);
  if (delimiterMatch) {
    return {
      accountCode: delimiterMatch[1].trim(),
      accountName: delimiterMatch[2].trim(),
    };
  }
  const parts = rawAccount.split(/\s+/);
  return {
    accountCode: parts[0]?.trim() || '0000',
    accountName: parts.slice(1).join(' ').trim() || rawAccount.trim(),
  };
}

export interface PipelineExecutionOutput {
  cleanRows: CleanedTrialBalanceRow[];
  validations: TrialBalanceValidationResult[];
  steps: PowerQueryStepSummary[];
  unmappedAccounts: Array<{
    accountCode: string;
    accountName: string;
    period: PeriodKey;
    netAmount: number;
  }>;
}

/**
 * Executes the full Power Query consolidation, cleaning, deduplication,
 * BS_Map left-outer merge, and zero-net Trial Balance validation.
 */
export function runPowerQueryPipeline(
  rawSheets: Array<{ period: PeriodKey; sheetName: string; rows: RawTrialBalanceRow[] }>,
  bsMap: BSMapEntry[]
): PipelineExecutionOutput {
  const mapByCode = new Map<string, BSMapEntry>();
  for (const entry of bsMap) {
    mapByCode.set(entry.accountCode.trim(), entry);
  }

  let totalRawRows = 0;
  let totalBlanksAndTotals = 0;
  let totalDuplicates = 0;
  const allCleanRows: CleanedTrialBalanceRow[] = [];
  const validations: TrialBalanceValidationResult[] = [];
  const unmappedAccounts: PipelineExecutionOutput['unmappedAccounts'] = [];

  for (const sheet of rawSheets) {
    totalRawRows += sheet.rows.length;
    let blanksOrTotals = 0;
    let duplicates = 0;
    const seenKeys = new Set<string>();
    const periodCleanRows: CleanedTrialBalanceRow[] = [];

    for (const row of sheet.rows) {
      const cols = row.rawColumns;
      const rawAccount = (
        cols.Account_Code_Name ??
        cols.GL_Account ??
        cols.Account ??
        ''
      ).trim();

      // Step 2: Filter blanks & total rows
      if (!rawAccount) {
        blanksOrTotals += 1;
        continue;
      }
      const upperAcct = rawAccount.toUpperCase();
      if (
        upperAcct.includes('SUBTOTAL') ||
        upperAcct.includes('GRAND TOTAL') ||
        upperAcct.includes('TOTAL TRIAL BALANCE') ||
        upperAcct.includes('TOTAL NOVEMBER TB') ||
        upperAcct.includes('NET TRIAL BALANCE CHECK')
      ) {
        blanksOrTotals += 1;
        continue;
      }

      // Step 3: Split Account Code & Name
      const { accountCode, accountName } = splitAccountCodeAndName(rawAccount);

      // Step 4: Parse date & monetary columns across inconsistent sheet schemas
      const rawDate = cols.ReportDate ?? cols.Posting_Period ?? cols.As_Of ?? '';
      const { period, isoDate } = normalizePeriodFromRaw(rawDate, sheet.sheetName);

      let debit = 0;
      let credit = 0;
      let netAmount = 0;

      if (cols.Net_Balance_Text !== undefined) {
        netAmount = parseCurrencyString(cols.Net_Balance_Text);
        if (netAmount >= 0) {
          debit = netAmount;
        } else {
          credit = Math.abs(netAmount);
        }
      } else {
        debit = parseCurrencyString(cols.Debit_Amt ?? cols.DR_NGN);
        credit = parseCurrencyString(cols.Credit_Amt ?? cols.CR_NGN);
        netAmount = debit - credit;
      }

      // Step 5: Remove duplicate GL rows per period
      const dedupeKey = `${period}::${accountCode}::${netAmount.toFixed(2)}`;
      if (seenKeys.has(dedupeKey)) {
        duplicates += 1;
        continue;
      }
      seenKeys.add(dedupeKey);

      // Step 6: Merge with BS_Map
      const mapped = mapByCode.get(accountCode);
      const isMapped = Boolean(mapped);

      const cleanRow: CleanedTrialBalanceRow = {
        id: `${sheet.sheetName}-${accountCode}`,
        period,
        periodDate: isoDate,
        sourceSheet: sheet.sheetName,
        accountCode,
        accountName,
        debit,
        credit,
        netAmount,
        bsSection: mapped ? mapped.bsSection : 'UNMAPPED',
        bsLineItem: mapped ? mapped.bsLineItem : 'UNMAPPED',
        presentationSign: mapped ? mapped.presentationSign : 1,
        isMapped,
      };

      if (!isMapped) {
        unmappedAccounts.push({
          accountCode,
          accountName,
          period,
          netAmount,
        });
      }

      periodCleanRows.push(cleanRow);
      allCleanRows.push(cleanRow);
    }

    totalBlanksAndTotals += blanksOrTotals;
    totalDuplicates += duplicates;

    const totalDebits = periodCleanRows.reduce((acc, r) => acc + r.debit, 0);
    const totalCredits = periodCleanRows.reduce((acc, r) => acc + r.credit, 0);
    const netBalance = periodCleanRows.reduce((acc, r) => acc + r.netAmount, 0);
    const unmappedInPeriod = periodCleanRows.filter((r) => !r.isMapped);

    validations.push({
      period: sheet.period,
      sourceSheet: sheet.sheetName,
      rowCountRaw: sheet.rows.length,
      blankOrTotalRemoved: blanksOrTotals,
      duplicatesRemoved: duplicates,
      rowCountClean: periodCleanRows.length,
      totalDebits,
      totalCredits,
      netBalance,
      isZeroBalanced: Math.abs(netBalance) < 0.01,
      unmappedCount: unmappedInPeriod.length,
      unmappedNetAmount: unmappedInPeriod.reduce((acc, r) => acc + r.netAmount, 0),
    });
  }

  const afterBlanks = totalRawRows - totalBlanksAndTotals;
  const afterDedupe = afterBlanks - totalDuplicates;

  const steps: PowerQueryStepSummary[] = POWER_QUERY_M_STEPS.map((meta) => {
    switch (meta.id) {
      case 'source':
        return {
          ...meta,
          rowsIn: totalRawRows,
          rowsOut: totalRawRows,
          issuesResolved: `${rawSheets.length} heterogeneous sheets loaded`,
        };
      case 'clean_rows':
        return {
          ...meta,
          rowsIn: totalRawRows,
          rowsOut: afterBlanks,
          issuesResolved: `${totalBlanksAndTotals} blank & total rows removed`,
        };
      case 'split_account':
        return {
          ...meta,
          rowsIn: afterBlanks,
          rowsOut: afterBlanks,
          issuesResolved: `${afterBlanks} account strings split into Code + Name`,
        };
      case 'parse_types':
        return {
          ...meta,
          rowsIn: afterBlanks,
          rowsOut: afterBlanks,
          issuesResolved: `Normalized ₦/NGN text, brackets & ISO dates`,
        };
      case 'dedupe_append':
        return {
          ...meta,
          rowsIn: afterBlanks,
          rowsOut: afterDedupe,
          issuesResolved: `${totalDuplicates} duplicate records removed; consolidated into TB_Clean`,
        };
      case 'merge_map':
      default:
        return {
          ...meta,
          rowsIn: afterDedupe,
          rowsOut: afterDedupe,
          issuesResolved:
            unmappedAccounts.length === 0
              ? `100% accounts mapped (${afterDedupe}/${afterDedupe})`
              : `${unmappedAccounts.length} unmapped GL accounts flagged for BS_Map`,
        };
    }
  });

  return {
    cleanRows: allCleanRows,
    validations,
    steps,
    unmappedAccounts,
  };
}

/**
 * Generates the Management Balance Sheet (Financial_Position) using SUMIFS-style
 * aggregation over TB_Clean and computes subtotals, equation checks, and ratios.
 */
export function buildFinancialPosition(
  cleanRows: CleanedTrialBalanceRow[],
  activePeriods: PeriodKey[],
  focalPeriod?: PeriodKey
): FinancialPositionSummary {
  const latestPeriod =
    focalPeriod && activePeriods.includes(focalPeriod)
      ? focalPeriod
      : activePeriods[activePeriods.length - 1];
  const latestIndex = activePeriods.indexOf(latestPeriod);
  const priorPeriod =
    latestIndex > 0 ? activePeriods[latestIndex - 1] : latestPeriod;

  const emptyRecord = (): Record<PeriodKey, number> => ({
    'Aug-26': 0,
    'Sept-26': 0,
    'Oct-26': 0,
    'Nov-26': 0,
  });

  const lineRows: LineItemRowResult[] = [];

  for (const sectionGroup of BALANCE_SHEET_STRUCTURE) {
    for (const itemMeta of sectionGroup.items) {
      const values = emptyRecord();
      const contributingAccounts = cleanRows.filter(
        (r) => r.bsLineItem === itemMeta.lineItem && activePeriods.includes(r.period)
      );

      for (const period of activePeriods) {
        const periodSum = contributingAccounts
          .filter((r) => r.period === period)
          .reduce((acc, r) => acc + r.netAmount * r.presentationSign, 0);
        values[period] = periodSum;
      }

      const latestVal = values[latestPeriod];
      const priorVal = values[priorPeriod];
      const changeVsPrior = latestVal - priorVal;
      const changePct =
        Math.abs(priorVal) > 0.01 ? (changeVsPrior / Math.abs(priorVal)) * 100 : null;

      lineRows.push({
        lineItem: itemMeta.lineItem,
        section: sectionGroup.section,
        isContraAsset: itemMeta.isContraAsset,
        values,
        changeVsPrior,
        changePct,
        favorableDirection: itemMeta.favorableDirection,
        contributingAccounts,
      });
    }
  }

  const sumSection = (section: string): Record<PeriodKey, number> => {
    const out = emptyRecord();
    for (const period of activePeriods) {
      out[period] = lineRows
        .filter((l) => l.section === section)
        .reduce((acc, l) => acc + l.values[period], 0);
    }
    return out;
  };

  const nonCurrentAssets = sumSection('NON-CURRENT ASSETS');
  const currentAssets = sumSection('CURRENT ASSETS');
  const currentLiabilities = sumSection('CURRENT LIABILITIES');
  const nonCurrentLiabilities = sumSection('NON-CURRENT LIABILITIES');
  const totalEquity = sumSection('EQUITY');

  const totalAssets = emptyRecord();
  const totalLiabilities = emptyRecord();
  const totalLiabilitiesAndEquity = emptyRecord();
  const equationCheck = emptyRecord();
  const equationStatus: Record<PeriodKey, 'Balances' | 'Out of Balance'> = {
    'Aug-26': 'Balances',
    'Sept-26': 'Balances',
    'Oct-26': 'Balances',
    'Nov-26': 'Balances',
  };

  const currentRatio = emptyRecord();
  const safeguardingCoverPct = emptyRecord();
  const debtToEquity = emptyRecord();
  const loanAllowanceCoveragePct = emptyRecord();

  const findLine = (name: string, period: PeriodKey) =>
    lineRows.find((r) => r.lineItem === name)?.values[period] ?? 0;

  for (const period of activePeriods) {
    totalAssets[period] = nonCurrentAssets[period] + currentAssets[period];
    totalLiabilities[period] = currentLiabilities[period] + nonCurrentLiabilities[period];
    totalLiabilitiesAndEquity[period] = totalLiabilities[period] + totalEquity[period];
    equationCheck[period] =
      totalAssets[period] - totalLiabilities[period] - totalEquity[period];
    equationStatus[period] =
      Math.abs(equationCheck[period]) < 1 ? 'Balances' : 'Out of Balance';

    // Ratios
    currentRatio[period] =
      currentLiabilities[period] !== 0
        ? currentAssets[period] / currentLiabilities[period]
        : 0;

    const restrictedCash = findLine('Customer Funds (Restricted)', period);
    const walletPlusAgent =
      findLine('Customer Wallet Balances', period) +
      findLine('Agent Float Liabilities', period);
    safeguardingCoverPct[period] =
      walletPlusAgent !== 0 ? (restrictedCash / walletPlusAgent) * 100 : 0;

    const totalDebt =
      findLine('Short-term Borrowings', period) +
      findLine('Long-term Borrowings', period);
    debtToEquity[period] = totalEquity[period] !== 0 ? totalDebt / totalEquity[period] : 0;

    const grossLoans = findLine('Gross Loans to Customers', period);
    const loanAllowance = Math.abs(findLine('Loan Loss Allowance', period));
    loanAllowanceCoveragePct[period] =
      grossLoans !== 0 ? (loanAllowance / grossLoans) * 100 : 0;
  }

  return {
    activePeriods,
    latestPeriod,
    priorPeriod,
    lineRows,
    subtotals: {
      nonCurrentAssets,
      currentAssets,
      totalAssets,
      currentLiabilities,
      nonCurrentLiabilities,
      totalLiabilities,
      totalEquity,
      totalLiabilitiesAndEquity,
    },
    equationCheck,
    equationStatus,
    ratios: {
      currentRatio,
      safeguardingCoverPct,
      debtToEquity,
      loanAllowanceCoveragePct,
    },
  };
}

/**
 * Formats NGN values matching Excel accounting format:
 * Full mode: 5,150,000,000.0 or (960,000,000.0) or -
 * Millions mode: ₦5,150.0M or (₦960.0M)
 */
export function formatAccountingNgn(
  value: number,
  scale: DisplayScale = 'full',
  showCurrencySymbol = false
): string {
  if (Math.abs(value) < 0.05) return '-';
  const scaled = scale === 'millions' ? value / 1_000_000 : value;
  const absFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(scaled));
  const prefix = showCurrencySymbol ? '₦' : '';
  const suffix = scale === 'millions' ? 'M' : '';
  if (value < 0) {
    return `(${prefix}${absFormatted}${suffix})`;
  }
  return `${prefix}${absFormatted}${suffix}`;
}

export function formatVarianceNgn(
  value: number,
  scale: DisplayScale = 'full'
): string {
  if (Math.abs(value) < 0.05) return '-';
  const scaled = scale === 'millions' ? value / 1_000_000 : value;
  const absFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(scaled));
  const suffix = scale === 'millions' ? 'M' : '';
  return value < 0 ? `(${absFormatted}${suffix})` : `${absFormatted}${suffix}`;
}

/**
 * Generates and downloads a clean CSV matching the Financial_Position statement.
 */
export function downloadFinancialPositionCsv(
  summary: FinancialPositionSummary,
  scale: DisplayScale
) {
  const displayPeriods = [...summary.activePeriods].reverse(); // Latest first, matching Excel screenshot
  const headers = [
    'Section',
    'Line Item',
    ...displayPeriods,
    `Change vs ${summary.priorPeriod}`,
    'Change %',
  ];

  const rows: string[][] = [
    [ENTITY_PROFILE.legalName, ENTITY_PROFILE.address, ENTITY_PROFILE.phone, ENTITY_PROFILE.email],
    ['Management Balance Sheet (Financial Position)', `Units: ${scale === 'full' ? 'NGN' : 'NGN Millions'}`],
    headers,
  ];

  const pushSubtotal = (label: string, rec: Record<PeriodKey, number>) => {
    const latest = rec[summary.latestPeriod];
    const prior = rec[summary.priorPeriod];
    const chg = latest - prior;
    const pct = prior !== 0 ? `${((chg / Math.abs(prior)) * 100).toFixed(1)}%` : '-';
    rows.push([
      '',
      label,
      ...displayPeriods.map((p) => formatAccountingNgn(rec[p], scale)),
      formatVarianceNgn(chg, scale),
      pct,
    ]);
  };

  for (const sectionGroup of BALANCE_SHEET_STRUCTURE) {
    rows.push([sectionGroup.section, '', ...displayPeriods.map(() => ''), '', '']);
    for (const item of sectionGroup.items) {
      const r = summary.lineRows.find((lr) => lr.lineItem === item.lineItem);
      if (!r) continue;
      rows.push([
        sectionGroup.section,
        r.lineItem,
        ...displayPeriods.map((p) => formatAccountingNgn(r.values[p], scale)),
        formatVarianceNgn(r.changeVsPrior, scale),
        r.changePct !== null ? `${r.changePct.toFixed(2)}%` : '-',
      ]);
    }
    if (sectionGroup.section === 'NON-CURRENT ASSETS') {
      pushSubtotal('Total Non-current Assets', summary.subtotals.nonCurrentAssets);
    } else if (sectionGroup.section === 'CURRENT ASSETS') {
      pushSubtotal('Total Current Assets', summary.subtotals.currentAssets);
      pushSubtotal('TOTAL ASSETS', summary.subtotals.totalAssets);
    } else if (sectionGroup.section === 'CURRENT LIABILITIES') {
      pushSubtotal('Total Current Liabilities', summary.subtotals.currentLiabilities);
    } else if (sectionGroup.section === 'NON-CURRENT LIABILITIES') {
      pushSubtotal('Total Non-current Liabilities', summary.subtotals.nonCurrentLiabilities);
      pushSubtotal('TOTAL LIABILITIES', summary.subtotals.totalLiabilities);
    } else if (sectionGroup.section === 'EQUITY') {
      pushSubtotal('Total Equity', summary.subtotals.totalEquity);
      pushSubtotal(
        'TOTAL LIABILITIES & EQUITY',
        summary.subtotals.totalLiabilitiesAndEquity
      );
    }
  }

  const csvContent = rows
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    )
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute(
    'download',
    `Savanna_Pay_Management_Balance_Sheet_${summary.latestPeriod}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses a standard CSV Trial Balance file (e.g. ReportDate,Account_Code_Name,Debit_Amt,Credit_Amt)
 * into RawTrialBalanceRow[] for ingestion by the Power Query pipeline.
 */
export function parseCsvToTrialBalanceRows(csvText: string): RawTrialBalanceRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trimEnd());
  if (lines.length < 2) return [];

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = splitCsvLine(lines[0]);
  const rows: RawTrialBalanceRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      rows.push({
        id: `csv-blank-${i}`,
        sourceSheet: 'Nov_TB',
        rowTypeHint: 'blank',
        rawColumns: headers.reduce((acc, h) => ({ ...acc, [h]: '' }), {}),
      });
      continue;
    }

    const cells = splitCsvLine(line);
    const rawColumns: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rawColumns[h] = cells[idx] ?? '';
    });

    const firstText = Object.values(rawColumns).join(' ').toUpperCase();
    const rowTypeHint =
      firstText.includes('TOTAL') || firstText.includes('CHECK')
        ? 'total'
        : 'valid';

    rows.push({
      id: `csv-row-${i}`,
      sourceSheet: 'Nov_TB',
      rowTypeHint,
      rawColumns,
    });
  }

  return rows;
}

export function downloadSampleNovCsv(rawRows: RawTrialBalanceRow[]) {
  if (rawRows.length === 0) return;
  const headers = Object.keys(rawRows[0].rawColumns);
  const csvLines = [
    headers.join(','),
    ...rawRows.map((r) =>
      headers
        .map((h) => `"${String(r.rawColumns[h] ?? '').replace(/"/g, '""')}"`)
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvLines], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Savanna_Pay_Nov_2026_TB_Export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

