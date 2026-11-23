import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { BALANCE_SHEET_STRUCTURE, DIM_PERIOD_TABLE } from '../data/savannaPayData';
import {
  BalanceSheetLineItem,
  BalanceSheetSection,
  BSMapEntry,
  CleanedTrialBalanceRow,
  DisplayScale,
  PeriodKey,
  RawTrialBalanceRow,
} from '../types/fpa';
import {
  downloadSampleNovCsv,
  formatAccountingNgn,
  parseCsvToTrialBalanceRows,
} from '../utils/powerQueryEngine';

export type SheetTabId =
  | 'Aug_TB'
  | 'Sep_TB'
  | 'Oct_TB'
  | 'Nov_TB'
  | 'BS_Map'
  | 'Dim_Period'
  | 'TB_Clean';

interface TrialBalancesAndMapProps {
  activeTab: SheetTabId;
  onSelectTab: (tab: SheetTabId) => void;
  hasNovember: boolean;
  rawSheets: Record<'Aug_TB' | 'Sep_TB' | 'Oct_TB' | 'Nov_TB', RawTrialBalanceRow[]>;
  cleanRows: CleanedTrialBalanceRow[];
  bsMap: BSMapEntry[];
  unmappedAccounts: Array<{
    accountCode: string;
    accountName: string;
    period: PeriodKey;
    netAmount: number;
  }>;
  displayScale: DisplayScale;
  onUpdateMapping: (
    accountCode: string,
    accountName: string,
    section: BalanceSheetSection,
    lineItem: BalanceSheetLineItem,
    presentationSign: 1 | -1
  ) => void;
  onAutoMapSuggested: () => void;
  onUploadNovCsv: (rows: RawTrialBalanceRow[], fileName: string) => void;
  uploadedCsvFileName: string | null;
  onSelectPeriodFromDim: (period: PeriodKey) => void;
}

const ALL_LINE_ITEMS: Array<{
  section: BalanceSheetSection;
  lineItem: BalanceSheetLineItem;
  defaultSign: 1 | -1;
}> = BALANCE_SHEET_STRUCTURE.flatMap((sec) =>
  sec.items.map((item) => ({
    section: sec.section,
    lineItem: item.lineItem,
    defaultSign:
      sec.section === 'CURRENT LIABILITIES' ||
      sec.section === 'NON-CURRENT LIABILITIES' ||
      sec.section === 'EQUITY'
        ? -1
        : 1,
  }))
);

