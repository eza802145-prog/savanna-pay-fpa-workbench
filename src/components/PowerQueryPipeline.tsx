import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
} from 'lucide-react';
import {
  CleanedTrialBalanceRow,
  DisplayScale,
  PowerQueryStepSummary,
  RawTrialBalanceRow,
  TrialBalanceValidationResult,
} from '../types/fpa';
import { formatAccountingNgn } from '../utils/powerQueryEngine';

interface PowerQueryPipelineProps {
  steps: PowerQueryStepSummary[];
  validations: TrialBalanceValidationResult[];
  rawSampleRows: RawTrialBalanceRow[];
  cleanRows: CleanedTrialBalanceRow[];
  displayScale: DisplayScale;
  onJumpToMap: () => void;
  onInspectSheet: (sheetName: 'Aug_TB' | 'Sep_TB' | 'Oct_TB' | 'Nov_TB') => void;
}

const STEP_LESSONS: Record<string, string> = {
  source:
    'Connecting to a folder instead of single files means next month you just drop Nov_TB into the folder and click Refresh All—zero manual copying or schema alignment.',
  clean_rows:
    'ERP exports often include subtotal rows and blank separators. If you leave them in, SUMIFS will double-count Total Assets or break your zero-net check.',
  split_account:
    'Keeping GL AccountCode as explicit Text prevents Excel from stripping leading zeros and gives you a reliable primary key for merging with BS_Map.',
  parse_types:
    'Text currency strings like "₦3,970,000,000.00" or "(₦960,000,000.0)" cannot be summed. Converting to Currency.Type and computing Net = Debit − Credit guarantees consistent signs.',
  dedupe_append:
    'Table.Distinct protects against accidental duplicate exports from accounting systems, while Table.Combine stacks all historical months into one tidy fact table.',
  merge_map:
    'A Left Outer Join against BS_Map automatically assigns every GL code to a Balance Sheet line. Any new account code surfaces immediately as UNMAPPED during month-end close.',
};

