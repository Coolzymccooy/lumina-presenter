import React, { useState } from "react";
import type { SermonSummary } from "../services/sermonSummaryService";

interface SermonSummaryPanelProps {
  summary: SermonSummary;
  wordCount: number;
  durationMs?: number;
  onClose: () => void;
  onAddToSchedule?: (text: string) => void;
  onProjectRecap?: () => void;
  onArchive?: () => void;
  archived?: boolean;
}

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="mb-3">
    <div className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-400/80 mb-1.5">{label}</div>
    {children}
  </div>
);

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-1.5 text-[9px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
      title="Copy"
    >
      {copied ? "✓" : "copy"}
    </button>
  );
};

export const SermonSummaryPanel: React.FC<SermonSummaryPanelProps> = ({
  summary,
  wordCount,
  durationMs,
  onClose,
  onAddToSchedule,
  onProjectRecap,
  onArchive,
  archived,
}) => {
  const [activeTab, setActiveTab] = useState<"summary" | "quotes">("summary");

  const fullText = [
    `SERMON: ${summary.title}`,
    ``,
    `THEME: ${summary.mainTheme}`,
    ``,
    `KEY POINTS:`,
    ...summary.keyPoints.map((p, i) => `${i + 1}. ${p}`),
    ``,
    `SCRIPTURES: ${summary.scripturesReferenced.join(" · ") || "None detected"}`,
    ``,
    `CALL TO ACTION: ${summary.callToAction}`,
    ...(summary.quotableLines.length
      ? [``, `QUOTES:`, ...summary.quotableLines.map((q) => `"${q}"`)]
      : []),
  ].join("\n");

  const durationLabel = durationMs ? ` · ${Math.round(durationMs / 1000)}s to generate` : "";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-zinc-800">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.22em] text-purple-400/70">Sermon Summary</div>
          <div className="text-xs font-bold text-zinc-100 mt-0.5 leading-tight">{summary.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-zinc-600">{wordCount.toLocaleString()} words{durationLabel}</span>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors text-base leading-none px-1"
            title="Close summary"
          >
            ×
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-zinc-800 px-3 pt-1.5">
        {(["summary", "quotes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`text-[9px] font-black uppercase tracking-widest pb-1.5 mr-4 border-b-2 transition-colors ${
              activeTab === tab
                ? "border-purple-500 text-purple-300"
                : "border-transparent text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {tab === "summary" ? "Key Points" : "Quotes"}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 text-xs">
        {activeTab === "summary" && (
          <>
            <Section label="Theme">
              <p className="text-zinc-300 leading-5">{summary.mainTheme}</p>
            </Section>

            <Section label="Key Points">
              <ol className="space-y-1.5 list-none">
                {summary.keyPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-purple-900/60 border border-purple-700/50 flex items-center justify-center text-[8px] font-black text-purple-300">
                      {i + 1}
                    </span>
                    <span className="text-zinc-300 leading-5">{point}</span>
                  </li>
                ))}
              </ol>
            </Section>

            {summary.scripturesReferenced.length > 0 && (
              <Section label="Scriptures Referenced">
                <div className="flex flex-wrap gap-1.5">
                  {summary.scripturesReferenced.map((ref) => (
                    <span
                      key={ref}
                      className="px-2 py-0.5 rounded-full bg-blue-950/60 border border-blue-800/50 text-[10px] font-bold text-blue-300"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            <Section label="Call to Action">
              <p className="text-zinc-300 leading-5 italic">{summary.callToAction}</p>
            </Section>
          </>
        )}

        {activeTab === "quotes" && (
          <>
            {summary.quotableLines.length === 0 ? (
              <p className="text-zinc-600 text-center mt-6 text-[11px]">No quotable lines extracted.</p>
            ) : (
              <div className="space-y-2.5">
                {summary.quotableLines.map((quote, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2.5 relative"
                  >
                    <div className="text-purple-500/40 text-3xl font-serif leading-none absolute top-1 left-2">"</div>
                    <p className="text-zinc-200 leading-5 pl-4 text-[11px]">{quote}</p>
                    <CopyButton text={quote} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="border-t border-zinc-800 px-3 py-2 space-y-1.5">
        <div className="flex gap-2">
          <button
            onClick={async () => { await navigator.clipboard.writeText(fullText); }}
            className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition-colors"
          >
            Copy All
          </button>
          {onArchive && (
            <button
              onClick={onArchive}
              className={`flex-1 py-1.5 rounded-lg border text-[10px] font-bold transition-colors ${
                archived
                  ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-300'
              }`}
            >
              {archived ? 'Saved ✓' : 'Save to Archive'}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {onProjectRecap && (
            <button
              onClick={onProjectRecap}
              className="flex-1 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-700/60 border border-red-700/50 text-red-200 text-[10px] font-bold transition-colors"
            >
              Project Recap to Screen
            </button>
          )}
          {onAddToSchedule && (
            <button
              onClick={() => onAddToSchedule(fullText)}
              className="flex-1 py-1.5 rounded-lg bg-purple-900/50 hover:bg-purple-900/80 border border-purple-700/50 text-purple-200 text-[10px] font-bold transition-colors"
            >
              Add to Schedule
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
