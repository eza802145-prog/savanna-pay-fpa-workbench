import { useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  UploadCloud,
  X,
} from 'lucide-react';
import readmeRaw from '../../README.md?raw';
import coaMappingCsvRaw from '../../data/savanna_pay_coa_mapping.csv?raw';
import tbJanCsvRaw from '../../data/savanna_pay_tb_2026_01.csv?raw';
import tbFebCsvRaw from '../../data/savanna_pay_tb_2026_02.csv?raw';
import mergeCoaPqRaw from '../../power_query/merge_coa_mapping.pq?raw';
import transformTbPqRaw from '../../power_query/transform_trial_balance.pq?raw';
import {
  BSMapEntry,
  CleanedTrialBalanceRow,
  DisplayScale,
  FinancialPositionSummary,
  PowerQueryStepSummary,
  RawTrialBalanceRow,
  TrialBalanceValidationResult,
  WorkspaceView,
} from '../types/fpa';
import { parseCsvToTrialBalanceRows } from '../utils/powerQueryEngine';
import {
  downloadDashboardSnapshotPng,
  downloadLineageSnapshotPng,
  downloadTextFile,
  downloadWorkbenchXlsx,
} from '../utils/xlsxExport';

type RepoFileId =
  | 'readme'
  | 'workbook'
  | 'tb_jan'
  | 'tb_feb'
  | 'coa_map'
  | 'pq_transform'
  | 'pq_merge'
  | 'doc_dashboard'
  | 'doc_lineage';

interface PortfolioKitDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  summary: FinancialPositionSummary;
  cleanRows: CleanedTrialBalanceRow[];
  bsMap: BSMapEntry[];
  validations: TrialBalanceValidationResult[];
  steps: PowerQueryStepSummary[];
  displayScale: DisplayScale;
  onLoadCsvToWorkbench: (rows: RawTrialBalanceRow[], fileName: string) => void;
  onNavigateView: (view: WorkspaceView) => void;
}

interface RepoFileMeta {
  id: RepoFileId;
  folder: string;
  name: string;
  path: string;
  kind: 'text' | 'xlsx' | 'png';
  lesson: string;
  content?: string;
  mime?: string;
}

