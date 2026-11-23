import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, X } from 'lucide-react';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { FinancialPositionSheet } from './components/FinancialPositionSheet';
import { PortfolioKitDrawer } from './components/PortfolioKitDrawer';
import { PowerQueryPipeline } from './components/PowerQueryPipeline';
import { TopBar } from './components/TopBar';
import { SheetTabId, TrialBalancesAndMap } from './components/TrialBalancesAndMap';
import {
  ENTITY_PROFILE,
  INITIAL_BS_MAP,
  INITIAL_CLOSE_CONTROLS,
  RAW_AUG_TB,
  RAW_NOV_TB,
  RAW_OCT_TB,
  RAW_SEP_TB,
  SUGGESTED_NOV_MAPPINGS,
} from './data/savannaPayData';
import {
  BalanceSheetLineItem,
  BalanceSheetSection,
  BSMapEntry,
  CloseControlItem,
  DisplayScale,
  PeriodKey,
  RawTrialBalanceRow,
  WorkspaceView,
} from './types/fpa';
import {
  buildFinancialPosition,
  downloadFinancialPositionCsv,
  runPowerQueryPipeline,
} from './utils/powerQueryEngine';

export default function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('financial_position');
  const [activeWorksheetTab, setActiveWorksheetTab] = useState<SheetTabId>('TB_Clean');
  const [displayScale, setDisplayScale] = useState<DisplayScale>('full');
  const [hasNovember, setHasNovember] = useState<boolean>(false);
  const [focalPeriod, setFocalPeriod] = useState<PeriodKey>('Oct-26');
  const [showLearningGuide, setShowLearningGuide] = useState<boolean>(false);
  const [showPortfolioKit, setShowPortfolioKit] = useState<boolean>(false);
  const [bsMap, setBsMap] = useState<BSMapEntry[]>(INITIAL_BS_MAP);
  const [closeControls, setCloseControls] =
    useState<CloseControlItem[]>(INITIAL_CLOSE_CONTROLS);
  const [customNovRows, setCustomNovRows] = useState<RawTrialBalanceRow[] | null>(
    null
  );
  const [uploadedCsvFileName, setUploadedCsvFileName] = useState<string | null>(
    null
  );

  const activePeriods: PeriodKey[] = useMemo(
    () =>
      hasNovember
        ? ['Aug-26', 'Sept-26', 'Oct-26', 'Nov-26']
        : ['Aug-26', 'Sept-26', 'Oct-26'],
    [hasNovember]
  );

  const effectiveNovRows = customNovRows ?? RAW_NOV_TB;

  const activeRawSheets = useMemo(() => {
    const base: Array<{
      period: PeriodKey;
      sheetName: string;
      rows: RawTrialBalanceRow[];
    }> = [
      { period: 'Aug-26', sheetName: 'Aug_TB', rows: RAW_AUG_TB },
      { period: 'Sept-26', sheetName: 'Sep_TB', rows: RAW_SEP_TB },
      { period: 'Oct-26', sheetName: 'Oct_TB', rows: RAW_OCT_TB },
    ];
    if (hasNovember) {
      base.push({ period: 'Nov-26', sheetName: 'Nov_TB', rows: effectiveNovRows });
    }
    return base;
  }, [hasNovember, effectiveNovRows]);

  const pipelineOutput = useMemo(
    () => runPowerQueryPipeline(activeRawSheets, bsMap),
    [activeRawSheets, bsMap]
  );

  const effectiveFocalPeriod: PeriodKey = activePeriods.includes(focalPeriod)
    ? focalPeriod
    : activePeriods[activePeriods.length - 1];

  const financialPosition = useMemo(
    () =>
      buildFinancialPosition(
        pipelineOutput.cleanRows,
        activePeriods,
        effectiveFocalPeriod
      ),
    [pipelineOutput.cleanRows, activePeriods, effectiveFocalPeriod]
  );

  const allRawSampleRows = useMemo(
    () => activeRawSheets.flatMap((s) => s.rows),
    [activeRawSheets]
  );

  const latestPeriod = financialPosition.latestPeriod;
  const isLatestBalanced =
    financialPosition.equationStatus[latestPeriod] === 'Balances';
  const latestValidation = pipelineOutput.validations.find(
    (v) => v.period === latestPeriod
  );

  const handleToggleNovember = () => {
    if (hasNovember) {
      setHasNovember(false);
      setFocalPeriod('Oct-26');
      setCustomNovRows(null);
      setUploadedCsvFileName(null);
      setBsMap(INITIAL_BS_MAP);
      if (activeWorksheetTab === 'Nov_TB') {
        setActiveWorksheetTab('Oct_TB');
      }
    } else {
      setHasNovember(true);
      setFocalPeriod('Nov-26');
    }
  };

  const handleUploadNovCsv = (rows: RawTrialBalanceRow[], fileName: string) => {
    setCustomNovRows(rows);
    setUploadedCsvFileName(fileName);
    setHasNovember(true);
    setFocalPeriod('Nov-26');
  };

  const handleToggleControl = (id: string) => {
    setCloseControls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c))
    );
  };

  const handleUpdateControlNote = (id: string, note: string) => {
    setCloseControls((prev) =>
      prev.map((c) => (c.id === id ? { ...c, note } : c))
    );
  };

  const handleUpdateMapping = (
    accountCode: string,
    accountName: string,
    section: BalanceSheetSection,
    lineItem: BalanceSheetLineItem,
    presentationSign: 1 | -1
  ) => {
    setBsMap((prev) => {
      const exists = prev.some((m) => m.accountCode === accountCode);
      if (exists) {
        return prev.map((m) =>
          m.accountCode === accountCode
            ? {
                ...m,
                bsSection: section,
                bsLineItem: lineItem,
                presentationSign,
              }
            : m
        );
      }
      return [
        ...prev,
        {
          accountCode,
          accountName,
          bsSection: section,
          bsLineItem: lineItem,
          normalBalance: presentationSign === 1 ? 'Debit' : 'Credit',
          presentationSign,
        },
      ];
    });
  };

  const handleAutoMapSuggested = () => {
    setBsMap((prev) => {
      const next = [...prev];
      for (const suggested of SUGGESTED_NOV_MAPPINGS) {
        if (!next.some((m) => m.accountCode === suggested.accountCode)) {
          next.push(suggested);
        }
      }
      return next;
    });
  };

  const handleJumpToUnmapped = () => {
    setActiveView('worksheets');
    setActiveWorksheetTab('BS_Map');
  };

  const handleJumpToDimPeriod = () => {
    setActiveView('worksheets');
    setActiveWorksheetTab('Dim_Period');
  };

  const handleBottomTabClick = (
    target:
      | { kind: 'view'; view: WorkspaceView }
      | { kind: 'sheet'; tab: SheetTabId }
  ) => {
    if (target.kind === 'view') {
      setActiveView(target.view);
    } else {
      setActiveView('worksheets');
      setActiveWorksheetTab(target.tab);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopBar
        activeView={activeView}
        onSelectView={setActiveView}
        hasNovember={hasNovember}
        onToggleNovember={handleToggleNovember}
        displayScale={displayScale}
        onChangeScale={setDisplayScale}
        latestPeriod={latestPeriod}
        isBalanced={isLatestBalanced}
        unmappedCount={pipelineOutput.unmappedAccounts.length}
        onExportCsv={() =>
          downloadFinancialPositionCsv(financialPosition, displayScale)
        }
        onJumpToUnmapped={handleJumpToUnmapped}
        onJumpToDimPeriod={handleJumpToDimPeriod}
        showLearningGuide={showLearningGuide}
        onToggleLearningGuide={() => setShowLearningGuide((prev) => !prev)}
        showPortfolioKit={showPortfolioKit}
        onTogglePortfolioKit={() => setShowPortfolioKit((prev) => !prev)}
      />

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-6 py-6 space-y-6">
        <PortfolioKitDrawer
          isOpen={showPortfolioKit}
          onClose={() => setShowPortfolioKit(false)}
          summary={financialPosition}
          cleanRows={pipelineOutput.cleanRows}
          bsMap={bsMap}
          validations={pipelineOutput.validations}
          steps={pipelineOutput.steps}
          displayScale={displayScale}
          onLoadCsvToWorkbench={handleUploadNovCsv}
          onNavigateView={setActiveView}
        />

        {showLearningGuide && (
          <section
            aria-label="FP&A Automated Balance Sheet Learning Guide"
            className="bg-white border border-slate-200 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                <h2 className="text-sm font-bold text-slate-950">
                  Interactive FP&amp;A Learning Guide — Automated Balance Sheet Pipeline
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowLearningGuide(false)}
                className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                aria-label="Close FP&A Learning Guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              <div className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-emerald-700">
                    01 · SOURCE &amp; DIM_PERIOD
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    Messy Trial Balances
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Raw ERP sheets contain blank rows, subtotals, duplicates, and text currency strings. Click rows inside Aug_TB–Oct_TB to inspect anomalies, or click Dim_Period rows to switch reporting months.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('worksheets');
                      setActiveWorksheetTab('Aug_TB');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                  >
                    Inspect Aug_TB <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleJumpToDimPeriod}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
                  >
                    Open Dim_Period <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-emerald-700">
                    02 · POWER QUERY ETL
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    Clean, Dedupe &amp; Zero-Net Check
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Walk through all 6 Applied Steps, copy production M-code, toggle Raw vs. Transformed previews, and inspect the check query verifying Debit + Credit = 0.0 per period.
                  </p>
                </div>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveView('power_query')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                  >
                    Open Power Query <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-emerald-700">
                    03 · BS_MAP &amp; NOV REFRESH
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    Unmapped Account Governance
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Left Outer Join against BS_Map surfaces unmapped GL codes (1365 &amp; 2145) during 1-click November refresh or custom CSV upload, preventing silent out-of-balance errors.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasNovember) {
                        handleToggleNovember();
                      }
                      handleJumpToUnmapped();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                  >
                    {hasNovember ? 'Resolve in BS_Map' : 'Run Nov & Map'} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-4 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-[11px] font-mono font-semibold text-emerald-700">
                    04 · OUTPUT LAYER &amp; CONTROLS
                  </div>
                  <div className="text-sm font-semibold text-slate-900 mt-1">
                    SUMIFS, Pivot &amp; Executive Insights
                  </div>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Click any line item, subtotal, or Accounting Equation check on Financial Position for live Excel formulas &amp; GL lineage, or click KPI cards on Management Dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveView('financial_position')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                  >
                    Statement <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950 cursor-pointer"
                  >
                    Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeView === 'financial_position' && (
          <FinancialPositionSheet
            summary={financialPosition}
            displayScale={displayScale}
            focalPeriod={effectiveFocalPeriod}
            onChangeFocalPeriod={setFocalPeriod}
            unmappedCount={pipelineOutput.unmappedAccounts.length}
            unmappedNetAmount={latestValidation?.unmappedNetAmount ?? 0}
            closeControls={closeControls}
            onToggleControl={handleToggleControl}
            onUpdateControlNote={handleUpdateControlNote}
            onJumpToMap={handleJumpToUnmapped}
            onAutoMapSuggested={handleAutoMapSuggested}
          />
        )}

        {activeView === 'dashboard' && (
          <ExecutiveDashboard
            summary={financialPosition}
            displayScale={displayScale}
            hasNovember={hasNovember}
            onRunNovRefresh={() => {
              setHasNovember(true);
              setFocalPeriod('Nov-26');
            }}
            onNavigateToStatement={() => setActiveView('financial_position')}
          />
        )}

        {activeView === 'power_query' && (
          <PowerQueryPipeline
            steps={pipelineOutput.steps}
            validations={pipelineOutput.validations}
            rawSampleRows={allRawSampleRows}
            cleanRows={pipelineOutput.cleanRows}
            displayScale={displayScale}
            onJumpToMap={handleJumpToUnmapped}
            onInspectSheet={(sheet) => {
              setActiveView('worksheets');
              setActiveWorksheetTab(sheet);
            }}
          />
        )}

        {activeView === 'worksheets' && (
          <TrialBalancesAndMap
            activeTab={activeWorksheetTab}
            onSelectTab={setActiveWorksheetTab}
            hasNovember={hasNovember}
            rawSheets={{
              Aug_TB: RAW_AUG_TB,
              Sep_TB: RAW_SEP_TB,
              Oct_TB: RAW_OCT_TB,
              Nov_TB: effectiveNovRows,
            }}
            cleanRows={pipelineOutput.cleanRows}
            bsMap={bsMap}
            unmappedAccounts={pipelineOutput.unmappedAccounts}
            displayScale={displayScale}
            onUpdateMapping={handleUpdateMapping}
            onAutoMapSuggested={handleAutoMapSuggested}
            onUploadNovCsv={handleUploadNovCsv}
            uploadedCsvFileName={uploadedCsvFileName}
            onSelectPeriodFromDim={(period) => {
              setFocalPeriod(period);
              setActiveView('financial_position');
            }}
          />
        )}
      </main>

      {/* Excel Workbook Sheet Switcher Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto">
        <div className="max-w-[1440px] mx-auto px-6 py-2 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'Aug_TB', label: 'Aug_TB', kind: 'sheet' as const },
                { id: 'Sep_TB', label: 'Sep_TB', kind: 'sheet' as const },
                { id: 'Oct_TB', label: 'Oct_TB', kind: 'sheet' as const },
                ...(hasNovember
                  ? [{ id: 'Nov_TB', label: 'Nov_TB', kind: 'sheet' as const }]
                  : []),
                { id: 'BS_Map', label: 'BS_Map', kind: 'sheet' as const },
                { id: 'Dim_Period', label: 'Dim_Period', kind: 'sheet' as const },
                { id: 'TB_Clean', label: 'TB_Clean', kind: 'sheet' as const },
              ] as Array<{ id: SheetTabId; label: string; kind: 'sheet' }>
            ).map((sheet) => {
              const isActive =
                activeView === 'worksheets' && activeWorksheetTab === sheet.id;
              return (
                <button
                  key={sheet.id}
                  type="button"
                  onClick={() =>
                    handleBottomTabClick({ kind: 'sheet', tab: sheet.id })
                  }
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-emerald-700 text-emerald-900 bg-emerald-50/60 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {sheet.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                handleBottomTabClick({ kind: 'view', view: 'financial_position' })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'financial_position'
                  ? 'border-emerald-700 text-emerald-900 bg-emerald-50/60 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Financial_Position
            </button>

            <button
              type="button"
              onClick={() =>
                handleBottomTabClick({ kind: 'view', view: 'dashboard' })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeView === 'dashboard'
                  ? 'border-emerald-700 text-emerald-900 bg-emerald-50/60 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Management_Dashboard
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => setShowLearningGuide((prev) => !prev)}
              className="font-medium text-slate-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
              title="Toggle FP&A Learning Guide"
            >
              {ENTITY_PROFILE.legalName}
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span>{ENTITY_PROFILE.address}</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a
              href={`tel:${ENTITY_PROFILE.phone}`}
              className="hover:text-emerald-800 hover:underline underline-offset-2 whitespace-nowrap"
            >
              {ENTITY_PROFILE.phone}
            </a>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <a
              href={`mailto:${ENTITY_PROFILE.email}`}
              className="hover:text-emerald-800 hover:underline underline-offset-2 whitespace-nowrap"
            >
              {ENTITY_PROFILE.email}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
