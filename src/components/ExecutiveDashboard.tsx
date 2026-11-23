import { useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  DisplayScale,
  FinancialPositionSummary,
  PeriodKey,
} from '../types/fpa';
import { formatAccountingNgn } from '../utils/powerQueryEngine';

interface ExecutiveDashboardProps {
  summary: FinancialPositionSummary;
  displayScale: DisplayScale;
  hasNovember: boolean;
  onRunNovRefresh: () => void;
  onNavigateToStatement: () => void;
}

type RatioMetricKey =
  | 'safeguardingCoverPct'
  | 'currentRatio'
  | 'debtToEquity'
  | 'loanAllowanceCoveragePct';

const RATIO_META: Record<
  RatioMetricKey,
  {
    label: string;
    unit: string;
    benchmark: number;
    benchmarkLabel: string;
    description: string;
  }
> = {
  safeguardingCoverPct: {
    label: 'Safeguarding Cover',
    unit: '%',
    benchmark: 100,
    benchmarkLabel: '100% CBN Trust Minimum',
    description:
      'Restricted customer escrow funds divided by total customer wallet and agent float liabilities.',
  },
  currentRatio: {
    label: 'Current Ratio',
    unit: 'x',
    benchmark: 1.25,
    benchmarkLabel: '1.25x Treasury Floor',
    description:
      'Total current assets relative to short-term liabilities maturing within 12 months.',
  },
  debtToEquity: {
    label: 'Debt-to-Equity',
    unit: 'x',
    benchmark: 0.75,
    benchmarkLabel: '0.75x Debt Covenant',
    description:
      'Combined short-term and long-term borrowings divided by total shareholder equity.',
  },
  loanAllowanceCoveragePct: {
    label: 'Loan Loss Coverage',
    unit: '%',
    benchmark: 7.0,
    benchmarkLabel: '7.0% IFRS 9 Policy Target',
    description:
      'Expected credit loss allowance as a percentage of gross customer and merchant loan book.',
  },
};