const REPO_FILES: RepoFileMeta[] = [
  {
    id: 'readme',
    folder: 'root',
    name: 'README.md',
    path: 'savanna-pay-fpa-workbench/README.md',
    kind: 'text',
    mime: 'text/markdown;charset=utf-8;',
    lesson:
      'Complete portfolio documentation detailing Savanna Pay Ltd’s fintech Balance Sheet architecture, Power Query M steps, SUMIFS layer, and close controls.',
    content: readmeRaw,
  },
  {
    id: 'workbook',
    folder: 'workbook',
    name: 'Savanna_Pay_FPA_Workbench.xlsx',
    path: 'savanna-pay-fpa-workbench/workbook/Savanna_Pay_FPA_Workbench.xlsx',
    kind: 'xlsx',
    lesson:
      'Live multi-sheet Excel (.xlsx) workbook generated directly from your current model state (Financial_Position, TB_Clean, BS_Map, Dim_Period, and Validation_Check).',
  },
  {
    id: 'tb_jan',
    folder: 'data',
    name: 'savanna_pay_tb_2026_01.csv',
    path: 'savanna-pay-fpa-workbench/data/savanna_pay_tb_2026_01.csv',
    kind: 'text',
    mime: 'text/csv;charset=utf-8;',
    lesson:
      'Balanced Jan 2026 fintech Trial Balance (Debits = Credits = ₦76.84B) featuring Operating Cash, Restricted Escrow, Processor Receivables, Deferred Transaction Revenue, Share Capital & Paid-In Capital.',
    content: tbJanCsvRaw,
  },
  {
    id: 'tb_feb',
    folder: 'data',
    name: 'savanna_pay_tb_2026_02.csv',
    path: 'savanna-pay-fpa-workbench/data/savanna_pay_tb_2026_02.csv',
    kind: 'text',
    mime: 'text/csv;charset=utf-8;',
    lesson:
      'Balanced Feb 2026 fintech Trial Balance (Debits = Credits = ₦78.58B). Load this directly into the workbench to test automated ingestion.',
    content: tbFebCsvRaw,
  },
  {
    id: 'coa_map',
    folder: 'data',
    name: 'savanna_pay_coa_mapping.csv',
    path: 'savanna-pay-fpa-workbench/data/savanna_pay_coa_mapping.csv',
    kind: 'text',
    mime: 'text/csv;charset=utf-8;',
    lesson:
      'Governed Chart of Accounts lookup mapping every fintech GL code to Asset/Liability/Equity groups, sections, Balance Sheet line items, and presentation signs (+1 / -1).',
    content: coaMappingCsvRaw,
  },
  {
    id: 'pq_transform',
    folder: 'power_query',
    name: 'transform_trial_balance.pq',
    path: 'savanna-pay-fpa-workbench/power_query/transform_trial_balance.pq',
    kind: 'text',
    mime: 'text/plain;charset=utf-8;',
    lesson:
      'Power Query M script connecting Folder.Files() to monthly TB exports, removing subtotal/blank noise, splitting AccountCode/Name, parsing NGN currencies, and deduplicating.',
    content: transformTbPqRaw,
  },
  {
    id: 'pq_merge',
    folder: 'power_query',
    name: 'merge_coa_mapping.pq',
    path: 'savanna-pay-fpa-workbench/power_query/merge_coa_mapping.pq',
    kind: 'text',
    mime: 'text/plain;charset=utf-8;',
    lesson:
      'Power Query M script performing a Left Outer Join against savanna_pay_coa_mapping.csv, flagging UNMAPPED codes, and computing Presented_Balance.',
    content: mergeCoaPqRaw,
  },
  {
    id: 'doc_dashboard',
    folder: 'docs',
    name: 'balance_sheet_dashboard.png',
    path: 'savanna-pay-fpa-workbench/docs/balance_sheet_dashboard.png',
    kind: 'png',
    lesson:
      'Exportable executive PNG snapshot of the current Management Balance Sheet KPIs & Financial Position summary, or jump straight into the interactive dashboard.',
  },
  {
    id: 'doc_lineage',
    folder: 'docs',
    name: 'power_query_lineage.png',
    path: 'savanna-pay-fpa-workbench/docs/power_query_lineage.png',
    kind: 'png',
    lesson:
      'Exportable PNG lineage diagram mapping all 6 Power Query transformation steps and row counts from raw TB ingestion to Financial_Position.',
  },
];

