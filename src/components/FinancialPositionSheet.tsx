import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  BALANCE_SHEET_STRUCTURE,
  DIM_PERIOD_TABLE,
  ENTITY_PROFILE,
} from '../data/savannaPayData';
import {
  BalanceSheetLineItem,
  CloseControlItem,
  DisplayScale,
  FinancialPositionSummary,
  LineItemRowResult,
  PeriodKey,
} from '../types/fpa';
import { formatAccountingNgn, formatVarianceNgn } from '../utils/powerQueryEngine';

interface FinancialPositionSheetProps {
  summary: FinancialPositionSummary;
  displayScale: DisplayScale;
  focalPeriod: PeriodKey;
  onChangeFocalPeriod: (period: PeriodKey) => void;
  unmappedCount: number;
  unmappedNetAmount: number;
  closeControls: CloseControlItem[];
  onToggleControl: (id: string) => void;
  onUpdateControlNote: (id: string, note: string) => void;
  onJumpToMap: () => void;
  onAutoMapSuggested: () => void;
}

type SelectedInspect =
  | { type: 'line'; data: LineItemRowResult }
  | {
      type: 'ratio';
      name: string;
      formula: string;
      interpretation: string;
      values: Record<PeriodKey, string>;
    }
  | {
      type: 'subtotal';
      name: string;
      formula: string;
      interpretation: string;
      values: Record<PeriodKey, number>;
    };