export function ExecutiveDashboard({
  summary,
  displayScale,
  hasNovember,
  onRunNovRefresh,
  onNavigateToStatement,
}: ExecutiveDashboardProps) {
  const periods = summary.activePeriods;
  const latest = summary.latestPeriod;
  const prior = summary.priorPeriod;

  const [focusedPeriod, setFocusedPeriod] = useState<PeriodKey>(latest);
  const [selectedRatio, setSelectedRatio] = useState<RatioMetricKey>(
    'safeguardingCoverPct'
  );
  const [selectedKpi, setSelectedKpi] = useState<
    'assets' | 'currentRatio' | 'safeguarding' | 'debtToEquity' | null
  >('safeguarding');
  const [selectedAssetBucket, setSelectedAssetBucket] = useState<string | null>(
    null
  );

  // Ensure focusedPeriod stays valid if user resets from Nov-26 to Oct-26
  const activeFocusedPeriod: PeriodKey = periods.includes(focusedPeriod)
    ? focusedPeriod
    : latest;

  const findVal = (name: string, p: PeriodKey) =>
    summary.lineRows.find((r) => r.lineItem === name)?.values[p] ?? 0;

  const totalAssetsLatest = summary.subtotals.totalAssets[latest];
  const totalAssetsPrior = summary.subtotals.totalAssets[prior];
  const assetsGrowthPct =
    totalAssetsPrior !== 0
      ? ((totalAssetsLatest - totalAssetsPrior) / totalAssetsPrior) * 100
      : 0;

  const currentRatioLatest = summary.ratios.currentRatio[latest];
  const currentRatioDelta =
    currentRatioLatest - summary.ratios.currentRatio[prior];

  const safeguardingLatest = summary.ratios.safeguardingCoverPct[latest];
  const safeguardingDelta =
    safeguardingLatest - summary.ratios.safeguardingCoverPct[prior];
  const safeguardingShortfall =
    findVal('Customer Funds (Restricted)', latest) -
    (findVal('Customer Wallet Balances', latest) +
      findVal('Agent Float Liabilities', latest));

  const dteLatest = summary.ratios.debtToEquity[latest];
  const dteDelta = dteLatest - summary.ratios.debtToEquity[prior];

  // Asset Mix for activeFocusedPeriod
  const assetMixItems = [
    {
      label: 'Customer Funds (Restricted)',
      value: findVal('Customer Funds (Restricted)', activeFocusedPeriod),
      color: 'bg-emerald-700',
      detail:
        'Ring-fenced escrow and trust accounts (GL 1210 & 1212) mandated by CBN to safeguard customer wallets and agent floats.',
    },
    {
      label: 'Net Customer Loans',
      value:
        findVal('Gross Loans to Customers', activeFocusedPeriod) +
        findVal('Loan Loss Allowance', activeFocusedPeriod),
      color: 'bg-[#1A365D]',
      detail:
        'Merchant working capital advances and consumer micro-credit (GL 1310 & 1315) net of IFRS 9 Expected Credit Loss allowance (GL 1320).',
    },
    {
      label: 'Operating & Settlement Cash',
      value:
        findVal('Cash & Bank - Operating', activeFocusedPeriod) +
        findVal('Cash & Bank - Settlement', activeFocusedPeriod),
      color: 'bg-slate-600',
      detail:
        'Unrestricted corporate treasury bank balances (GL 1110) plus NIBSS/card scheme settlement prefunding floats (GL 1120).',
    },
    {
      label: 'Treasury Bills & Receivables',
      value:
        findVal('Treasury Bills & Placements', activeFocusedPeriod) +
        findVal('Settlement & Other Receivables', activeFocusedPeriod) +
        findVal('Prepayments & Deferred Tax', activeFocusedPeriod),
      color: 'bg-slate-400',
      detail:
        'Liquid FGN Treasury Bills (GL 1360/1365), T+1 acquirer switching receivables (GL 1250), and prepaid infrastructure/deferred tax (GL 1410).',
    },
    {
      label: 'Fixed & Intangible Assets',
      value: summary.subtotals.nonCurrentAssets[activeFocusedPeriod],
      color: 'bg-slate-300',
      detail:
        'POS terminal fleet, servers, office fitout (GL 1010/1015), and capitalized payment switch software IP (GL 1020).',
    },
  ];
  const focusedTotalAssets =
    summary.subtotals.totalAssets[activeFocusedPeriod] || 1;
  const activeAssetDetail = assetMixItems.find(
    (item) => item.label === selectedAssetBucket
  );

  // Safeguarding SVG chart scaling
  const maxSafeguardingVal = Math.max(
    ...periods.map((p) =>
      Math.max(
        findVal('Customer Funds (Restricted)', p),
        findVal('Customer Wallet Balances', p) +
          findVal('Agent Float Liabilities', p)
      )
    )
  );

  // Ratio Trend SVG calculations
  const ratioMeta = RATIO_META[selectedRatio];
  const ratioValues = periods.map((p) => summary.ratios[selectedRatio][p]);
  const rawMin = Math.min(...ratioValues, ratioMeta.benchmark);
  const rawMax = Math.max(...ratioValues, ratioMeta.benchmark);
  const pad = Math.max((rawMax - rawMin) * 0.25, 0.05);
  const yMin = rawMin - pad;
  const yMax = rawMax + pad;

  const chartWidth = 520;
  const chartHeight = 190;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 20;
  const padBottom = 32;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const getX = (idx: number) =>
    periods.length <= 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (periods.length - 1)) * plotW;

  const getY = (val: number) =>
    padTop + ((yMax - val) / (yMax - yMin || 1)) * plotH;

  const polylinePoints = ratioValues
    .map((v, i) => `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`)
    .join(' ');

  const benchmarkY = getY(ratioMeta.benchmark);

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
            Management Financial Position Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Liquidity, funding leverage, loan credit quality, and customer funds safeguarding across{' '}
            {periods[0]} – {latest}.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {!hasNovember && (
            <button
              type="button"
              onClick={onRunNovRefresh}
              className="px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Simulate Nov-26 One-Click Refresh
            </button>
          )}
          <button
            type="button"
            onClick={onNavigateToStatement}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open Financial_Position Grid
          </button>
        </div>
      </div>

      {/* 4-Column Interactive Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() =>
            setSelectedKpi((prev) => (prev === 'assets' ? null : 'assets'))
          }
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            selectedKpi === 'assets'
              ? 'border-emerald-700 ring-1 ring-emerald-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Assets ({latest})</span>
            <span className="text-emerald-800">Inspect</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums">
            {formatAccountingNgn(totalAssetsLatest, 'millions', true)}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">
              +{assetsGrowthPct.toFixed(1)}%
            </span>
            <span className="text-slate-500 font-normal">vs {prior}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedRatio('currentRatio');
            setSelectedKpi((prev) =>
              prev === 'currentRatio' ? null : 'currentRatio'
            );
          }}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            selectedKpi === 'currentRatio'
              ? 'border-emerald-700 ring-1 ring-emerald-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Current Ratio ({latest})</span>
            <span className="text-emerald-800">Inspect</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums">
            {currentRatioLatest.toFixed(2)}x
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-0.5 font-mono tabular-nums font-medium ${
                currentRatioDelta >= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {currentRatioDelta >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
              {currentRatioDelta >= 0 ? '+' : ''}
              {currentRatioDelta.toFixed(2)}x
            </span>
            <span className="text-slate-500">· Target ≥ 1.25x</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedRatio('safeguardingCoverPct');
            setSelectedKpi((prev) =>
              prev === 'safeguarding' ? null : 'safeguarding'
            );
          }}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            selectedKpi === 'safeguarding'
              ? 'border-emerald-700 ring-1 ring-emerald-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Safeguarding Cover ({latest})</span>
            <span className="text-emerald-800">Inspect</span>
          </div>
          <div
            className={`mt-2 font-mono text-2xl font-bold tabular-nums ${
              safeguardingLatest < 100 ? 'text-red-700' : 'text-emerald-800'
            }`}
          >
            {safeguardingLatest.toFixed(1)}%
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {safeguardingLatest < 100 ? (
              <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Shortfall{' '}
                <span className="font-mono tabular-nums">
                  {formatAccountingNgn(Math.abs(safeguardingShortfall), 'millions', true)}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Surplus{' '}
                <span className="font-mono tabular-nums">
                  {formatAccountingNgn(safeguardingShortfall, 'millions', true)}
                </span>
              </span>
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedRatio('debtToEquity');
            setSelectedKpi((prev) =>
              prev === 'debtToEquity' ? null : 'debtToEquity'
            );
          }}
          className={`text-left bg-white border rounded-lg p-5 transition-colors cursor-pointer ${
            selectedKpi === 'debtToEquity'
              ? 'border-emerald-700 ring-1 ring-emerald-700'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Debt-to-Equity ({latest})</span>
            <span className="text-emerald-800">Inspect</span>
          </div>
          <div className="mt-2 font-mono text-2xl font-bold text-slate-950 tabular-nums">
            {dteLatest.toFixed(2)}x
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            <span
              className={`font-mono tabular-nums font-medium ${
                dteDelta <= 0 ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {dteDelta >= 0 ? '+' : ''}
              {dteDelta.toFixed(2)}x vs {prior}
            </span>
            <span className="text-slate-500">· Covenant ≤ 0.75x</span>
          </div>
        </button>
      </div>

      {/* Educational KPI Breakdown Panel */}
      {selectedKpi && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <BookOpen className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 space-y-1">
              {selectedKpi === 'assets' && (
                <>
                  <div className="font-semibold text-slate-950">
                    Total Assets Breakdown ({latest}):{' '}
                    <span className="font-mono">
                      Non-Current {formatAccountingNgn(summary.subtotals.nonCurrentAssets[latest], 'millions', true)} + Current {formatAccountingNgn(summary.subtotals.currentAssets[latest], 'millions', true)} = {formatAccountingNgn(totalAssetsLatest, 'millions', true)}
                    </span>
                  </div>
                  <p>
                    Always verified against Liabilities + Equity ({formatAccountingNgn(summary.subtotals.totalLiabilitiesAndEquity[latest], 'millions', true)}) via the automated accounting equation check.
                  </p>
                </>
              )}
              {selectedKpi === 'currentRatio' && (
                <>
                  <div className="font-semibold text-slate-950">
                    Current Ratio Formula ({latest}):{' '}
                    <span className="font-mono">
                      {formatAccountingNgn(summary.subtotals.currentAssets[latest], 'millions', true)} ÷ {formatAccountingNgn(summary.subtotals.currentLiabilities[latest], 'millions', true)} = {currentRatioLatest.toFixed(2)}x
                    </span>
                  </div>
                  <p>
                    Tests whether liquid assets and T+1 receivables cover all short-term payables, wallet obligations, and working capital lines due within 12 months.
                  </p>
                </>
              )}
              {selectedKpi === 'safeguarding' && (
                <>
                  <div className="font-semibold text-slate-950">
                    Safeguarding Cover Formula ({latest}):{' '}
                    <span className="font-mono">
                      Restricted Funds {formatAccountingNgn(findVal('Customer Funds (Restricted)', latest), 'millions', true)} ÷ (Wallets + Float {formatAccountingNgn(findVal('Customer Wallet Balances', latest) + findVal('Agent Float Liabilities', latest), 'millions', true)}) = {safeguardingLatest.toFixed(1)}%
                    </span>
                  </div>
                  <p>
                    Payment institutions must ring-fence ≥ 100% of customer stored value and agent float in designated trust accounts. When Oct-26 dipped to 98.9%, Treasury executed a cash sweep in Nov-26 to restore 100.1% cover.
                  </p>
                </>
              )}
              {selectedKpi === 'debtToEquity' && (
                <>
                  <div className="font-semibold text-slate-950">
                    Debt-to-Equity Formula ({latest}):{' '}
                    <span className="font-mono">
                      Total Borrowings {formatAccountingNgn(findVal('Short-term Borrowings', latest) + findVal('Long-term Borrowings', latest), 'millions', true)} ÷ Total Equity {formatAccountingNgn(summary.subtotals.totalEquity[latest], 'millions', true)} = {dteLatest.toFixed(2)}x
                    </span>
                  </div>
                  <p>
                    Tracks borrowed capital (short-term working capital lines + long-term venture debt) against shareholder equity cushion; lenders typically cap this at 0.75x.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToStatement}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md whitespace-nowrap cursor-pointer"
            >
              Verify on Statement
              <ArrowRight className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedKpi(null)}
              aria-label="Close metric breakdown"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Primary Visual Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Chart 1: Customer Funds Safeguarding Monitor */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Customer Funds Safeguarding Monitor
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Restricted Escrow Balances vs. Customer Wallet + Agent Float Liabilities
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-700" />
                Restricted Funds
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-[#1A365D]" />
                Wallet + Float
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {periods.map((period) => {
              const restricted = findVal('Customer Funds (Restricted)', period);
              const obligations =
                findVal('Customer Wallet Balances', period) +
                findVal('Agent Float Liabilities', period);
              const coverPct = summary.ratios.safeguardingCoverPct[period];
              const diff = restricted - obligations;
              const restrictedPctW = (restricted / (maxSafeguardingVal || 1)) * 100;
              const obligationPctW = (obligations / (maxSafeguardingVal || 1)) * 100;
              const isShortfall = coverPct < 100;

              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => {
                    setFocusedPeriod(period);
                    setSelectedKpi('safeguarding');
                  }}
                  onMouseEnter={() => setFocusedPeriod(period)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    activeFocusedPeriod === period
                      ? 'border-emerald-600 bg-slate-50/80'
                      : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{period}</span>
                      <span
                        className={`font-mono font-semibold tabular-nums ${
                          isShortfall ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {coverPct.toFixed(1)}% cover
                      </span>
                    </div>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isShortfall ? 'text-red-700 font-medium' : 'text-slate-600'
                      }`}
                    >
                      {diff >= 0 ? 'Surplus +' : 'Deficit '}
                      {formatAccountingNgn(diff, displayScale, true)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 h-2.5 rounded-xs overflow-hidden">
                        <div
                          className="h-full bg-emerald-700 transition-all duration-300"
                          style={{ width: `${restrictedPctW}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-700 w-24 text-right shrink-0">
                        {formatAccountingNgn(restricted, 'millions', true)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-slate-100 h-2.5 rounded-xs overflow-hidden">
                        <div
                          className="h-full bg-[#1A365D] transition-all duration-300"
                          style={{ width: `${obligationPctW}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-slate-700 w-24 text-right shrink-0">
                        {formatAccountingNgn(obligations, 'millions', true)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Interactive Ratio & Asset Quality Explorer */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Key Indicator Trajectory
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ratioMeta.description}
                </p>
              </div>
            </div>

            {/* Segmented Ratio Switcher */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 mb-4">
              {(Object.keys(RATIO_META) as RatioMetricKey[]).map((key) => {
                const active = selectedRatio === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedRatio(key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {RATIO_META[key].label}
                  </button>
                );
              })}
            </div>

            {/* Crisp SVG Line Chart */}
            <div className="w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-48"
                role="img"
                aria-label={`${ratioMeta.label} trend chart`}
              >
                {/* Benchmark Dashed Line */}
                <line
                  x1={padLeft}
                  y1={benchmarkY}
                  x2={chartWidth - padRight}
                  y2={benchmarkY}
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth="1.25"
                />
                <text
                  x={chartWidth - padRight}
                  y={benchmarkY - 6}
                  textAnchor="end"
                  className="fill-slate-500 text-[10px] font-mono"
                >
                  {ratioMeta.benchmarkLabel}
                </text>

                {/* Bottom Axis */}
                <line
                  x1={padLeft}
                  y1={chartHeight - padBottom}
                  x2={chartWidth - padRight}
                  y2={chartHeight - padBottom}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />

                {/* Trend Polyline */}
                <polyline
                  fill="none"
                  stroke="#15803d"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polylinePoints}
                />

                {/* Data Nodes & Value Labels */}
                {periods.map((period, idx) => {
                  const val = summary.ratios[selectedRatio][period];
                  const cx = getX(idx);
                  const cy = getY(val);
                  const isFocused = activeFocusedPeriod === period;
                  const formatted =
                    ratioMeta.unit === '%'
                      ? `${val.toFixed(1)}%`
                      : `${val.toFixed(2)}x`;

                  return (
                    <g
                      key={period}
                      className="cursor-pointer"
                      onClick={() => setFocusedPeriod(period)}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isFocused ? 6 : 4.5}
                        fill={
                          selectedRatio === 'safeguardingCoverPct' && val < 100
                            ? '#dc2626'
                            : '#15803d'
                        }
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text
                        x={cx}
                        y={cy - 11}
                        textAnchor="middle"
                        className="fill-slate-900 text-[11px] font-mono font-semibold"
                      >
                        {formatted}
                      </text>
                      <text
                        x={cx}
                        y={chartHeight - 10}
                        textAnchor="middle"
                        className={`text-[11px] font-medium ${
                          isFocused ? 'fill-slate-950 font-bold' : 'fill-slate-500'
                        }`}
                      >
                        {period}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Focused Period:{' '}
              <strong className="text-slate-900">{activeFocusedPeriod}</strong>
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {ratioMeta.unit === '%'
                ? `${summary.ratios[selectedRatio][activeFocusedPeriod].toFixed(1)}%`
                : `${summary.ratios[selectedRatio][activeFocusedPeriod].toFixed(2)}x`}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Asset Composition Breakdown + Management Takeaways */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Asset Composition Breakdown */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">
                Asset Allocation Mix ({activeFocusedPeriod})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Proportion of total balance sheet resources across liquid, restricted, lending, and fixed assets
              </p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {periods.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFocusedPeriod(p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeFocusedPeriod === p
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Stacked Proportion Bar (Clickable Segments) */}
          <div className="h-4 w-full rounded-sm overflow-hidden flex mb-5 bg-slate-100">
            {assetMixItems.map((seg) => {
              const pct = (seg.value / focusedTotalAssets) * 100;
              return (
                <button
                  key={seg.label}
                  type="button"
                  onClick={() =>
                    setSelectedAssetBucket((prev) =>
                      prev === seg.label ? null : seg.label
                    )
                  }
                  className={`${seg.color} h-full hover:opacity-85 transition-opacity cursor-pointer`}
                  style={{ width: `${Math.max(pct, 0)}%` }}
                  title={`${seg.label}: ${pct.toFixed(1)}% (Click for GL detail)`}
                />
              );
            })}
          </div>

          <div className="divide-y divide-slate-100">
            {assetMixItems.map((seg) => {
              const pct = (seg.value / focusedTotalAssets) * 100;
              const isSegSelected = selectedAssetBucket === seg.label;
              return (
                <button
                  key={seg.label}
                  type="button"
                  onClick={() =>
                    setSelectedAssetBucket((prev) =>
                      prev === seg.label ? null : seg.label
                    )
                  }
                  className={`w-full text-left py-2.5 px-2 -mx-2 rounded flex items-center justify-between gap-4 text-xs transition-colors cursor-pointer ${
                    isSegSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-2.5 h-2.5 rounded-xs shrink-0 ${seg.color}`} />
                    <span className="font-medium text-slate-800 truncate">
                      {seg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums">
                    <span className="text-slate-500 w-12 text-right">
                      {pct.toFixed(1)}%
                    </span>
                    <span className="font-semibold text-slate-900 w-28 text-right">
                      {formatAccountingNgn(seg.value, displayScale, true)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeAssetDetail && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
              <div className="font-semibold text-slate-900 mb-1">
                {activeAssetDetail.label} ({activeFocusedPeriod})
              </div>
              <p className="leading-relaxed">{activeAssetDetail.detail}</p>
            </div>
          )}
        </div>

        {/* Executive FP&A Commentary (Interactive Links) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950 mb-1">
              Treasury &amp; Risk Commentary
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Click any insight below to highlight its metric or inspect the statement
            </p>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <button
                type="button"
                onClick={() => {
                  setSelectedRatio('safeguardingCoverPct');
                  setSelectedKpi('safeguarding');
                }}
                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-emerald-700 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="font-semibold text-slate-950 mb-1 flex items-center justify-between">
                  <span>01. Safeguarding Liquidity Position</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <p>
                  {safeguardingLatest < 100
                    ? `In ${latest}, Customer Wallet & Agent Float liabilities reached ${formatAccountingNgn(
                        findVal('Customer Wallet Balances', latest) +
                          findVal('Agent Float Liabilities', latest),
                        'millions',
                        true
                      )}, exceeding Restricted Customer Funds by ${formatAccountingNgn(
                        Math.abs(safeguardingShortfall),
                        'millions',
                        true
                      )} (${safeguardingLatest.toFixed(1)}% cover). Treasury should sweep operating cash into the CBN safeguarding escrow.`
                    : `Following the ${latest} cycle refresh, Restricted Customer Funds (${formatAccountingNgn(
                        findVal('Customer Funds (Restricted)', latest),
                        'millions',
                        true
                      )}) fully cover stored value wallets and agent float at ${safeguardingLatest.toFixed(
                        1
                      )}%, restoring compliance above the 100% floor.`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRatio('debtToEquity');
                  setSelectedKpi('debtToEquity');
                }}
                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-emerald-700 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="font-semibold text-slate-950 mb-1 flex items-center justify-between">
                  <span>02. Funding Mix &amp; Leverage Discipline</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <p>
                  Debt-to-Equity stands at{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {dteLatest.toFixed(2)}x
                  </span>{' '}
                  ({dteDelta >= 0 ? 'up' : 'down'}{' '}
                  <span className="font-mono">
                    {Math.abs(dteDelta).toFixed(2)}x
                  </span>{' '}
                  vs {prior}), driven by short-term working capital facility{' '}
                  {dteDelta >= 0 ? 'drawdowns' : 'repayments'} alongside YTD retained profit growth to{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatAccountingNgn(
                      findVal('Profit for the Period (YTD)', latest),
                      'millions',
                      true
                    )}
                  </span>
                  .
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedRatio('loanAllowanceCoveragePct');
                  setSelectedAssetBucket('Net Customer Loans');
                }}
                className="w-full text-left p-3 rounded-lg border border-slate-100 hover:border-emerald-700 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="font-semibold text-slate-950 mb-1 flex items-center justify-between">
                  <span>03. Credit Portfolio Provisioning</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </div>
                <p>
                  Gross customer loans expanded to{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {formatAccountingNgn(
                      findVal('Gross Loans to Customers', latest),
                      'millions',
                      true
                    )}
                  </span>{' '}
                  with Loan Loss Allowance coverage maintained at{' '}
                  <span className="font-mono font-semibold text-slate-900">
                    {summary.ratios.loanAllowanceCoveragePct[latest].toFixed(1)}%
                  </span>
                  , protecting net asset quality ahead of Q4 holiday settlement volumes.
                </p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