export function PortfolioKitDrawer({
  isOpen,
  onClose,
  summary,
  cleanRows,
  bsMap,
  validations,
  steps,
  displayScale,
  onLoadCsvToWorkbench,
  onNavigateView,
}: PortfolioKitDrawerProps) {
  const [selectedId, setSelectedId] = useState<RepoFileId>('readme');
  const [copiedId, setCopiedId] = useState<RepoFileId | null>(null);
  const [loadedCsvNotice, setLoadedCsvNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const activeFile = REPO_FILES.find((f) => f.id === selectedId) ?? REPO_FILES[0];

  const handleCopy = async () => {
    if (!activeFile.content) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
    } catch {
      // Clipboard fallback handled visually
    }
    setCopiedId(activeFile.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownload = () => {
    if (activeFile.kind === 'xlsx') {
      downloadWorkbenchXlsx({
        summary,
        cleanRows,
        bsMap,
        validations,
        scale: displayScale,
      });
      return;
    }
    if (activeFile.id === 'doc_dashboard') {
      downloadDashboardSnapshotPng(summary);
      return;
    }
    if (activeFile.id === 'doc_lineage') {
      downloadLineageSnapshotPng(steps);
      return;
    }
    if (activeFile.content) {
      downloadTextFile(activeFile.name, activeFile.content, activeFile.mime);
    }
  };

  const handleLoadSampleIntoPipeline = (file: RepoFileMeta) => {
    if (!file.content) return;
    const rows = parseCsvToTrialBalanceRows(file.content);
    onLoadCsvToWorkbench(rows, file.name);
    setLoadedCsvNotice(`Loaded ${file.name} (${rows.length} rows) into Nov_TB pipeline.`);
    setTimeout(() => setLoadedCsvNotice(null), 3500);
  };

  const getIcon = (file: RepoFileMeta) => {
    if (file.kind === 'xlsx') return <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />;
    if (file.kind === 'png') return <ImageIcon className="w-4 h-4 text-sky-700 shrink-0" />;
    if (file.name.endsWith('.pq')) return <FileCode2 className="w-4 h-4 text-amber-700 shrink-0" />;
    return <FileText className="w-4 h-4 text-slate-600 shrink-0" />;
  };

  return (
    <section
      aria-label="Savanna Pay FP&A Repo and Sample Data Kit"
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <FolderOpen className="w-4 h-4 text-emerald-700" />
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              savanna-pay-fpa-workbench/ — Portfolio Repo, M-Scripts, Sample CSVs &amp; .xlsx Workbook
            </h2>
            <p className="text-[11px] text-slate-500">
              Inspect, copy, or download every deliverable file—or load the 2026 sample fintech Trial Balance CSVs straight into the live Power Query engine.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-500 hover:text-slate-900 rounded cursor-pointer"
          aria-label="Close Repo & Data Kit"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: File Tree Explorer */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/40 divide-y divide-slate-100">
          {REPO_FILES.map((file) => {
            const isSelected = file.id === activeFile.id;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => setSelectedId(file.id)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-50/80 text-emerald-950'
                    : 'hover:bg-slate-100/70 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {getIcon(file)}
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold truncate">
                      {file.folder === 'root' ? file.name : `${file.folder}/${file.name}`}
                    </div>
                  </div>
                </div>
                <ArrowRight
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isSelected ? 'text-emerald-700' : 'text-slate-300'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Right: File Preview & Actions */}
        <div className="lg:col-span-8 p-5 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                {activeFile.path}
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {activeFile.lesson}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeFile.content && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedId === activeFile.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Content
                    </>
                  )}
                </button>
              )}

              {(activeFile.id === 'tb_jan' || activeFile.id === 'tb_feb') && (
                <button
                  type="button"
                  onClick={() => handleLoadSampleIntoPipeline(activeFile)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  Load into Workbench
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download {activeFile.name}
              </button>
            </div>
          </div>

          {loadedCsvNotice && (
            <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 flex items-center justify-between gap-2">
              <span>{loadedCsvNotice}</span>
              <button
                type="button"
                onClick={() => {
                  onNavigateView('financial_position');
                  onClose();
                }}
                className="font-semibold underline underline-offset-2 cursor-pointer"
              >
                View Statement
              </button>
            </div>
          )}

          {activeFile.kind === 'text' && activeFile.content && (
            <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 rounded-md p-4 overflow-x-auto max-h-[340px] leading-relaxed">
              <code>{activeFile.content}</code>
            </pre>
          )}

          {activeFile.kind === 'xlsx' && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-900">
                Included Excel Worksheets (5 Tabs)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                {[
                  { tab: 'Financial_Position', desc: 'Management Balance Sheet & equation check' },
                  { tab: 'TB_Clean', desc: `${cleanRows.length} cleaned & mapped GL rows` },
                  { tab: 'BS_Map', desc: `${bsMap.length} Chart of Accounts mapping rules` },
                  { tab: 'Dim_Period', desc: 'Reporting dates & fiscal period lookup' },
                  { tab: 'Validation_Check', desc: `${validations.length} period zero-net checks` },
                ].map((s) => (
                  <div key={s.tab} className="bg-white border border-slate-200 rounded p-2.5">
                    <div className="font-mono font-semibold text-emerald-800">{s.tab}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeFile.kind === 'png' && (
            <div className="bg-slate-50 border border-slate-200 rounded-md p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-slate-700 max-w-xl">
                Click <strong>Download {activeFile.name}</strong> above to export a high-resolution PNG snapshot of the live{' '}
                {activeFile.id === 'doc_dashboard'
                  ? 'Management Balance Sheet Dashboard'
                  : 'Power Query ETL Lineage'}
                , or open the interactive view directly.
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigateView(
                    activeFile.id === 'doc_dashboard' ? 'dashboard' : 'power_query'
                  );
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                Open Interactive View <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