export function FinancialPositionSheet({
  summary,
  displayScale,
  focalPeriod,
  onChangeFocalPeriod,
  unmappedCount,
  unmappedNetAmount,
  closeControls,
  onToggleControl,
  onUpdateControlNote,
  onJumpToMap,
  onAutoMapSuggested,
}: FinancialPositionSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInspect, setSelectedInspect] = useState<SelectedInspect | null>(null);
  const [outputMode, setOutputMode] = useState<'statement' | 'pivot'>('statement');
  const [pivotGroupSlicer, setPivotGroupSlicer] = useState<
    'ALL' | 'Assets' | 'Liabilities' | 'Equity'
  >('ALL');
  const [pivotPeriodSlicer, setPivotPeriodSlicer] = useState<PeriodKey | 'ALL'>('ALL');
  const [showCloseControls, setShowCloseControls] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [copiedEntity, setCopiedEntity] = useState(false);

  const handleCopyEntity = async () => {
    const text = `${ENTITY_PROFILE.legalName}\n${ENTITY_PROFILE.address}\nTel: ${ENTITY_PROFILE.phone}\nEmail: ${ENTITY_PROFILE.email}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard fallback handled cleanly by visual confirmation
    }
    setCopiedEntity(true);
    setTimeout(() => setCopiedEntity(false), 1800);
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Display periods latest-first to match the Excel reporting sheet
  const displayPeriods = useMemo(
    () => [...summary.activePeriods].reverse(),
    [summary.activePeriods]
  );

  const latestPeriod = summary.latestPeriod;
  const priorPeriod = summary.priorPeriod;

  const isLatestBalanced = summary.equationStatus[latestPeriod] === 'Balances';
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const SUBTOTAL_LESSONS: Record<string, { formula: string; interpretation: string }> = {
    'Total Non-current Assets': {
      formula: '=SUM(Property & Equipment, Intangible Assets)',
      interpretation:
        'Long-term infrastructure and software IP expected to generate economic value beyond 12 months.',
    },
    'Total Current Assets': {
      formula: '=SUM(Operating Cash : Prepayments & Deferred Tax)',
      interpretation:
        'Cash, restricted safeguarding escrow, T+1 settlement receivables, net loans, and liquid T-bills convertible within 12 months.',
    },
    'TOTAL ASSETS': {
      formula: '=Total Non-current Assets + Total Current Assets',
      interpretation:
        'Complete economic resources controlled by Savanna Pay. Must equal Total Liabilities & Equity at every period close.',
    },
    'Total Current Liabilities': {
      formula: '=SUM(Customer Wallet Balances : Short-term Borrowings)',
      interpretation:
        'On-demand customer stored value, agent float, settlement clearing obligations, and credit lines due within 12 months.',
    },
    'Total Non-current Liabilities': {
      formula: '=Long-term Borrowings',
      interpretation:
        'Long-dated venture debt and multi-year obligations maturing beyond 12 months.',
    },
    'TOTAL LIABILITIES': {
      formula: '=Total Current Liabilities + Total Non-current Liabilities',
      interpretation:
        'Total third-party claims (customer stored value + payables + debt) against company assets.',
    },
    'Total Equity': {
      formula: '=SUM(Share Capital, Retained Earnings b/f, Profit YTD)',
      interpretation:
        'Residual shareholder ownership interest, compounding each month as YTD net profit flows from the P&L pack.',
    },
    'TOTAL LIABILITIES & EQUITY': {
      formula: '=TOTAL LIABILITIES + Total Equity',
      interpretation:
        'Total funding structure (customer float, debt, and equity capital) financing Total Assets.',
    },
  };

  const renderSubtotalRow = (
    label: string,
    values: Record<PeriodKey, number>,
    isGrandTotal = false
  ) => {
    const latestVal = values[latestPeriod];
    const priorVal = values[priorPeriod];
    const change = latestVal - priorVal;
    const changePct =
      Math.abs(priorVal) > 0.01 ? (change / Math.abs(priorVal)) * 100 : null;
    const lesson = SUBTOTAL_LESSONS[label];
    const isSelected =
      selectedInspect?.type === 'subtotal' && selectedInspect.name === label;

    return (
      <tr
        key={label}
        onClick={() =>
          lesson &&
          setSelectedInspect({
            type: 'subtotal',
            name: label,
            formula: lesson.formula,
            interpretation: lesson.interpretation,
            values,
          })
        }
        className={`font-semibold text-slate-950 cursor-pointer transition-colors ${
          isSelected ? 'bg-emerald-50/80' : 'bg-white hover:bg-slate-50'
        } ${
          isGrandTotal
            ? 'border-t border-slate-900 border-b-4 border-b-double'
            : 'border-t border-slate-400 border-b border-slate-300'
        }`}
      >
        <td className="py-2 px-3 text-[13px] tracking-tight whitespace-nowrap">
          {label}
        </td>
        {displayPeriods.map((period) => (
          <td
            key={period}
            className="py-2 px-3 text-right font-mono text-[13px] tabular-nums whitespace-nowrap"
          >
            {formatAccountingNgn(values[period], displayScale)}
          </td>
        ))}
        <td className="py-2 px-3 text-right font-mono text-[13px] tabular-nums whitespace-nowrap">
          {formatVarianceNgn(change, displayScale)}
        </td>
        <td className="py-2 px-3 text-right font-mono text-[13px] tabular-nums whitespace-nowrap">
          {changePct !== null ? `${changePct.toFixed(1)}%` : '-'}
        </td>
      </tr>
    );
  };

  const renderLineRow = (lineItem: BalanceSheetLineItem) => {
    const row = summary.lineRows.find((r) => r.lineItem === lineItem);
    if (!row) return null;

    if (
      normalizedQuery &&
      !row.lineItem.toLowerCase().includes(normalizedQuery) &&
      !row.section.toLowerCase().includes(normalizedQuery)
    ) {
      return null;
    }

    const isSelected =
      selectedInspect?.type === 'line' &&
      selectedInspect.data.lineItem === row.lineItem;

    // Color convention from Savanna Pay sheet:
    // Positive asset/equity/liability increases in green, decreases or contra-asset increases in crimson
    const hasChange = Math.abs(row.changeVsPrior) >= 0.05;
    let varianceColor = 'text-slate-600';
    if (hasChange) {
      if (row.isContraAsset) {
        // Increasing allowance (more negative) shown in crimson like screenshot
        varianceColor = row.changeVsPrior < 0 ? 'text-red-600' : 'text-emerald-700';
      } else {
        varianceColor = row.changeVsPrior > 0 ? 'text-emerald-700' : 'text-red-600';
      }
    }

    const formattedAbsPct =
      row.changePct !== null
        ? `${
            row.isContraAsset
              ? Math.abs(row.changePct).toFixed(2)
              : row.changePct.toFixed(2)
          }%`
        : '-';

    const displayVarianceAmount = row.isContraAsset
      ? Math.abs(row.changeVsPrior)
      : row.changeVsPrior;

    return (
      <tr
        key={row.lineItem}
        onClick={() => setSelectedInspect({ type: 'line', data: row })}
        className={`border-b border-slate-100 cursor-pointer transition-colors ${
          isSelected
            ? 'bg-emerald-50/80'
            : 'hover:bg-slate-50'
        }`}
      >
        <td className="py-1.5 px-3 text-[13px] font-medium text-blue-800 hover:underline whitespace-nowrap">
          {row.lineItem}
        </td>
        {displayPeriods.map((period) => (
          <td
            key={period}
            className="py-1.5 px-3 text-right font-mono text-[13px] tabular-nums text-slate-900 whitespace-nowrap"
          >
            {formatAccountingNgn(row.values[period], displayScale)}
          </td>
        ))}
        <td
          className={`py-1.5 px-3 text-right font-mono text-[13px] tabular-nums whitespace-nowrap ${varianceColor}`}
        >
          {hasChange
            ? row.isContraAsset
              ? formatAccountingNgn(displayVarianceAmount, displayScale)
              : formatVarianceNgn(row.changeVsPrior, displayScale)
            : '-'}
        </td>
        <td
          className={`py-1.5 px-3 text-right font-mono text-[13px] tabular-nums whitespace-nowrap ${varianceColor}`}
        >
          {hasChange ? formattedAbsPct : row.changePct === 0 ? '0.00%' : '-'}
        </td>
      </tr>
    );
  };

  const ratioDefinitions = [
    {
      name: 'Current ratio (x)',
      formula: '= Total Current Assets / Total Current Liabilities',
      interpretation:
        'Measures short-term liquidity coverage against obligations due within 12 months. Benchmark >= 1.25x.',
      format: (p: PeriodKey) => `${summary.ratios.currentRatio[p].toFixed(2)}x`,
      changeText: `${(
        summary.ratios.currentRatio[latestPeriod] -
        summary.ratios.currentRatio[priorPeriod]
      ).toFixed(2)}x`,
    },
    {
      name: 'Safeguarding cover (%)',
      formula:
        '= Customer Funds (Restricted) / (Customer Wallet Balances + Agent Float Liabilities)',
      interpretation:
        'Regulatory ring-fencing ratio verifying restricted escrow accounts cover 100% of stored wallet and agent float liabilities.',
      format: (p: PeriodKey) =>
        `${summary.ratios.safeguardingCoverPct[p].toFixed(1)}%`,
      changeText: `${(
        summary.ratios.safeguardingCoverPct[latestPeriod] -
        summary.ratios.safeguardingCoverPct[priorPeriod]
      ).toFixed(1)}%`,
      flagBelow100: true,
    },
    {
      name: 'Debt-to-equity (x)',
      formula: '= (Short-term Borrowings + Long-term Borrowings) / Total Equity',
      interpretation:
        'Tracks financial leverage relative to shareholder equity capital.',
      format: (p: PeriodKey) => `${summary.ratios.debtToEquity[p].toFixed(2)}x`,
      changeText: `${(
        summary.ratios.debtToEquity[latestPeriod] -
        summary.ratios.debtToEquity[priorPeriod]
      ).toFixed(2)}x`,
    },
    {
      name: 'Loan allowance coverage (%)',
      formula: '= ABS(Loan Loss Allowance) / Gross Loans to Customers',
      interpretation:
        'Measures IFRS 9 expected credit loss reserve depth against gross customer and merchant loan exposures.',
      format: (p: PeriodKey) =>
        `${summary.ratios.loanAllowanceCoveragePct[p].toFixed(1)}%`,
      changeText: `${(
        summary.ratios.loanAllowanceCoveragePct[latestPeriod] -
        summary.ratios.loanAllowanceCoveragePct[priorPeriod]
      ).toFixed(1)}%`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Unmapped Account Alert when Nov_TB introduces new GL codes */}
      {unmappedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-amber-950">
                {unmappedCount} Unmapped GL {unmappedCount === 1 ? 'Account' : 'Accounts'} Detected in {latestPeriod}
              </h2>
              <p className="text-xs text-amber-900 mt-1">
                The {latestPeriod} Trial Balance balances to zero (0.00), but unmapped accounts create a net Balance Sheet variance of{' '}
                <span className="font-mono font-semibold">
                  {formatAccountingNgn(unmappedNetAmount, displayScale, true)}
                </span>{' '}
                until assigned in BS_Map.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onAutoMapSuggested}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Auto-Map Suggested Accounts
            </button>
            <button
              type="button"
              onClick={onJumpToMap}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Review in BS_Map
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Statement Header + Period Switcher + Mode Toggle */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-950 tracking-tight">
              Savanna Pay | Management Balance Sheet (Financial Position),{' '}
              {DIM_PERIOD_TABLE.find((d) => d.periodKey === latestPeriod)?.fiscalLabel ??
                latestPeriod}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Units: {displayScale === 'full' ? 'NGN' : 'NGN (Millions)'} · Comparing{' '}
              <span className="font-medium text-slate-700">{latestPeriod}</span> vs{' '}
              <span className="font-medium text-slate-700">{priorPeriod}</span> · Click any line item to inspect SUMIFS / XLOOKUP logic
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-700 shrink-0" />
                {ENTITY_PROFILE.address}
              </span>
              <a
                href={`tel:${ENTITY_PROFILE.phone}`}
                className="inline-flex items-center gap-1 hover:text-emerald-800 hover:underline underline-offset-2"
              >
                <Phone className="w-3 h-3 text-emerald-700 shrink-0" />
                {ENTITY_PROFILE.phone}
              </a>
              <a
                href={`mailto:${ENTITY_PROFILE.email}`}
                className="inline-flex items-center gap-1 hover:text-emerald-800 hover:underline underline-offset-2"
              >
                <Mail className="w-3 h-3 text-emerald-700 shrink-0" />
                {ENTITY_PROFILE.email}
              </a>
              <button
                type="button"
                onClick={handleCopyEntity}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-800 cursor-pointer"
                title="Copy entity contact details"
              >
                {copiedEntity ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span className="text-emerald-700 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Contact</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period Selector from Date / Period Table */}
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="focal-period-select"
                className="text-xs font-medium text-slate-600 whitespace-nowrap"
              >
                Period:
              </label>
              <select
                id="focal-period-select"
                value={focalPeriod}
                onChange={(e) => onChangeFocalPeriod(e.target.value as PeriodKey)}
                className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 focus:outline-none focus:border-emerald-700 cursor-pointer"
              >
                {summary.activePeriods.map((p) => {
                  const meta = DIM_PERIOD_TABLE.find((d) => d.periodKey === p);
                  return (
                    <option key={p} value={p}>
                      {p} ({meta?.periodEndDate ?? p})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Output Layer Mode: SUMIFS Statement vs Pivot & Slicers */}
            <div
              className="flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200"
              role="group"
              aria-label="Output layer mode"
            >
              <button
                type="button"
                onClick={() => setOutputMode('statement')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  outputMode === 'statement'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Statement (SUMIFS)
              </button>
              <button
                type="button"
                onClick={() => setOutputMode('pivot')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  outputMode === 'pivot'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pivot &amp; Slicers
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter line items..."
                className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 w-44"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear filter"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pivot Slicers Bar when Pivot Mode is Active */}
        {outputMode === 'pivot' && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Account Group Slicer:
                </span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200">
                  {(['ALL', 'Assets', 'Liabilities', 'Equity'] as const).map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setPivotGroupSlicer(grp)}
                      className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        pivotGroupSlicer === grp
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {grp === 'ALL' ? 'All Groups' : grp}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700">
                  Period Slicer:
                </span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200">
                  {(['ALL', ...summary.activePeriods] as Array<PeriodKey | 'ALL'>).map(
                    (p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPivotPeriodSlicer(p)}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          pivotPeriodSlicer === p
                            ? 'bg-emerald-800 text-white'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {p === 'ALL' ? 'All Periods' : p}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs text-slate-500">
              PivotTable source: TB_Clean Data Model
            </span>
          </div>
        )}

        {/* Main Split Layout: Financial Statement Grid + Optional Drilldown Drawer */}
        <div className="grid grid-cols-1 xl:grid-cols-12">
          <div
            className={`${
              selectedInspect ? 'xl:col-span-8 border-b xl:border-b-0 xl:border-r border-slate-200' : 'xl:col-span-12'
            } overflow-x-auto`}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-white text-xs font-semibold">
                  <th className="py-2.5 px-3 bg-[#1A365D] min-w-[240px]">
                    {outputMode === 'pivot' ? 'Row Labels (Section / Line Item)' : 'Line item'}
                  </th>
                  {(outputMode === 'pivot' && pivotPeriodSlicer !== 'ALL'
                    ? [pivotPeriodSlicer]
                    : displayPeriods
                  ).map((period) => (
                    <th
                      key={period}
                      className={`py-2.5 px-3 text-right min-w-[138px] whitespace-nowrap ${
                        period === latestPeriod ? 'bg-[#2c5c1b]' : 'bg-[#3B7326]'
                      }`}
                    >
                      {period}
                    </th>
                  ))}
                  {outputMode === 'statement' && (
                    <>
                      <th className="py-2.5 px-3 bg-[#3B7326] text-right min-w-[138px] whitespace-nowrap">
                        Change vs{' '}
                        {priorPeriod === 'Sept-26'
                          ? 'Sep'
                          : priorPeriod.replace('-26', '')}
                      </th>
                      <th className="py-2.5 px-3 bg-[#3B7326] text-right min-w-[92px] whitespace-nowrap">
                        Change %
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody>
                {BALANCE_SHEET_STRUCTURE.filter((sec) => {
                  if (outputMode !== 'pivot' || pivotGroupSlicer === 'ALL') return true;
                  if (pivotGroupSlicer === 'Assets') return sec.section.includes('ASSETS');
                  if (pivotGroupSlicer === 'Liabilities')
                    return sec.section.includes('LIABILITIES');
                  return sec.section === 'EQUITY';
                }).map((sectionGroup) => {
                  const visibleItems = sectionGroup.items.filter((item) =>
                    normalizedQuery
                      ? item.lineItem.toLowerCase().includes(normalizedQuery) ||
                        sectionGroup.section.toLowerCase().includes(normalizedQuery)
                      : true
                  );

                  if (normalizedQuery && visibleItems.length === 0) {
                    return null;
                  }

                  const activeCols =
                    outputMode === 'pivot' && pivotPeriodSlicer !== 'ALL'
                      ? [pivotPeriodSlicer]
                      : displayPeriods;

                  if (outputMode === 'pivot') {
                    const isSecCollapsed = Boolean(collapsedSections[sectionGroup.section]);
                    return (
                      <SectionBlock
                        key={sectionGroup.section}
                        section={sectionGroup.section}
                        colSpan={activeCols.length + 1}
                        isCollapsed={isSecCollapsed}
                        onToggle={() => toggleSection(sectionGroup.section)}
                      >
                        {!isSecCollapsed &&
                          visibleItems.map((item) => {
                            const row = summary.lineRows.find(
                              (r) => r.lineItem === item.lineItem
                            );
                            if (!row) return null;
                            return (
                              <tr
                                key={row.lineItem}
                                onClick={() =>
                                  setSelectedInspect({ type: 'line', data: row })
                                }
                                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                              >
                                <td className="py-1.5 px-3 pl-6 text-[13px] text-slate-800 whitespace-nowrap">
                                  {row.lineItem}
                                </td>
                                {activeCols.map((period) => (
                                  <td
                                    key={period}
                                    className="py-1.5 px-3 text-right font-mono text-[13px] tabular-nums text-slate-900 whitespace-nowrap"
                                  >
                                    {formatAccountingNgn(row.values[period], displayScale)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                      </SectionBlock>
                    );
                  }

                  const isSecCollapsed = Boolean(collapsedSections[sectionGroup.section]);

                  return (
                    <SectionBlock
                      key={sectionGroup.section}
                      section={sectionGroup.section}
                      colSpan={displayPeriods.length + 3}
                      isCollapsed={isSecCollapsed}
                      onToggle={() => toggleSection(sectionGroup.section)}
                    >
                      {!isSecCollapsed &&
                        visibleItems.map((item) => renderLineRow(item.lineItem))}
                      {!normalizedQuery &&
                        sectionGroup.section === 'NON-CURRENT ASSETS' &&
                        renderSubtotalRow(
                          'Total Non-current Assets',
                          summary.subtotals.nonCurrentAssets
                        )}
                      {!normalizedQuery &&
                        sectionGroup.section === 'CURRENT ASSETS' && (
                          <>
                            {renderSubtotalRow(
                              'Total Current Assets',
                              summary.subtotals.currentAssets
                            )}
                            {renderSubtotalRow(
                              'TOTAL ASSETS',
                              summary.subtotals.totalAssets,
                              true
                            )}
                          </>
                        )}
                      {!normalizedQuery &&
                        sectionGroup.section === 'CURRENT LIABILITIES' &&
                        renderSubtotalRow(
                          'Total Current Liabilities',
                          summary.subtotals.currentLiabilities
                        )}
                      {!normalizedQuery &&
                        sectionGroup.section === 'NON-CURRENT LIABILITIES' && (
                          <>
                            {renderSubtotalRow(
                              'Total Non-current Liabilities',
                              summary.subtotals.nonCurrentLiabilities
                            )}
                            {renderSubtotalRow(
                              'TOTAL LIABILITIES',
                              summary.subtotals.totalLiabilities,
                              true
                            )}
                          </>
                        )}
                      {!normalizedQuery &&
                        sectionGroup.section === 'EQUITY' && (
                          <>
                            {renderSubtotalRow(
                              'Total Equity',
                              summary.subtotals.totalEquity
                            )}
                            {renderSubtotalRow(
                              'TOTAL LIABILITIES & EQUITY',
                              summary.subtotals.totalLiabilitiesAndEquity,
                              true
                            )}
                          </>
                        )}
                    </SectionBlock>
                  );
                })}

                {/* Accounting Equation Check Rows */}
                {outputMode === 'statement' && !normalizedQuery && (
                  <>
                    <tr
                      onClick={() =>
                        setSelectedInspect({
                          type: 'subtotal',
                          name: 'Check: Assets - Liabilities - Equity',
                          formula: '=TOTAL ASSETS - TOTAL LIABILITIES - Total Equity',
                          interpretation:
                            'Automated close control verifying the fundamental accounting equation equals 0.00 before management reporting release. Any non-zero variance signals an unmapped GL account or unbalanced Trial Balance.',
                          values: summary.equationCheck,
                        })
                      }
                      className="bg-slate-50/70 hover:bg-slate-100/70 border-t border-slate-300 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 text-[13px] font-semibold text-slate-900">
                        Check: Assets - Liabilities - Equity
                      </td>
                      {displayPeriods.map((period) => (
                        <td
                          key={period}
                          className={`py-2 px-3 text-right font-mono text-[13px] tabular-nums font-semibold ${
                            Math.abs(summary.equationCheck[period]) < 1
                              ? 'text-slate-700'
                              : 'text-red-700'
                          }`}
                        >
                          {formatAccountingNgn(summary.equationCheck[period], displayScale)}
                        </td>
                      ))}
                      <td className="py-2 px-3" />
                      <td className="py-2 px-3" />
                    </tr>
                    <tr
                      onClick={() =>
                        setSelectedInspect({
                          type: 'subtotal',
                          name: 'Check: Assets - Liabilities - Equity',
                          formula: '=IF(ABS(Check)<1, "Balances", "Out of Balance")',
                          interpretation:
                            'Automated status gate checking whether the Balance Sheet reconciles cleanly across every period.',
                          values: summary.equationCheck,
                        })
                      }
                      className="bg-slate-50/70 hover:bg-slate-100/70 border-b border-slate-300 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 text-[13px] font-semibold text-slate-900">
                        Status
                      </td>
                      {displayPeriods.map((period) => {
                        const ok = summary.equationStatus[period] === 'Balances';
                        return (
                          <td
                            key={period}
                            className={`py-2 px-3 text-right text-[13px] font-bold ${
                              ok ? 'text-emerald-800' : 'text-red-700'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1 justify-end">
                              {ok ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              )}
                              {summary.equationStatus[period]}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-2 px-3" />
                      <td className="py-2 px-3" />
                    </tr>

                    {/* KEY RATIOS SECTION */}
                    <tr className="bg-[#DCE6F1] border-t border-slate-300">
                      <td
                        colSpan={displayPeriods.length + 3}
                        className="py-2 px-3 text-xs font-bold text-[#1A365D] tracking-wide"
                      >
                        KEY RATIOS
                      </td>
                    </tr>
                    {ratioDefinitions.map((ratio) => {
                      const valuesMap = {} as Record<PeriodKey, string>;
                      for (const p of summary.activePeriods) {
                        valuesMap[p] = ratio.format(p);
                      }
                      const isRatioSelected =
                        selectedInspect?.type === 'ratio' &&
                        selectedInspect.name === ratio.name;

                      return (
                        <tr
                          key={ratio.name}
                          onClick={() =>
                            setSelectedInspect({
                              type: 'ratio',
                              name: ratio.name,
                              formula: ratio.formula,
                              interpretation: ratio.interpretation,
                              values: valuesMap,
                            })
                          }
                          className={`border-b border-slate-100 cursor-pointer transition-colors ${
                            isRatioSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-2 px-3 text-[13px] font-semibold text-slate-900">
                            {ratio.name}
                          </td>
                          {displayPeriods.map((period) => {
                            const val = summary.ratios.safeguardingCoverPct[period];
                            const warn = ratio.flagBelow100 && val < 100;
                            return (
                              <td
                                key={period}
                                className={`py-2 px-3 text-right font-mono text-[13px] tabular-nums ${
                                  warn
                                    ? 'text-red-700 font-semibold'
                                    : 'text-slate-900'
                                }`}
                              >
                                {ratio.format(period)}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-right font-mono text-[13px] tabular-nums text-slate-700">
                            {ratio.changeText}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[13px] text-slate-400">
                            -
                          </td>
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Drilldown & SUMIFS Inspector Panel */}
          {selectedInspect && (
            <aside className="xl:col-span-4 bg-slate-50/70 p-5 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium text-emerald-800">
                    {selectedInspect.type === 'line'
                      ? 'SUMIFS Line Item Drilldown'
                      : 'Financial Ratio Formula'}
                  </span>
                  <h3 className="text-base font-bold text-slate-950 mt-0.5">
                    {selectedInspect.type === 'line'
                      ? selectedInspect.data.lineItem
                      : selectedInspect.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedInspect(null)}
                  aria-label="Close drilldown panel"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/70 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedInspect.type === 'line' ? (
                <>
                  {/* Excel SUMIFS & XLOOKUP Formula Box */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                      <Calculator className="w-3.5 h-3.5 text-emerald-700" />
                      Dynamic Excel Formulas ({latestPeriod})
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">
                        SUMIFS Aggregation
                      </div>
                      <code className="block font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 break-words">
                        =SUMIFS(TB_Clean[Presented_Amt], TB_Clean[BS_Line_Item], &quot;
                        {selectedInspect.data.lineItem}&quot;, TB_Clean[Period], $C$2)
                      </code>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-500 mb-1">
                        XLOOKUP Period Switcher (Dim_Period)
                      </div>
                      <code className="block font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 break-words">
                        =XLOOKUP($C$2, Dim_Period[PeriodKey], Dim_Period[PeriodEndDate])
                      </code>
                    </div>
                  </div>

                  {/* Contributing GL Accounts */}
                  <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                    <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800">
                        Contributing GL Accounts (TB_Clean)
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {latestPeriod}
                      </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {selectedInspect.data.contributingAccounts
                        .filter((acc) => acc.period === latestPeriod)
                        .map((acc) => (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={onJumpToMap}
                            title="Click to inspect or edit this GL mapping in BS_Map"
                            className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-mono font-semibold text-blue-800">
                                {acc.accountCode}
                              </div>
                              <div className="text-xs text-slate-600 truncate">
                                {acc.accountName}
                              </div>
                            </div>
                            <div className="font-mono text-xs font-semibold text-slate-900 tabular-nums shrink-0">
                              {formatAccountingNgn(
                                acc.netAmount * acc.presentationSign,
                                displayScale
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  </div>

                  {/* Period Trajectory Table */}
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-xs font-semibold text-slate-800 mb-2">
                      Historical Trajectory
                    </div>
                    <div className="space-y-1.5">
                      {displayPeriods.map((p) => (
                        <div
                          key={p}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600 font-medium">{p}</span>
                          <span className="font-mono tabular-nums text-slate-900 font-semibold">
                            {formatAccountingNgn(
                              selectedInspect.data.values[p],
                              displayScale,
                              true
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : selectedInspect.type === 'subtotal' ? (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-xs font-semibold text-slate-700 mb-1.5">
                      Excel Formula
                    </div>
                    <code className="block font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedInspect.formula}
                    </code>
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                      {selectedInspect.interpretation}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-xs font-semibold text-slate-800 mb-2">
                      Period Totals
                    </div>
                    <div className="space-y-1.5">
                      {displayPeriods.map((p) => (
                        <div
                          key={p}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600 font-medium">{p}</span>
                          <span className="font-mono tabular-nums text-slate-900 font-semibold">
                            {formatAccountingNgn(
                              selectedInspect.values[p],
                              displayScale,
                              true
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-xs font-semibold text-slate-700 mb-1.5">
                      Formula Definition
                    </div>
                    <code className="block font-mono text-[11px] leading-relaxed text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedInspect.formula}
                    </code>
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                      {selectedInspect.interpretation}
                    </p>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-lg p-3.5">
                    <div className="text-xs font-semibold text-slate-800 mb-2">
                      Period Progression
                    </div>
                    <div className="space-y-1.5">
                      {displayPeriods.map((p) => (
                        <div
                          key={p}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600 font-medium">{p}</span>
                          <span className="font-mono tabular-nums text-slate-900 font-semibold">
                            {selectedInspect.values[p]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* Month-End Close Controls & FP&A Governance */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setShowCloseControls((prev) => !prev)}
          className="w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-800 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-950">
                FP&amp;A Month-End Close Controls &amp; Governance ({latestPeriod})
              </h2>
              <p className="text-xs text-slate-500">
                {closeControls.filter((c) => c.checked).length} of {closeControls.length} judgment sign-offs complete · Automated balance check:{' '}
                {isLatestBalanced ? 'Pass' : 'Variance Detected'}
              </p>
            </div>
          </div>
          {showCloseControls ? (
            <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
          )}
        </button>

        {showCloseControls && (
          <div className="border-t border-slate-200 p-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Judgment Checklist */}
            <div className="lg:col-span-8 divide-y divide-slate-100">
              {closeControls.map((ctrl) => (
                <div key={ctrl.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ctrl.checked}
                      onChange={() => onToggleControl(ctrl.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900">
                          {ctrl.title}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{ctrl.category}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {ctrl.guidance}
                      </p>
                    </div>
                  </label>
                  <div className="pl-7">
                    <input
                      type="text"
                      value={ctrl.note}
                      onChange={(e) => onUpdateControlNote(ctrl.id, e.target.value)}
                      placeholder="Add close reviewer note..."
                      className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Auto-Detected Material MoM Movers (>10%) */}
            <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-bold text-slate-900 mb-1">
                Material Shifts ({latestPeriod} vs {priorPeriod})
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Lines moving ≥ 10% MoM flagged for FP&amp;A variance review
              </p>
              <div className="space-y-2">
                {summary.lineRows
                  .filter(
                    (r) => r.changePct !== null && Math.abs(r.changePct) >= 10
                  )
                  .map((r) => (
                    <button
                      key={r.lineItem}
                      type="button"
                      onClick={() =>
                        setSelectedInspect({ type: 'line', data: r })
                      }
                      className="w-full text-left p-2.5 bg-white border border-slate-200 hover:border-emerald-700 rounded-md transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-900 truncate">
                          {r.lineItem}
                        </span>
                        <span
                          className={`font-mono font-semibold tabular-nums shrink-0 ${
                            (r.changePct ?? 0) >= 0
                              ? 'text-emerald-700'
                              : 'text-red-700'
                          }`}
                        >
                          {(r.changePct ?? 0) >= 0 ? '+' : ''}
                          {r.changePct?.toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  ))}
                {summary.lineRows.filter(
                  (r) => r.changePct !== null && Math.abs(r.changePct) >= 10
                ).length === 0 && (
                  <p className="text-xs text-slate-500">
                    No line items exceeded ±10% variance in {latestPeriod}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Verification Note */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-1">
        <span>
          Source: Consolidated Power Query model ({summary.activePeriods.join(', ')}) · Accounting equation:{' '}
          <span className={isLatestBalanced ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
            Assets − Liabilities − Equity = {formatAccountingNgn(summary.equationCheck[latestPeriod], displayScale)}
          </span>
        </span>
        <span>
          {isLatestBalanced
            ? 'All reporting periods reconciled and balanced.'
            : 'Map unmapped GL accounts in BS_Map to reconcile Balance Sheet.'}
        </span>
      </div>
    </div>
  );
}

function SectionBlock({
  section,
  colSpan,
  isCollapsed,
  onToggle,
  children,
}: {
  section: string;
  colSpan: number;
  isCollapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="bg-[#DCE6F1] hover:bg-[#cfdeef] cursor-pointer transition-colors"
      >
        <td
          colSpan={colSpan}
          className="py-1.5 px-3 text-xs font-bold text-[#1A365D] tracking-wide"
        >
          <span className="inline-flex items-center gap-1.5">
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
            {section}
          </span>
        </td>
      </tr>
      {children}
    </>
  );
}