export function PowerQueryPipeline({
  steps,
  validations,
  rawSampleRows,
  cleanRows,
  displayScale,
  onJumpToMap,
  onInspectSheet,
}: PowerQueryPipelineProps) {
  const [selectedStepId, setSelectedStepId] = useState<string>(steps[0]?.id ?? 'source');
  const [previewMode, setPreviewMode] = useState<'transformed' | 'raw'>('transformed');
  const [copiedStepId, setCopiedStepId] = useState<string | null>(null);

  const activeStep = steps.find((s) => s.id === selectedStepId) ?? steps[0];

  const removedDemoRows = rawSampleRows.filter(
    (r) => r.rowTypeHint === 'blank' || r.rowTypeHint === 'total' || r.rowTypeHint === 'duplicate'
  );

  const handleCopyMCode = async () => {
    try {
      await navigator.clipboard.writeText(activeStep.mCode);
      setCopiedStepId(activeStep.id);
      setTimeout(() => setCopiedStepId(null), 1800);
    } catch {
      setCopiedStepId(activeStep.id);
      setTimeout(() => setCopiedStepId(null), 1800);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
          Power Query ETL &amp; Trial Balance Validation
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Click any Applied Step to inspect its M formula, raw vs. cleaned records, and FP&amp;A design rationale. Click any period row below to inspect its raw ERP export.
        </p>
      </div>

      {/* Applied Steps & M-Code Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Power Query Applied Steps */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 tracking-wide">
              Applied Steps (TB_Clean Query)
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              {steps.length} steps
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {steps.map((step) => {
              const active = step.id === activeStep.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepId(step.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                    active ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        active ? 'text-emerald-950' : 'text-slate-900'
                      }`}
                    >
                      0{step.stepNumber}. {step.name}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-slate-500 shrink-0">
                      {step.rowsIn} → {step.rowsOut} rows
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {step.issuesResolved}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Step Detail, M-Script & Live Transformation Output */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col gap-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-mono font-medium text-emerald-800">
                {activeStep.powerQueryFunction}
              </span>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                Rows: {activeStep.rowsIn} in · {activeStep.rowsOut} out
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-950 mt-1">
              0{activeStep.stepNumber}. {activeStep.name}
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              {activeStep.description}
            </p>
          </div>

          {/* Educational Callout */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex items-start gap-2.5">
            <BookOpen className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <span className="font-semibold text-slate-900">Why this matters in FP&amp;A: </span>
              {STEP_LESSONS[activeStep.id]}
            </div>
          </div>

          {/* M-Code Block with Working Copy Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700">
                Power Query M Formula
              </span>
              <button
                type="button"
                onClick={handleCopyMCode}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors cursor-pointer"
              >
                {copiedStepId === activeStep.id ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    Copy M-Code
                  </>
                )}
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 text-slate-100 rounded-lg font-mono text-xs overflow-x-auto leading-relaxed">
              <code>{activeStep.mCode}</code>
            </pre>
          </div>

          {/* Contextual Step Preview with Raw vs Transformed Toggle */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                {previewMode === 'raw'
                  ? 'Raw Dirty Source Sample (Pre-Clean)'
                  : activeStep.id === 'clean_rows' || activeStep.id === 'dedupe_append'
                  ? 'Dirty Records Stripped by This Stage'
                  : 'Transformed Output Sample (TB_Clean)'}
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewMode('transformed')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                    previewMode === 'transformed'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  After Step
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('raw')}
                  className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                    previewMode === 'raw'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Raw Input
                </button>
              </div>
            </div>

            {previewMode === 'raw' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-white">
                      <th className="py-2 px-3 font-medium">Sheet</th>
                      <th className="py-2 px-3 font-medium">Raw Account Field</th>
                      <th className="py-2 px-3 font-medium">Raw Date</th>
                      <th className="py-2 px-3 font-medium text-right">Raw Amount Text</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rawSampleRows
                      .filter((r) => r.rowTypeHint === 'valid')
                      .slice(0, 5)
                      .map((r) => (
                        <tr key={r.id} className="bg-white">
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.sourceSheet}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-800">
                            {r.rawColumns.Account_Code_Name ||
                              r.rawColumns.GL_Account ||
                              r.rawColumns.Account}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">
                            {r.rawColumns.ReportDate ||
                              r.rawColumns.Posting_Period ||
                              r.rawColumns.As_Of}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-800">
                            {r.rawColumns.Debit_Amt ||
                              r.rawColumns.DR_NGN ||
                              r.rawColumns.Net_Balance_Text}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : activeStep.id === 'clean_rows' || activeStep.id === 'dedupe_append' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-white">
                      <th className="py-2 px-3 font-medium">Source Sheet</th>
                      <th className="py-2 px-3 font-medium">Issue Detected</th>
                      <th className="py-2 px-3 font-medium">Raw Account / Row</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {removedDemoRows
                      .filter((r) =>
                        activeStep.id === 'clean_rows'
                          ? r.rowTypeHint === 'blank' || r.rowTypeHint === 'total'
                          : r.rowTypeHint === 'duplicate'
                      )
                      .slice(0, 6)
                      .map((r) => {
                        const rawAcct =
                          r.rawColumns.Account_Code_Name ||
                          r.rawColumns.GL_Account ||
                          r.rawColumns.Account ||
                          '(Empty Row)';
                        return (
                          <tr key={r.id} className="bg-white">
                            <td className="py-2 px-3 font-mono text-slate-700">
                              {r.sourceSheet}
                            </td>
                            <td className="py-2 px-3 font-medium text-amber-800">
                              {r.rowTypeHint === 'blank'
                                ? 'Blank Separator Row'
                                : r.rowTypeHint === 'total'
                                ? 'ERP Summary / Total Row'
                                : 'Exact Duplicate Record'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {rawAcct}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-white">
                      <th className="py-2 px-3 font-medium">Period</th>
                      <th className="py-2 px-3 font-medium">Code</th>
                      <th className="py-2 px-3 font-medium">Account Name</th>
                      <th className="py-2 px-3 font-medium">Mapped Line Item</th>
                      <th className="py-2 px-3 font-medium text-right">Net Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cleanRows.slice(0, 6).map((row) => (
                      <tr key={row.id} className="bg-white">
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {row.period}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                          {row.accountCode}
                        </td>
                        <td className="py-2 px-3 text-slate-800">
                          {row.accountName}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {row.bsLineItem}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">
                          {formatAccountingNgn(row.netAmount, displayScale)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trial Balance Zero-Net Check Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">
              Trial Balance Validation Check Query
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verifies Total Debits − Total Credits = 0.00 per reporting month. Click any row to open its raw ERP export sheet.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-semibold">Period</th>
                <th className="py-2.5 px-4 font-semibold">Source Sheet</th>
                <th className="py-2.5 px-4 font-semibold text-right">Raw Rows</th>
                <th className="py-2.5 px-4 font-semibold text-right">Blanks/Totals</th>
                <th className="py-2.5 px-4 font-semibold text-right">Duplicates</th>
                <th className="py-2.5 px-4 font-semibold text-right">Clean Rows</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Debits</th>
                <th className="py-2.5 px-4 font-semibold text-right">Total Credits</th>
                <th className="py-2.5 px-4 font-semibold text-right">Net Balance</th>
                <th className="py-2.5 px-4 font-semibold">TB Check</th>
                <th className="py-2.5 px-4 font-semibold">Mapping Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {validations.map((v) => (
                <tr
                  key={v.period}
                  onClick={() =>
                    onInspectSheet(
                      v.sourceSheet as 'Aug_TB' | 'Sep_TB' | 'Oct_TB' | 'Nov_TB'
                    )
                  }
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {v.period}
                  </td>
                  <td className="py-3 px-4 font-mono text-blue-800 inline-flex items-center gap-1">
                    {v.sourceSheet}
                    <ExternalLink className="w-3 h-3" />
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {v.rowCountRaw}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {v.blankOrTotalRemoved}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                    {v.duplicatesRemoved}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {v.rowCountClean}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                    {formatAccountingNgn(v.totalDebits, displayScale)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800">
                    {formatAccountingNgn(v.totalCredits, displayScale)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {Math.abs(v.netBalance) < 0.01
                      ? '0.0'
                      : formatAccountingNgn(v.netBalance, displayScale)}
                  </td>
                  <td className="py-3 px-4">
                    {v.isZeroBalanced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Balanced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-700 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Out of Balance
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {v.unmappedCount === 0 ? (
                      <span className="text-emerald-700 font-medium">
                        100% Mapped
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToMap();
                        }}
                        className="inline-flex items-center gap-1 text-amber-800 font-semibold underline underline-offset-2 cursor-pointer"
                      >
                        {v.unmappedCount} Unmapped
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
