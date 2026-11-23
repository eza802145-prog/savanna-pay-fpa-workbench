import { BookOpen, Download, FolderOpen, RefreshCw, RotateCcw } from 'lucide-react';
import { DisplayScale, PeriodKey, WorkspaceView } from '../types/fpa';

interface TopBarProps {
  activeView: WorkspaceView;
  onSelectView: (view: WorkspaceView) => void;
  hasNovember: boolean;
  onToggleNovember: () => void;
  displayScale: DisplayScale;
  onChangeScale: (scale: DisplayScale) => void;
  latestPeriod: PeriodKey;
  isBalanced: boolean;
  unmappedCount: number;
  onExportCsv: () => void;
  onJumpToUnmapped: () => void;
  onJumpToDimPeriod: () => void;
  showLearningGuide: boolean;
  onToggleLearningGuide: () => void;
  showPortfolioKit: boolean;
  onTogglePortfolioKit: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'financial_position', label: 'Financial Position' },
  { id: 'dashboard', label: 'Management Dashboard' },
  { id: 'power_query', label: 'Power Query' },
  { id: 'worksheets', label: 'Trial Balances & Map' },
];

export function TopBar({
  activeView,
  onSelectView,
  hasNovember,
  onToggleNovember,
  displayScale,
  onChangeScale,
  latestPeriod,
  isBalanced,
  unmappedCount,
  onExportCsv,
  onJumpToUnmapped,
  onJumpToDimPeriod,
  showLearningGuide,
  onToggleLearningGuide,
  showPortfolioKit,
  onTogglePortfolioKit,
}: TopBarProps) {
  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onSelectView('financial_position')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Savanna Pay
        </button>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                  isActive
                    ? 'border-emerald-700 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {!hasNovember ? (
            <button
              type="button"
              onClick={onToggleNovember}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run Nov Refresh
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleNovember}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Oct-26
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Strip */}
      <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-4 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`text-xs font-medium py-1 whitespace-nowrap shrink-0 cursor-pointer ${
                isActive ? 'text-emerald-800 font-semibold underline underline-offset-4' : 'text-slate-600'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Workspace Context & Control Toolbar */}
      <div className="bg-slate-50/80 border-t border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 py-2.5 flex flex-wrap items-center justify-between gap-4">
          {/* Interactive Typographic Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <button
              type="button"
              onClick={onToggleLearningGuide}
              className="font-medium text-slate-800 hover:text-emerald-800 underline-offset-2 hover:underline cursor-pointer"
              title="Toggle FP&A Interactive Learning Guide"
            >
              Management Reporting Pack
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <button
              type="button"
              onClick={onJumpToDimPeriod}
              className="hover:text-slate-900 hover:underline underline-offset-2 cursor-pointer"
              title="Inspect Dim_Period table"
            >
              Periods: {hasNovember ? 'Aug-26 to Nov-26' : 'Aug-26 to Oct-26'}
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onSelectView('power_query')}
              className="hover:text-slate-900 hover:underline underline-offset-2 cursor-pointer"
              title="Inspect Trial Balance check query in Power Query"
            >
              Latest: {latestPeriod}
            </button>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <button
              type="button"
              onClick={() => onSelectView('financial_position')}
              className={`font-medium hover:underline underline-offset-2 cursor-pointer ${
                isBalanced ? 'text-emerald-700' : 'text-red-700'
              }`}
              title="Verify accounting equation check on Financial Position statement"
            >
              Accounting Equation: {isBalanced ? 'Balances' : 'Out of Balance'}
            </button>
            {unmappedCount > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={onJumpToUnmapped}
                  className="font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2 cursor-pointer"
                >
                  {unmappedCount} unmapped GL {unmappedCount === 1 ? 'account' : 'accounts'} — Resolve in BS_Map
                </button>
              </>
            )}
          </div>

          {/* Workspace Toolbar Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onTogglePortfolioKit}
              aria-expanded={showPortfolioKit}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showPortfolioKit
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              Repo &amp; Data Kit
            </button>

            <button
              type="button"
              onClick={onToggleLearningGuide}
              aria-expanded={showLearningGuide}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showLearningGuide
                  ? 'bg-emerald-800 text-white border-emerald-800'
                  : 'text-slate-700 bg-white hover:bg-slate-50 border-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              FP&amp;A Guide
            </button>

            <div
              className="flex items-center p-0.5 bg-slate-200/70 rounded-lg border border-slate-200"
              role="group"
              aria-label="Currency display scale"
            >
              <button
                type="button"
                onClick={() => onChangeScale('full')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  displayScale === 'full'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Full NGN
              </button>
              <button
                type="button"
                onClick={() => onChangeScale('millions')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  displayScale === 'millions'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                NGN Millions
              </button>
            </div>

            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