export function TrialBalancesAndMap({
  activeTab,
  onSelectTab,
  hasNovember,
  rawSheets,
  cleanRows,
  bsMap,
  unmappedAccounts,
  displayScale,
  onUpdateMapping,
  onAutoMapSuggested,
  onUploadNovCsv,
  uploadedCsvFileName,
  onSelectPeriodFromDim,
}: TrialBalancesAndMapProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodKey | 'ALL'>('ALL');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedMapCode, setSelectedMapCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const parsed = parseCsvToTrialBalanceRows(text);
      if (parsed.length === 0) {
        setUploadError(
          'Could not parse CSV rows. Expected headers such as ReportDate,Account_Code_Name,Debit_Amt,Credit_Amt.'
        );
        return;
      }
      onUploadNovCsv(parsed, file.name);
      onSelectTab('Nov_TB');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const availableTabs: Array<{ id: SheetTabId; label: string; count?: number }> = [
    { id: 'Aug_TB', label: 'Aug_TB' },
    { id: 'Sep_TB', label: 'Sep_TB' },
    { id: 'Oct_TB', label: 'Oct_TB' },
    ...(hasNovember ? [{ id: 'Nov_TB' as SheetTabId, label: 'Nov_TB' }] : []),
    {
      id: 'BS_Map',
      label: 'BS_Map',
      count: unmappedAccounts.length > 0 ? unmappedAccounts.length : undefined,
    },
    { id: 'Dim_Period', label: 'Dim_Period' },
    { id: 'TB_Clean', label: 'TB_Clean' },
  ];

  const query = searchTerm.trim().toLowerCase();

  const filteredCleanRows = useMemo(() => {
    return cleanRows.filter((row) => {
      if (periodFilter !== 'ALL' && row.period !== periodFilter) return false;
      if (!query) return true;
      return (
        row.accountCode.toLowerCase().includes(query) ||
        row.accountName.toLowerCase().includes(query) ||
        row.bsLineItem.toLowerCase().includes(query)
      );
    });
  }, [cleanRows, periodFilter, query]);

  const filteredBsMap = useMemo(() => {
    if (!query) return bsMap;
    return bsMap.filter(
      (m) =>
        m.accountCode.toLowerCase().includes(query) ||
        m.accountName.toLowerCase().includes(query) ||
        m.bsLineItem.toLowerCase().includes(query)
    );
  }, [bsMap, query]);

  // Unique unmapped accounts by accountCode
  const uniqueUnmapped = useMemo(() => {
    const seen = new Map<
      string,
      { accountCode: string; accountName: string; period: PeriodKey; netAmount: number }
    >();
    for (const item of unmappedAccounts) {
      if (!seen.has(item.accountCode)) {
        seen.set(item.accountCode, item);
      }
    }
    return Array.from(seen.values());
  }, [unmappedAccounts]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">
            Workbook Sheets: Trial Balances &amp; BS_Map
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Inspect raw ERP Trial Balance exports, the consolidated TB_Clean table, and edit account mappings in BS_Map.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => downloadSampleNovCsv(rawSheets.Nov_TB)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Sample Nov CSV
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import TB CSV
          </button>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search account code or name..."
              className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-emerald-700 w-56"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-4 py-2.5">
          {uploadError}
        </div>
      )}

      {uploadedCsvFileName && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg px-4 py-2.5 flex items-center justify-between">
          <span>
            Ingested custom Trial Balance CSV: <strong>{uploadedCsvFileName}</strong> → Consolidated into TB_Clean
          </span>
        </div>
      )}

      {/* Workbook Sheet Container */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {/* Excel-style Bottom/Top Sheet Tabs */}
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-4 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {availableTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectTab(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-white text-emerald-800 font-semibold border border-slate-300 shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-200/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="text-amber-700 font-mono font-bold">
                      ({tab.count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'TB_Clean' && (
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200 shrink-0">
              {(['ALL', 'Aug-26', 'Sept-26', 'Oct-26', ...(hasNovember ? ['Nov-26'] : [])] as Array<
                PeriodKey | 'ALL'
              >).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodFilter(p)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    periodFilter === p
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {p === 'ALL' ? 'All Periods' : p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tab Content */}
        {(activeTab === 'Aug_TB' ||
          activeTab === 'Sep_TB' ||
          activeTab === 'Oct_TB' ||
          activeTab === 'Nov_TB') && (
          <RawSheetTable
            sheetName={activeTab}
            rows={rawSheets[activeTab]}
            searchQuery={query}
          />
        )}

        {activeTab === 'Dim_Period' && (
          <div>
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
              Date / Period lookup table driving dynamic period switching, MoM prior-period pairing, and XLOOKUP reporting labels.
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">PeriodKey (Text)</th>
                    <th className="py-2.5 px-4 font-semibold">PeriodEndDate (Date)</th>
                    <th className="py-2.5 px-4 font-semibold">FiscalLabel</th>
                    <th className="py-2.5 px-4 font-semibold">PriorPeriod</th>
                    <th className="py-2.5 px-4 font-semibold">Quarter</th>
                    <th className="py-2.5 px-4 font-semibold">Cycle Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {DIM_PERIOD_TABLE.map((row) => {
                    const isLoaded =
                      row.periodKey !== 'Nov-26' || hasNovember;
                    return (
                      <tr
                        key={row.periodKey}
                        onClick={() => {
                          if (isLoaded) onSelectPeriodFromDim(row.periodKey);
                        }}
                        className={
                          isLoaded
                            ? 'hover:bg-slate-50 cursor-pointer transition-colors'
                            : 'bg-slate-50/50 text-slate-400'
                        }
                      >
                        <td className="py-2.5 px-4 font-mono font-semibold text-blue-800">
                          <span className="inline-flex items-center gap-1">
                            {row.periodKey}
                            {isLoaded && <ExternalLink className="w-3 h-3" />}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-700">
                          {row.periodEndDate}
                        </td>
                        <td className="py-2.5 px-4 text-slate-800">
                          {row.fiscalLabel}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-slate-600">
                          {row.priorPeriod ?? '-'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{row.quarter}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`font-medium ${
                              isLoaded ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {isLoaded
                              ? 'Loaded — Click to view Balance Sheet'
                              : 'Pending Refresh'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'TB_Clean' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Period <span className="font-normal text-slate-400">(Date)</span></th>
                  <th className="py-2.5 px-3 font-semibold">Source</th>
                  <th className="py-2.5 px-3 font-semibold">Code <span className="font-normal text-slate-400">(Text)</span></th>
                  <th className="py-2.5 px-3 font-semibold">Account Name</th>
                  <th className="py-2.5 px-3 font-semibold">BS Section</th>
                  <th className="py-2.5 px-3 font-semibold">BS Line Item</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Debit <span className="font-normal text-slate-400">(Curr)</span></th>
                  <th className="py-2.5 px-3 font-semibold text-right">Credit <span className="font-normal text-slate-400">(Curr)</span></th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Balance <span className="font-normal text-slate-400">(Curr)</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCleanRows.map((row) => (
                  <tr
                    key={row.id}
                    className={!row.isMapped ? 'bg-amber-50/70' : 'hover:bg-slate-50'}
                  >
                    <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">
                      {row.period}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">
                      {row.sourceSheet}
                    </td>
                    <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                      {row.accountCode}
                    </td>
                    <td className="py-2 px-3 text-slate-800">{row.accountName}</td>
                    <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                      {row.isMapped ? (
                        row.bsSection
                      ) : (
                        <span className="text-amber-800 font-semibold">UNMAPPED</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      {row.isMapped ? (
                        row.bsLineItem
                      ) : (
                        <span className="text-amber-800 font-semibold">
                          Requires BS_Map Assignment
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatAccountingNgn(row.debit, displayScale)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatAccountingNgn(row.credit, displayScale)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatAccountingNgn(row.netAmount, displayScale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'BS_Map' && (
          <div className="divide-y divide-slate-200">
            {/* Unmapped Accounts Resolution Section */}
            {uniqueUnmapped.length > 0 && (
              <div className="p-4 bg-amber-50/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <h2 className="text-sm font-bold text-amber-950">
                      Unmapped GL Accounts ({uniqueUnmapped.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onAutoMapSuggested}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Apply Suggested Mappings
                  </button>
                </div>

                <div className="bg-white border border-amber-200 rounded-lg divide-y divide-amber-100">
                  {uniqueUnmapped.map((item) => (
                    <div
                      key={item.accountCode}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-mono font-bold text-slate-900">
                          {item.accountCode} · {item.accountName}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Detected in {item.period} · Net Balance:{' '}
                          <span className="font-mono font-semibold text-slate-800">
                            {formatAccountingNgn(item.netAmount, displayScale, true)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <label
                          htmlFor={`map-${item.accountCode}`}
                          className="text-xs text-slate-600"
                        >
                          Assign Line Item:
                        </label>
                        <select
                          id={`map-${item.accountCode}`}
                          defaultValue=""
                          onChange={(e) => {
                            const chosen = ALL_LINE_ITEMS.find(
                              (li) => li.lineItem === e.target.value
                            );
                            if (chosen) {
                              onUpdateMapping(
                                item.accountCode,
                                item.accountName,
                                chosen.section,
                                chosen.lineItem,
                                chosen.defaultSign
                              );
                            }
                          }}
                          className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-900 focus:outline-none focus:border-emerald-700"
                        >
                          <option value="" disabled>
                            Select BS Line Item...
                          </option>
                          {ALL_LINE_ITEMS.map((li) => (
                            <option key={li.lineItem} value={li.lineItem}>
                              {li.section} — {li.lineItem}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Complete BS_Map Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">Account Code</th>
                    <th className="py-2.5 px-3 font-semibold">Account Name</th>
                    <th className="py-2.5 px-3 font-semibold">BS Section</th>
                    <th className="py-2.5 px-3 font-semibold">BS Line Item (Editable)</th>
                    <th className="py-2.5 px-3 font-semibold">Normal Balance</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Sign</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBsMap.map((entry) => {
                    const isSelected = selectedMapCode === entry.accountCode;
                    return (
                      <tr
                        key={entry.accountCode}
                        onClick={() =>
                          setSelectedMapCode((prev) =>
                            prev === entry.accountCode ? null : entry.accountCode
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 px-3 font-mono font-semibold text-blue-800">
                          {entry.accountCode}
                        </td>
                        <td className="py-2 px-3 text-slate-800">
                          <div>{entry.accountName}</div>
                          {isSelected && entry.notes && (
                            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-emerald-700 shrink-0" />
                              {entry.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                          {entry.bsSection}
                        </td>
                        <td
                          className="py-2 px-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <select
                            aria-label={`Line item for ${entry.accountCode}`}
                            value={entry.bsLineItem}
                            onChange={(e) => {
                              const chosen = ALL_LINE_ITEMS.find(
                                (li) => li.lineItem === e.target.value
                              );
                              if (chosen) {
                                onUpdateMapping(
                                  entry.accountCode,
                                  entry.accountName,
                                  chosen.section,
                                  chosen.lineItem,
                                  entry.accountCode === '1320'
                                    ? 1
                                    : chosen.defaultSign
                                );
                              }
                            }}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-900 focus:outline-none focus:border-emerald-700 cursor-pointer"
                          >
                            {ALL_LINE_ITEMS.map((li) => (
                              <option key={li.lineItem} value={li.lineItem}>
                                {li.lineItem}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {entry.normalBalance}
                        </td>
                        <td
                          className="py-2 px-3 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            title="Toggle presentation sign (+1 Debit / -1 Credit)"
                            onClick={() =>
                              onUpdateMapping(
                                entry.accountCode,
                                entry.accountName,
                                entry.bsSection,
                                entry.bsLineItem,
                                entry.presentationSign === 1 ? -1 : 1
                              )
                            }
                            className="font-mono text-xs font-semibold px-2 py-0.5 rounded border border-slate-200 bg-white hover:border-emerald-700 text-slate-800 cursor-pointer"
                          >
                            {entry.presentationSign > 0 ? '+1' : '-1'}
                          </button>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mapped
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RawSheetTable({
  sheetName,
  rows,
  searchQuery,
}: {
  sheetName: string;
  rows: RawTrialBalanceRow[];
  searchQuery: string;
}) {
  const [selectedRawRow, setSelectedRawRow] = useState<RawTrialBalanceRow | null>(
    null
  );

  const columns = useMemo(() => {
    const firstNonEmpty = rows.find((r) => Object.keys(r.rawColumns).length > 0);
    return firstNonEmpty ? Object.keys(firstNonEmpty.rawColumns) : [];
  }, [rows]);

  const filtered = useMemo(() => {
    if (!searchQuery) return rows;
    return rows.filter((r) =>
      Object.values(r.rawColumns).some((val) =>
        val.toLowerCase().includes(searchQuery)
      )
    );
  }, [rows, searchQuery]);

  const getTagExplanation = (hint?: RawTrialBalanceRow['rowTypeHint']) => {
    if (hint === 'blank') {
      return 'Blank Separator Row — Stripped by Power Query Table.SelectRows so empty lines do not create null account rows in TB_Clean.';
    }
    if (hint === 'total') {
      return 'ERP Summary / Total Row — Stripped by Power Query before aggregation to prevent double-counting subtotals inside SUMIFS.';
    }
    if (hint === 'duplicate') {
      return 'Duplicate Export Record — Stripped by Power Query Table.Distinct({"Period", "AccountCode", "NetAmount"}) so balances remain accurate.';
    }
    return 'Valid GL Account Record — Retained, account code split into Text, currency parsed to Currency.Type, and joined against BS_Map.';
  };

  return (
    <div>
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          Raw ERP export <strong className="text-slate-900">{sheetName}</strong> — click any row to see how Power Query cleans and classifies it.
        </span>
        <span className="font-mono text-slate-500">{rows.length} raw rows</span>
      </div>

      {selectedRawRow && (
        <div className="px-4 py-2.5 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
            <span>{getTagExplanation(selectedRawRow.rowTypeHint)}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedRawRow(null)}
            aria-label="Close row explanation"
            className="p-1 text-emerald-800 hover:bg-emerald-100 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <th className="py-2 px-3 font-semibold w-12">#</th>
              <th className="py-2 px-3 font-semibold">Power Query Tag</th>
              {columns.map((col) => (
                <th key={col} className="py-2 px-3 font-mono font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((row, idx) => {
              const isFlagged =
                row.rowTypeHint === 'blank' ||
                row.rowTypeHint === 'total' ||
                row.rowTypeHint === 'duplicate';
              const isSelected = selectedRawRow?.id === row.id;

              return (
                <tr
                  key={row.id}
                  onClick={() =>
                    setSelectedRawRow((prev) =>
                      prev?.id === row.id ? null : row
                    )
                  }
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/80'
                      : isFlagged
                      ? 'bg-amber-50/50 hover:bg-amber-50'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-2 px-3 font-mono text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    {row.rowTypeHint === 'blank' && (
                      <span className="text-amber-800 font-medium">
                        Stripped: Blank Row
                      </span>
                    )}
                    {row.rowTypeHint === 'total' && (
                      <span className="text-amber-800 font-medium">
                        Stripped: Total Row
                      </span>
                    )}
                    {row.rowTypeHint === 'duplicate' && (
                      <span className="text-red-700 font-medium">
                        Stripped: Duplicate
                      </span>
                    )}
                    {(!row.rowTypeHint || row.rowTypeHint === 'valid') && (
                      <span className="text-emerald-700 font-medium">
                        Retained
                      </span>
                    )}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="py-2 px-3 font-mono text-slate-800 whitespace-nowrap"
                    >
                      {row.rawColumns[col] || (
                        <span className="text-slate-300 italic">(empty)</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
