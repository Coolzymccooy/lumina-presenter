/**
 * FilesPanel — desktop-grade file manager for Lumina run sheets and sermon archive.
 *
 * Layout:
 *   ┌ Tabs ─────────────────────────────┐
 *   │  [Run Sheets N]   [Sermons N]     │
 *   ├───────────────────────────────────┤
 *   │  Run Sheets tab                   │
 *   │    Search                         │
 *   │    Archive current run sheet      │
 *   │    Date-grouped cards             │
 *   │      (hover → action buttons)     │
 *   │    Import section (collapsible)   │
 *   ├───────────────────────────────────┤
 *   │  Sermons tab                      │
 *   │    Sermon cards: title/theme/meta │
 *   │    Copy text · Delete             │
 *   └───────────────────────────────────┘
 */
import React, { useState, useRef, useEffect } from 'react';
import type { ArchivedSermon } from '../../services/sermonArchive';
import type { ServiceItem } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RunSheetFileRecord {
  fileId: string;
  title: string;
  payload: { items: ServiceItem[]; selectedItemId?: string | null };
  createdByUid: string | null;
  createdByEmail: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
}

export interface FilesPanelProps {
  // Run sheets
  runSheetFiles: RunSheetFileRecord[];
  runSheetFilesLoading: boolean;
  runSheetFilesError: string | null;
  runSheetFileQuery: string;
  onRunSheetFileQueryChange: (q: string) => void;
  onRefreshFiles: () => void;
  onReuseRunSheet: (fileId: string, mode: 'replace' | 'duplicate') => void;
  onRenameRunSheet: (fileId: string) => void;
  onDeleteRunSheet: (fileId: string) => void;

  // Archive
  runSheetArchiveTitle: string;
  onRunSheetArchiveTitleChange: (t: string) => void;
  onArchiveRunSheet: (startNew: boolean) => void;

  // Sermon archive
  archivedSermons: ArchivedSermon[];
  archivedSermonsLoading: boolean;
  onRefreshSermons: () => void;
  onCopySermon: (item: ArchivedSermon) => void;
  onProjectSermon: (item: ArchivedSermon) => void;
  onInsertSermon: (item: ArchivedSermon) => void;
  onDeleteSermon: (id: string) => void;

  // Import
  isImportingDeck: boolean;
  importDeckStatus: string;
  importModalError?: string | null;
  onImportProPresenter: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportEasyWorship: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportOpenSong: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onImportOpenLyrics: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenLyricsImport: () => void;
  onAddVideoUrl: (url: string) => void;
}

// ─── Date grouping ─────────────────────────────────────────────────────────────

type DateGroup = 'Today' | 'This Week' | 'This Month' | 'Earlier';

