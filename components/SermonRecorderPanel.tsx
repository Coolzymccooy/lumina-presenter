/**
 * SermonRecorderPanel
 *
 * Full-featured sermon recording UI:
 * - Animated waveform bars driven by live mic level
 * - Phase-aware controls (Record → Pause/Resume/Stop → Transcribing → Done)
 * - Editable transcript with live (Web Speech) + cloud (Gemini) merge
 * - One-click Summarize via Gemini + inline summary display
 * - "Flash to Screen" to push transcript/summary to StageDisplay
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSermonRecorder,
  type SermonRecorderLocale,
  type SermonAccentHint,
} from '../hooks/useSermonRecorder';
import {
  summarizeSermon,
  canSummarize,
  type SermonSummary,
} from '../services/sermonSummaryService';

export interface SermonRecorderPanelProps {
  onClose: () => void;
  onFlashToScreen: (content: { transcript: string; summary?: SermonSummary }) => void;
  onAddToSchedule?: (text: string) => void;
  locale?: SermonRecorderLocale;
  compact?: boolean;
}

// ── Waveform bar visualizer ────────────────────────────────────────────────

const BAR_COUNT = 20;

const WaveformBars: React.FC<{ level: number; active: boolean }> = ({ level, active }) => {
  const barsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0.1));
  const frameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Shift bars left, push new value
      barsRef.current.shift();
      const noise = active ? (Math.random() - 0.5) * 0.12 : 0;
      barsRef.current.push(Math.max(0.04, Math.min(1, active ? level + noise : 0.04)));

      const barW = W / BAR_COUNT;
      const gap = 2;

      barsRef.current.forEach((val, i) => {
        const barH = Math.max(4, val * H * 0.9);
        const x = i * barW + gap / 2;
        const y = (H - barH) / 2;
        const alpha = active ? 0.5 + val * 0.5 : 0.2;
        ctx.fillStyle = active
          ? `rgba(239, 68, 68, ${alpha})`   // red when recording
          : `rgba(113, 113, 122, ${alpha})`; // zinc when idle
        const r = Math.min(3, (barW - gap) / 2);
        ctx.beginPath();
        ctx.roundRect(x, y, barW - gap, barH, r);
        ctx.fill();
      });

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [level, active]);

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={40}
      className="w-full h-10"
      style={{ imageRendering: 'pixelated' }}
    />
  );
};

// ── Elapsed time formatter ─────────────────────────────────────────────────

const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ── Summary display (inline) ───────────────────────────────────────────────

const InlineSummary: React.FC<{ summary: SermonSummary }> = ({ summary }) => (
  <div className="mt-3 rounded-xl bg-purple-950/30 border border-purple-800/40 px-3 py-3 space-y-2.5 text-xs">
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-1">Theme</div>
      <p className="text-zinc-300 leading-5">{summary.mainTheme}</p>
    </div>
    {summary.keyPoints.length > 0 && (
      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-1">Key Points</div>
        <ol className="space-y-1">
          {summary.keyPoints.map((p, i) => (
            <li key={i} className="flex gap-2 items-start">
              <span className="mt-0.5 flex-shrink-0 text-purple-400 font-bold">{i + 1}.</span>
              <span className="text-zinc-300 leading-5">{p}</span>
            </li>
          ))}
        </ol>
      </div>
    )}
    {summary.scripturesReferenced.length > 0 && (
      <div>
        <div className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-1">Scriptures</div>
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
      </div>
    )}
    <div>
      <div className="text-[9px] font-black uppercase tracking-widest text-purple-400/70 mb-1">Call to Action</div>
      <p className="text-zinc-300 leading-5 italic">{summary.callToAction}</p>
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────

export const SermonRecorderPanel: React.FC<SermonRecorderPanelProps> = ({
  onClose,
  onFlashToScreen,
  onAddToSchedule,
  locale = 'en-GB',
  compact = false,
}) => {
  const [accentHint, setAccentHint] = useState<SermonAccentHint>('standard');
  const [audioDeviceId, setAudioDeviceId] = useState<string | undefined>(undefined);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);

  // Enumerate audioinput devices; re-enumerate on plug/unplug
  useEffect(() => {
    let alive = true;
    const enumerate = async () => {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        if (alive) setAudioDevices(all.filter((d) => d.kind === 'audioinput'));
      } catch { /* unsupported context */ }
    };
    enumerate();
    navigator.mediaDevices.addEventListener?.('devicechange', enumerate);
    return () => {
      alive = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', enumerate);
    };
  }, []);

  const [recState, recActions] = useSermonRecorder({ locale, accentHint, audioDeviceId });
  const { phase, liveTranscript, interimText, transcript, elapsedSeconds, micLevel, error } = recState;

  const [editableTranscript, setEditableTranscript] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const [summary, setSummary] = useState<SermonSummary | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [flashDone, setFlashDone] = useState(false);

  const transcriptScrollRef = useRef<HTMLDivElement>(null);

  // When recording stops and transcript arrives, seed the editable field
  useEffect(() => {
    if (phase === 'done' && transcript) {
      setEditableTranscript(transcript);
      setSummary(null);
      setSummaryError(null);
    }
  }, [phase, transcript]);

  // Auto-scroll transcript while recording
  useEffect(() => {
    if (transcriptScrollRef.current) {
      transcriptScrollRef.current.scrollTop = transcriptScrollRef.current.scrollHeight;
    }
  }, [liveTranscript, interimText]);

  // Commit edits back to hook when user finishes editing
  const handleEditBlur = useCallback(() => {
    recActions.setTranscript(editableTranscript);
    setIsEditing(false);
  }, [editableTranscript, recActions]);

  const handleSummarize = useCallback(async () => {
    const text = isEditing ? editableTranscript : transcript;
    if (!canSummarize(text)) return;
    setSummarizing(true);
    setSummaryError(null);
    setSummary(null);
    const result = await summarizeSermon(text, locale === 'en-GB' ? 'uk' : 'standard');
    setSummarizing(false);
    if (result.ok && result.summary) {
      setSummary(result.summary);
    } else {
      setSummaryError(result.error || 'Summarization failed.');
    }
  }, [editableTranscript, isEditing, locale, transcript]);

  const handleFlash = useCallback(() => {
    const text = isEditing ? editableTranscript : transcript;
    onFlashToScreen({ transcript: text, summary: summary ?? undefined });
    setFlashDone(true);
    setTimeout(() => setFlashDone(false), 2500);
  }, [editableTranscript, isEditing, onFlashToScreen, summary, transcript]);

  const handleAddToSchedule = useCallback(() => {
    if (!onAddToSchedule) return;
    const lines: string[] = [];
    if (summary) {
      lines.push(`SERMON: ${summary.title}`, `THEME: ${summary.mainTheme}`, '');
      lines.push('KEY POINTS:');
      summary.keyPoints.forEach((p, i) => lines.push(`  ${i + 1}. ${p}`));
      lines.push('');
      lines.push(`SCRIPTURES: ${summary.scripturesReferenced.join(' · ') || 'None detected'}`);
      lines.push(`CALL TO ACTION: ${summary.callToAction}`);
    } else {
      lines.push(transcript);
    }
    onAddToSchedule(lines.join('\n'));
  }, [onAddToSchedule, summary, transcript]);

  const isActive = phase === 'recording' || phase === 'paused';
  const isDone = phase === 'done';
  const isLive = phase === 'recording';
  const activeTranscript = isDone && isEditing ? editableTranscript : (isDone ? editableTranscript : transcript);
  const wordCount = activeTranscript.trim().split(/\s+/).filter(Boolean).length;
  const canFlash = isDone && wordCount > 0;

  const panelPad = compact ? 'p-3' : 'p-4';

  return (
    <div className="flex flex-col bg-zinc-950 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full shrink-0 transition-colors ${
              isLive ? 'bg-red-500 animate-pulse' :
              phase === 'paused' ? 'bg-amber-400' :
              phase === 'transcribing' ? 'bg-blue-400 animate-pulse' :
              isDone ? 'bg-emerald-400' :
              'bg-zinc-600'
            }`}
          />
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
            {isLive ? 'Recording' :
             phase === 'paused' ? 'Paused' :
             phase === 'transcribing' ? 'Transcribing...' :
             isDone ? 'Ready' :
             phase === 'error' ? 'Error' :
             'Sermon Recorder'}
          </span>
          {isActive && (
            <span className="text-[10px] font-mono text-zinc-500 ml-1">
              {formatTime(elapsedSeconds)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 text-xl leading-none transition-colors px-1"
          title="Close sermon recorder"
          aria-label="Close sermon recorder"
        >
          ×
        </button>
      </div>

      {/* ── Body ── */}
      <div className={`flex flex-col gap-3 ${panelPad} flex-1 overflow-y-auto`}>

        {/* Waveform + controls */}
        {phase !== 'done' && phase !== 'error' && (
          <div className="space-y-2">
            <WaveformBars level={micLevel} active={isLive} />

            {/* Controls row */}
            <div className="flex items-center gap-2">
              {phase === 'idle' && (
                <div className="flex-1 space-y-2">
                  {/* Audio device picker */}
                  {audioDevices.length > 1 && (
                    <select
                      value={audioDeviceId ?? ''}
                      onChange={(e) => setAudioDeviceId(e.target.value || undefined)}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                    >
                      <option value="">Default microphone</option>
                      {audioDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Microphone ${d.deviceId.slice(0, 6)}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {/* Accent hint */}
                  <select
                    value={accentHint}
                    onChange={(e) => setAccentHint(e.target.value as SermonAccentHint)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 text-[10px] px-2 py-1.5 focus:outline-none focus:border-zinc-500"
                  >
                    <option value="standard">Standard English</option>
                    <option value="uk">British English</option>
                    <option value="nigerian">Nigerian English</option>
                    <option value="ghanaian">Ghanaian English</option>
                    <option value="southafrican">South African English</option>
                    <option value="kenyan">Kenyan English</option>
                  </select>
                  <button
                    onClick={recActions.start}
                    className="w-full py-2 rounded-lg bg-red-700/80 hover:bg-red-600 text-white text-[11px] font-bold tracking-wide transition-colors"
                  >
                    Start Recording
                  </button>
                </div>
              )}
              {phase === 'recording' && (
                <>
                  <button
                    onClick={recActions.pause}
                    className="flex-1 py-2 rounded-lg border border-amber-600/70 text-amber-300 bg-amber-950/30 hover:bg-amber-950/60 text-[11px] font-bold transition-colors"
                  >
                    Pause
                  </button>
                  <button
                    onClick={recActions.stop}
                    className="flex-1 py-2 rounded-lg border border-zinc-600 text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700 text-[11px] font-bold transition-colors"
                  >
                    Stop &amp; Transcribe
                  </button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <button
                    onClick={recActions.resume}
                    className="flex-1 py-2 rounded-lg bg-red-700/80 hover:bg-red-600 text-white text-[11px] font-bold transition-colors"
                  >
                    Resume
                  </button>
                  <button
                    onClick={recActions.stop}
                    className="flex-1 py-2 rounded-lg border border-zinc-600 text-zinc-300 bg-zinc-800/60 hover:bg-zinc-700 text-[11px] font-bold transition-colors"
                  >
                    Stop &amp; Transcribe
                  </button>
                </>
              )}
              {phase === 'transcribing' && (
                <div className="flex-1 flex items-center justify-center gap-2 py-2">
                  <div className="h-3 w-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="h-3 w-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '120ms' }} />
                  <div className="h-3 w-3 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '240ms' }} />
                  <span className="text-[11px] text-blue-300 font-bold ml-1">Processing audio...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error state */}
        {phase === 'error' && (
          <div className="rounded-xl bg-red-950/40 border border-red-800/50 px-3 py-3 space-y-2">
            <p className="text-red-300 text-[11px] font-semibold">{error || 'An error occurred.'}</p>
            <button
              onClick={recActions.start}
              className="text-[10px] font-bold text-red-200 border border-red-700/50 px-3 py-1.5 rounded-lg hover:bg-red-900/40 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Live transcript (during recording/paused) */}
        {(isActive || phase === 'transcribing') && (
          <div
            ref={transcriptScrollRef}
            className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2.5 max-h-32 overflow-y-auto text-sm leading-relaxed"
          >
            {!liveTranscript && !interimText ? (
              <span className="text-zinc-600 italic text-[11px]">
                {isLive ? 'Listening — transcript will appear here...' : 'Paused.'}
              </span>
            ) : (
              <>
                <span className="text-zinc-200">{liveTranscript}</span>
                {interimText && (
                  <span className="text-zinc-500 italic"> {interimText}</span>
                )}
              </>
            )}
          </div>
        )}

        {/* Done — editable transcript + summary */}
        {isDone && (
          <div className="space-y-2">
            {/* Transcript label + word count */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Transcript</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-zinc-600">{wordCount.toLocaleString()} words</span>
                <button
                  onClick={() => {
                    if (isEditing) {
                      handleEditBlur();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className="text-[9px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors border border-zinc-700 rounded px-1.5 py-0.5"
                >
                  {isEditing ? 'Done' : 'Edit'}
                </button>
                <button
                  onClick={recActions.clearTranscript}
                  className="text-[9px] font-bold text-zinc-600 hover:text-red-400 transition-colors"
                  title="Clear transcript"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Transcript area */}
            {isEditing ? (
              <textarea
                value={editableTranscript}
                onChange={(e) => setEditableTranscript(e.target.value)}
                onBlur={handleEditBlur}
                autoFocus
                className="w-full rounded-xl bg-zinc-900 border border-purple-700/50 focus:border-purple-500 outline-none px-3 py-2.5 text-[12px] text-zinc-200 leading-relaxed resize-none transition-colors"
                rows={6}
                placeholder="Transcript will appear here..."
              />
            ) : (
              <div
                className="rounded-xl bg-zinc-900/60 border border-zinc-800 px-3 py-2.5 max-h-40 overflow-y-auto text-[12px] text-zinc-200 leading-relaxed cursor-text"
                onClick={() => setIsEditing(true)}
                title="Click to edit"
              >
                {editableTranscript || <span className="text-zinc-600 italic">No transcript captured.</span>}
              </div>
            )}

            {/* Summarize controls */}
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <button
                  onClick={handleSummarize}
                  disabled={summarizing || !canSummarize(isEditing ? editableTranscript : transcript)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-purple-900/50 hover:bg-purple-800/70 border border-purple-700/50 text-purple-200"
                  title={canSummarize(isEditing ? editableTranscript : transcript) ? '' : 'Need at least 80 words to summarize'}
                >
                  {summarizing ? 'Summarizing...' : summary ? 'Re-summarize' : 'Summarize with AI'}
                </button>
                <button
                  onClick={recActions.start}
                  className="py-2 px-3 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 text-[11px] font-bold transition-colors"
                  title="Record again"
                >
                  New
                </button>
              </div>

              {summaryError && (
                <p className="text-red-400 text-[10px]">{summaryError}</p>
              )}
            </div>

            {/* Inline summary */}
            {summary && <InlineSummary summary={summary} />}
          </div>
        )}
      </div>

      {/* ── Footer actions (visible when done) ── */}
      {isDone && (
        <div className="border-t border-zinc-800 px-4 py-2.5 flex gap-2 flex-shrink-0">
          {onAddToSchedule && (
            <button
              onClick={handleAddToSchedule}
              className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold transition-colors"
            >
              Add to Schedule
            </button>
          )}
          <button
            onClick={handleFlash}
            disabled={!canFlash}
            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              flashDone
                ? 'bg-emerald-900/50 border border-emerald-700/50 text-emerald-300'
                : 'bg-red-900/50 hover:bg-red-800/70 border border-red-700/50 text-red-200'
            }`}
            title={canFlash ? 'Push transcript/summary to stage display' : 'No transcript to flash'}
          >
            {flashDone ? 'Flashed ✓' : 'Flash to Screen'}
          </button>
        </div>
      )}
    </div>
  );
};