function getDateGroup(ts: number): DateGroup {
  const now = new Date();
  const d = new Date(ts);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 86_400_000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  if (ts >= startOfDay) return 'Today';
  if (ts >= startOfWeek) return 'This Week';
  if (ts >= startOfMonth) return 'This Month';
  return 'Earlier';
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function groupFiles(files: RunSheetFileRecord[]): [DateGroup, RunSheetFileRecord[]][] {
  const order: DateGroup[] = ['Today', 'This Week', 'This Month', 'Earlier'];
  const map: Record<DateGroup, RunSheetFileRecord[]> = {
    Today: [],
    'This Week': [],
    'This Month': [],
    Earlier: [],
  };
  for (const f of files) {
    map[getDateGroup(f.updatedAt)].push(f);
  }
  return order
    .filter((g) => map[g].length > 0)
    .map((g) => [g, map[g]]);
}

// ─── Run sheet card ────────────────────────────────────────────────────────────

interface RunSheetCardProps {
  file: RunSheetFileRecord;
  onReuse: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}

const RunSheetCard: React.FC<RunSheetCardProps> = ({
  file,
  onReuse,
  onDuplicate,
  onRename,
  onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const itemCount = (file.payload?.items || []).length;

  return (
    <div className="group relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-transparent hover:border-zinc-700 hover:bg-zinc-900/60 transition-all cursor-default">
      {/* Icon */}
      <div className="mt-0.5 w-7 h-7 shrink-0 rounded bg-blue-950/60 border border-blue-900/40 flex items-center justify-center text-blue-400 text-[9px] font-black">
        RS
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1" onDoubleClick={onReuse} title="Double-click to reuse">
        <div className="text-[11px] font-semibold text-zinc-200 leading-tight truncate">
          {file.title}
        </div>
        <div className="text-[9px] text-zinc-600 mt-0.5">
          {formatDate(file.updatedAt)}
          {' · '}
          {itemCount} item{itemCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Action menu trigger */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-zinc-700 transition-all"
          title="Actions"
        >
          ···
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-7 z-50 w-40 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden py-1">
            <button
              onClick={() => { onReuse(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span className="text-blue-400">↩</span> Reuse
            </button>
            <button
              onClick={() => { onDuplicate(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span className="text-zinc-400">⧉</span> Duplicate
            </button>
            <button
              onClick={() => { onRename(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-2"
            >
              <span className="text-zinc-400">✎</span> Rename
            </button>
            <div className="mx-2 my-1 border-t border-zinc-800" />
            <button
              onClick={() => { onDelete(); setMenuOpen(false); }}
              className="w-full text-left px-3 py-2 text-[11px] font-medium text-rose-400 hover:bg-rose-950/40 transition-colors flex items-center gap-2"
            >
              <span>⊗</span> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Sermon card ───────────────────────────────────────────────────────────────

interface SermonCardProps {
  item: ArchivedSermon;
  onCopy: () => void;
  onProjectToScreen: () => void;
  onInsertToRunsheet: () => void;
  onDelete: () => void;
}

const SermonCard: React.FC<SermonCardProps> = ({ item, onCopy, onProjectToScreen, onInsertToRunsheet, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group rounded-lg border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all overflow-hidden">
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-zinc-100 leading-tight">
              {item.summary.title || 'Untitled Sermon'}
            </div>
            {item.summary.mainTheme && !expanded && (
              <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                {item.summary.mainTheme}
              </div>
            )}
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 mt-0.5 text-zinc-600 hover:text-zinc-300 transition-colors text-[9px] font-black"
            title={expanded ? 'Collapse' : 'Show theme, key points & call to action'}
          >
            {expanded ? '▲' : '▼'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-[9px] text-zinc-600">{formatDate(item.savedAt)}</span>
          <span className="text-zinc-800">·</span>
          <span className="text-[9px] text-zinc-600">{item.wordCount.toLocaleString()} words</span>
          {item.summary.keyPoints?.length > 0 && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="text-[9px] text-zinc-600">{item.summary.keyPoints.length} points</span>
            </>
          )}
          {item.summary.scripturesReferenced?.length > 0 && (
            <>
              <span className="text-zinc-800">·</span>
              <span className="text-[9px] text-amber-600/80">
                {item.summary.scripturesReferenced.slice(0, 2).join(', ')}
                {item.summary.scripturesReferenced.length > 2 ? '…' : ''}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-zinc-800/60 pt-2.5">
          {item.summary.mainTheme && (
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-violet-500/70 mb-1">Theme</div>
              <p className="text-[10px] text-zinc-200 leading-relaxed">{item.summary.mainTheme}</p>
            </div>
          )}
          {item.summary.keyPoints?.length > 0 && (
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-500/70 mb-1">Key Points</div>
              <ol className="space-y-1">
                {item.summary.keyPoints.map((pt, i) => (
                  <li key={i} className="text-[10px] text-zinc-300 leading-snug flex gap-2">
                    <span className="text-zinc-600 font-mono shrink-0">{i + 1}.</span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {item.summary.callToAction && (
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-emerald-500/70 mb-1">Call to Action</div>
              <p className="text-[10px] text-zinc-300 italic leading-relaxed">{item.summary.callToAction}</p>
            </div>
          )}
          {item.summary.scripturesReferenced?.length > 0 && (
            <div>
              <div className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-500/70 mb-1">Scriptures</div>
              <div className="flex flex-wrap gap-1">
                {item.summary.scripturesReferenced.map((ref, i) => (
                  <span key={i} className="text-[9px] font-mono text-amber-400/80 bg-amber-950/30 border border-amber-900/30 px-1.5 py-0.5 rounded">
                    {ref}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex border-t border-zinc-800/60 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onProjectToScreen}
          className="flex-1 py-1.5 text-[9px] font-bold text-red-300 hover:bg-red-950/50 transition-colors border-r border-zinc-800/60 flex items-center justify-center gap-1"
          title="Send sermon recap to the live output screen"
        >
          ▶ Project
        </button>
        <button
          onClick={onInsertToRunsheet}
          className="flex-1 py-1.5 text-[9px] font-bold text-purple-300 hover:bg-purple-950/40 transition-colors border-r border-zinc-800/60 flex items-center justify-center gap-1"
          title="Add sermon recap to run sheet without going live"
        >
          + Runsheet
        </button>
        <button
          onClick={onCopy}
          className="flex-1 py-1.5 text-[9px] font-bold text-zinc-300 hover:bg-zinc-800 transition-colors border-r border-zinc-800/60 flex items-center justify-center gap-1"
          title="Copy sermon summary to clipboard"
        >
          ⧉ Copy
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 text-[9px] font-bold text-rose-500 hover:bg-rose-950/40 transition-colors flex items-center justify-center"
          title="Delete this sermon from archive"
        >
          ⊗
        </button>
      </div>
    </div>
  );
};

// ─── Main panel ────────────────────────────────────────────────────────────────

type Tab = 'runsheets' | 'sermons' | 'import';

export const FilesPanel: React.FC<FilesPanelProps> = ({
  runSheetFiles,
  runSheetFilesLoading,
  runSheetFilesError,
  runSheetFileQuery,
  onRunSheetFileQueryChange,
  onRefreshFiles,
  onReuseRunSheet,
  onRenameRunSheet,
  onDeleteRunSheet,
  runSheetArchiveTitle,
  onRunSheetArchiveTitleChange,
  onArchiveRunSheet,
  archivedSermons,
  archivedSermonsLoading,
  onRefreshSermons,
  onCopySermon,
  onProjectSermon,
  onInsertSermon,
  onDeleteSermon,
  isImportingDeck,
  importDeckStatus,
  importModalError,
  onImportProPresenter,
  onImportEasyWorship,
  onImportOpenSong,
  onImportOpenLyrics,
  onOpenLyricsImport,
  onAddVideoUrl,
}) => {
  const [tab, setTab] = useState<Tab>('runsheets');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [videoUrlDraft, setVideoUrlDraft] = useState('');

  const grouped = groupFiles(runSheetFiles);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Tab bar ── */}
      <div className="flex shrink-0 border-b border-zinc-800 bg-zinc-950/60">
        <button
          onClick={() => setTab('runsheets')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors border-b-2 ${
            tab === 'runsheets'
              ? 'border-blue-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Run Sheets
          {runSheetFiles.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${tab === 'runsheets' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {runSheetFiles.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('sermons')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors border-b-2 ${
            tab === 'sermons'
              ? 'border-violet-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Sermons
          {archivedSermons.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black ${tab === 'sermons' ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
              {archivedSermons.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('import')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-wider transition-colors border-b-2 ${
            tab === 'import'
              ? 'border-emerald-500 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Import
        </button>
      </div>

      {/* ══════════ RUN SHEETS TAB ══════════ */}
      {tab === 'runsheets' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Search + Refresh */}
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                value={runSheetFileQuery}
                onChange={(e) => onRunSheetFileQueryChange(e.target.value)}
                placeholder="Search run sheets…"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-7 pr-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600 text-[10px]">⌕</span>
            </div>
            <button
              onClick={onRefreshFiles}
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors text-sm"
              title="Refresh"
            >
              ↻
            </button>
          </div>

          {/* Error */}
          {runSheetFilesError && (
            <div className="mx-3 mb-2 text-[10px] text-amber-400 border border-amber-900/50 bg-amber-950/20 rounded-lg px-2.5 py-2 leading-snug">
              {runSheetFilesError}
            </div>
          )}

          {/* ── Archive current ── */}
          <div className="px-3 pb-2">
            <button
              onClick={() => setArchiveOpen((v) => !v)}
              className="w-full flex items-center gap-2 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <span className={`transition-transform text-[8px] ${archiveOpen ? 'rotate-90' : ''}`}>▶</span>
              Archive current run sheet
            </button>
            {archiveOpen && (
              <div className="mt-1.5 space-y-1.5">
                <input
                  value={runSheetArchiveTitle}
                  onChange={(e) => onRunSheetArchiveTitleChange(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onArchiveRunSheet(false)}
                    className="flex-1 py-1.5 text-[9px] font-bold border border-zinc-700 rounded-lg bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition-colors"
                  >
                    Archive
                  </button>
                  <button
                    onClick={() => onArchiveRunSheet(true)}
                    className="flex-1 py-1.5 text-[9px] font-bold border border-blue-800/60 rounded-lg bg-blue-950/40 text-blue-300 hover:bg-blue-900/40 hover:border-blue-600 transition-colors"
                  >
                    Archive + New
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mx-3 border-t border-zinc-800/60 mb-1" />

          {/* Loading */}
          {runSheetFilesLoading && (
            <div className="px-3 py-4 text-center text-[10px] text-zinc-600">Loading…</div>
          )}

          {/* Empty state */}
          {!runSheetFilesLoading && runSheetFiles.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="text-2xl mb-2 opacity-20">📄</div>
              <div className="text-[11px] text-zinc-500 font-medium">No saved run sheets</div>
              <div className="text-[9px] text-zinc-700 mt-1">Archive the current run sheet to save it here</div>
            </div>
          )}

          {/* Date-grouped cards */}
          {!runSheetFilesLoading && grouped.map(([group, files]) => (
            <div key={group} className="px-3 pb-1">
              <div className="text-[8px] font-black uppercase tracking-[0.2em] text-zinc-700 px-1 pt-2 pb-1">
                {group}
              </div>
              {files.map((file) => (
                <RunSheetCard
                  key={file.fileId}
                  file={file}
                  onReuse={() => onReuseRunSheet(file.fileId, 'replace')}
                  onDuplicate={() => onReuseRunSheet(file.fileId, 'duplicate')}
                  onRename={() => onRenameRunSheet(file.fileId)}
                  onDelete={() => onDeleteRunSheet(file.fileId)}
                />
              ))}
            </div>
          ))}

        </div>
      )}

      {/* ══════════ SERMONS TAB ══════════ */}
      {tab === 'sermons' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Header */}
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600">
              Sermon Archive
            </span>
            <button
              onClick={onRefreshSermons}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600 transition-colors text-sm"
              title="Refresh sermon archive"
            >
              ↻
            </button>
          </div>

          {archivedSermonsLoading && (
            <div className="px-3 py-4 text-center text-[10px] text-zinc-600">Loading…</div>
          )}

          {!archivedSermonsLoading && archivedSermons.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="text-2xl mb-2 opacity-20">🎤</div>
              <div className="text-[11px] text-zinc-500 font-medium">No sermon summaries yet</div>
              <div className="text-[9px] text-zinc-700 mt-1 leading-relaxed">
                Use the AI Sermon tool to generate and save sermon summaries here
              </div>
            </div>
          )}

          <div className="px-3 pb-4 space-y-2">
            {archivedSermons.map((item) => (
              <SermonCard
                key={item.id}
                item={item}
                onCopy={() => onCopySermon(item)}
                onProjectToScreen={() => onProjectSermon(item)}
                onInsertToRunsheet={() => onInsertSermon(item)}
                onDelete={() => onDeleteSermon(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ══════════ IMPORT TAB ══════════ */}
      {tab === 'import' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-3 pt-3 pb-2">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-0.5">Import from another app</p>
            <p className="text-[9px] text-zinc-700 leading-relaxed">
              Convert slides and lyrics from other worship software into Lumina items.
            </p>
          </div>

          <div className="px-3 pb-4 space-y-2">
            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border bg-zinc-900/60 transition-colors group ${isImportingDeck ? 'opacity-50 cursor-not-allowed border-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-600 cursor-pointer'}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-900/60 border border-purple-800/40 text-purple-300 text-[9px] font-black shrink-0">PP</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-zinc-200 group-hover:text-white leading-tight">ProPresenter</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">.pro6 · .pro6x · .pro</div>
              </div>
              <span className="text-zinc-700 text-[10px] group-hover:text-zinc-400 transition-colors">↑</span>
              <input type="file" accept=".pro6,.pro6x,.pro" className="hidden" onChange={onImportProPresenter} disabled={isImportingDeck} />
            </label>

            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border bg-zinc-900/60 transition-colors group ${isImportingDeck ? 'opacity-50 cursor-not-allowed border-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-600 cursor-pointer'}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-900/60 border border-emerald-800/40 text-emerald-300 text-[9px] font-black shrink-0">EW</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-zinc-200 group-hover:text-white leading-tight">EasyWorship</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">.ewsx · .ewp</div>
              </div>
              <span className="text-zinc-700 text-[10px] group-hover:text-zinc-400 transition-colors">↑</span>
              <input type="file" accept=".ewsx,.ewp" className="hidden" onChange={onImportEasyWorship} disabled={isImportingDeck} />
            </label>

            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border bg-zinc-900/60 transition-colors group ${isImportingDeck ? 'opacity-50 cursor-not-allowed border-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-600 cursor-pointer'}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-900/60 border border-amber-800/40 text-amber-300 text-[9px] font-black shrink-0">OS</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-zinc-200 group-hover:text-white leading-tight">OpenSong</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">.ofs · .xml</div>
              </div>
              <span className="text-zinc-700 text-[10px] group-hover:text-zinc-400 transition-colors">↑</span>
              <input type="file" accept=".ofs,.xml,.opensong" className="hidden" onChange={onImportOpenSong} disabled={isImportingDeck} />
            </label>

            <label className={`flex items-center gap-3 px-3 py-3 rounded-xl border bg-zinc-900/60 transition-colors group ${isImportingDeck ? 'opacity-50 cursor-not-allowed border-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-600 cursor-pointer'}`}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-900/60 border border-green-800/40 text-green-300 text-[9px] font-black shrink-0">OL</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-zinc-200 group-hover:text-white leading-tight">OpenLyrics</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">.xml · OpenLP · WorshipAssistant</div>
              </div>
              <span className="text-zinc-700 text-[10px] group-hover:text-zinc-400 transition-colors">↑</span>
              <input type="file" accept=".xml" className="hidden" onChange={onImportOpenLyrics} disabled={isImportingDeck} />
            </label>

            <button
              onClick={onOpenLyricsImport}
              disabled={isImportingDeck}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border bg-zinc-900/60 transition-colors group text-left ${isImportingDeck ? 'opacity-50 cursor-not-allowed border-zinc-800' : 'border-zinc-800 hover:bg-zinc-800/80 hover:border-zinc-600 cursor-pointer'}`}
            >
              <span className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-900/60 border border-blue-800/40 text-blue-300 text-[9px] font-black shrink-0">PPT</span>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-zinc-200 group-hover:text-white leading-tight">PowerPoint / PDF</div>
                <div className="text-[9px] text-zinc-500 mt-0.5">.pptx · .pdf · lyrics</div>
              </div>
              <span className="text-zinc-700 text-[10px] group-hover:text-zinc-400 transition-colors">↑</span>
            </button>

            {isImportingDeck && (
              <div className="mt-1 text-[10px] text-cyan-300 border border-cyan-900/40 bg-cyan-950/20 rounded-xl px-3 py-2.5 leading-snug flex items-center gap-2">
                <span className="animate-spin text-[12px]">⟳</span>
                {importDeckStatus || 'Importing…'}
              </div>
            )}
            {!isImportingDeck && importModalError && (
              <div className="mt-1 text-[10px] text-red-400 border border-red-900/50 bg-red-950/20 rounded-xl px-3 py-2.5 leading-snug">
                {importModalError}
              </div>
            )}
          </div>

          {/* ── YouTube / Video URL ── */}
          <div className="px-3 pt-1 pb-4">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-2">Video URL</p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="text-[9px] text-zinc-500 leading-relaxed mb-2.5">
                Paste a YouTube link or direct video URL to add it as a media item in your run sheet.
              </p>
              <div className="flex gap-1.5">
                <input
                  type="url"
                  value={videoUrlDraft}
                  onChange={(e) => setVideoUrlDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && videoUrlDraft.trim()) {
                      onAddVideoUrl(videoUrlDraft.trim());
                      setVideoUrlDraft('');
                    }
                  }}
                  placeholder="youtube.com/watch?v=… or video URL"
                  className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-2 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
                />
                <button
                  onClick={() => {
                    if (!videoUrlDraft.trim()) return;
                    onAddVideoUrl(videoUrlDraft.trim());
                    setVideoUrlDraft('');
                  }}
                  disabled={!videoUrlDraft.trim()}
                  className="shrink-0 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-950 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
