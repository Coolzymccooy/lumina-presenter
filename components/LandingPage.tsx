import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Cloud,
  Download,
  HardDrive,
  Laptop,
  Menu,
  MessagesSquare,
  Mic2,
  Monitor,
  PanelLeft,
  Play,
  Projector,
  RadioTower,
  ScanSearch,
  Shield,
  Smartphone,
  Sparkles,
  TimerReset,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  onLogout?: () => void;
  isAuthenticated: boolean;
  hasSavedSession?: boolean;
}

type DownloadUrls = {
  installer: string;
  msi: string;
  portable: string;
  macDmg: string;
};

type FeatureCard = {
  title: string;
  copy: string;
  Icon: LucideIcon;
  tone: string;
};

const RELEASES_API_URL = 'https://api.github.com/repos/Coolzymccooy/lumina-presenter/releases/latest';
const RELEASES_URL = 'https://github.com/Coolzymccooy/lumina-presenter/releases';

const COMMAND_RAIL_LEFT: FeatureCard[] = [
  { title: 'Run Sheet Control', copy: 'Queue, pin, launch, and keep the service order visible inside Lumina.', Icon: PanelLeft, tone: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100' },
  { title: 'Bible + Hymns', copy: 'Scripture lookup and structured hymn slides stay inside the same workflow.', Icon: BookOpenText, tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' },
  { title: 'Slides + Motion', copy: 'Use image, video, and motion surfaces that fit the real Lumina output path.', Icon: Projector, tone: 'border-violet-400/20 bg-violet-500/10 text-violet-100' },
  { title: 'Projector Output', copy: 'Projector, stream, and lobby views stay synchronized from the same live state.', Icon: Waypoints, tone: 'border-amber-400/20 bg-amber-500/10 text-amber-100' },
];

const COMMAND_RAIL_RIGHT: FeatureCard[] = [
  { title: 'Stage Timer Studio', copy: 'Presets, flash, runway timing, and confidence cues are built in.', Icon: TimerReset, tone: 'border-sky-400/20 bg-sky-500/10 text-sky-100' },
  { title: 'Audience Studio', copy: 'Moderate testimonies, pinned cards, ticker, and QR intake in one room.', Icon: MessagesSquare, tone: 'border-rose-400/20 bg-rose-500/10 text-rose-100' },
  { title: 'Remote Control', copy: 'Trusted operators get a clean mobile handoff surface for next/prev/go.', Icon: Smartphone, tone: 'border-blue-400/20 bg-blue-500/10 text-blue-100' },
  { title: 'AI Verse Assist', copy: 'Visionary search and sermon-aware scripture response stay close to the service.', Icon: ScanSearch, tone: 'border-fuchsia-400/20 bg-fuchsia-500/10 text-fuchsia-100' },
];

const SURFACE_DETAILS = [
  {
    title: 'Presenter + Run Sheets',
    copy: 'Lumina keeps builder, rundown, and launch flow in one operational surface.',
    bullets: ['Queue and launch cues', 'Keep slides and notes attached', 'Present mode follows the run sheet'],
    Icon: PanelLeft,
    tone: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100',
  },
  {
    title: 'Projector + Output',
    copy: 'Program output, lower thirds, motion, and QR projection stay connected.',
    bullets: ['Projector, stream, and lobby routes', 'Motion-aware output composition', 'Audience QR only when needed'],
    Icon: Monitor,
    tone: 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100',
  },
  {
    title: 'Stage Timer + Alerts',
    copy: 'Speaker timer presets, flash, and stage-safe messaging are native Lumina surfaces.',
    bullets: ['Runway / amber / red thresholds', 'Session flash for live timing', 'Audience-aware confidence prompts'],
    Icon: TimerReset,
    tone: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  },
  {
    title: 'Audience Studio',
    copy: 'Collect, approve, pin, and ticker audience messages without leaving the app.',
    bullets: ['Prayer, testimony, poll, and Q&A intake', 'Pinned cards and ticker mode', 'Moderation and broadcast history'],
    Icon: MessagesSquare,
    tone: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
  },
  {
    title: 'Remote + Links',
    copy: 'Remote, output, and stage links share the same Lumina system language.',
    bullets: ['Mobile transport controls', 'Dedicated stage and output routes', 'Shared route model across web and desktop'],
    Icon: RadioTower,
    tone: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
  },
  {
    title: 'Bible, Hymns, Motion, AI',
    copy: 'Prep and live response stay in one stack: scripture, hymn generation, media, and assist.',
    bullets: ['Bundled hymn workflow', 'Visionary scripture assist', 'Motion-aware slide composition'],
    Icon: Sparkles,
    tone: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  },
] as const;

const SurfaceCard: React.FC<{ eyebrow: string; title: string; tone: string; children: React.ReactNode }> = ({ eyebrow, title, tone, children }) => (
  <div className={`rounded-[28px] border p-4 shadow-[0_24px_80px_rgba(0,0,0,0.28)] ${tone}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/55">{eyebrow}</div>
        <div className="mt-1 text-sm font-semibold text-white">{title}</div>
      </div>
      <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">Live</div>
    </div>
    <div className="mt-4">{children}</div>
  </div>
);

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, onLogout, isAuthenticated, hasSavedSession = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [latestTag, setLatestTag] = useState('v2.2.20');
  const [downloadUrls, setDownloadUrls] = useState<DownloadUrls>({
    installer: RELEASES_URL,
    msi: RELEASES_URL,
    portable: RELEASES_URL,
    macDmg: RELEASES_URL,
  });

  const isMacClient = typeof window !== 'undefined' && /mac/i.test(`${window.navigator.platform || ''} ${window.navigator.userAgent || ''}`);
  const primaryDesktopUrl = isMacClient ? downloadUrls.macDmg : downloadUrls.installer;
  const primaryDesktopLabel = isMacClient ? 'Download for macOS' : 'Download for Windows';
  const enterLabel = isAuthenticated && hasSavedSession ? 'Resume Session' : isAuthenticated ? 'Enter Workspace' : 'Use in Browser';

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const resolveLatestAssetUrls = async () => {
      try {
        const response = await fetch(RELEASES_API_URL, { headers: { Accept: 'application/vnd.github+json' } });
        if (!response.ok) return;
        const payload = await response.json();
        const assets = Array.isArray(payload?.assets) ? payload.assets : [];
        const tagName = String(payload?.tag_name || '').trim();
        const findAssetUrl = (patterns: RegExp[]) => {
          const match = assets.find((asset: any) => patterns.some((rx) => rx.test(String(asset?.name || ''))));
          return String(match?.browser_download_url || '').trim() || RELEASES_URL;
        };
        if (!cancelled) {
          if (tagName) setLatestTag(tagName);
          setDownloadUrls({
            installer: findAssetUrl([/lumina[-\s]?presenter[-\s]?setup.*\.exe$/i, /setup.*lumina.*\.exe$/i]),
            msi: findAssetUrl([/lumina[-\s]?presenter.*\.msi$/i]),
            portable: findAssetUrl([/lumina[-\s]?presenter(?!.*setup).*\.exe$/i]),
            macDmg: findAssetUrl([/lumina[-\s]?presenter.*\.dmg$/i]),
          });
        }
      } catch {
        // Keep GitHub fallback links.
      }
    };
    void resolveLatestAssetUrls();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#04070d] text-white selection:bg-cyan-400/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.2),transparent_30%),radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(244,114,182,0.12),transparent_22%),linear-gradient(180deg,#050811,#05070b_45%,#020407)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:72px_72px]" />
        <div className="absolute left-1/2 top-[-10rem] h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-400/15 blur-[140px]" />
        <div className="absolute bottom-[-12rem] right-[-8rem] h-[24rem] w-[24rem] rounded-full bg-violet-500/12 blur-[130px]" />
      </div>

      <nav className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-white/10 bg-[#050811]/78 backdrop-blur-xl' : 'bg-transparent'}`}>
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <a href="#/landing" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-400/25 bg-[linear-gradient(160deg,rgba(6,182,212,0.26),rgba(59,130,246,0.16))] shadow-[0_16px_32px_rgba(34,211,238,0.16)]"><Sparkles size={18} className="text-cyan-100" /></div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/70">Lumina</div>
              <div className="text-sm font-semibold text-white">Live Worship Control</div>
            </div>
          </a>
          <div className="hidden items-center gap-7 lg:flex">
            <a href="#command-deck" className="text-sm font-medium text-zinc-400 transition hover:text-white">Command Deck</a>
            <a href="#surfaces" className="text-sm font-medium text-zinc-400 transition hover:text-white">Surfaces</a>
            <a href="#download" className="text-sm font-medium text-zinc-400 transition hover:text-white">Desktop</a>
            <button onClick={onEnter} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-50 transition hover:border-cyan-200/55 hover:bg-cyan-500/15">{enterLabel}<Play size={14} className="fill-current" /></button>
            {isAuthenticated && onLogout && <button onClick={onLogout} className="rounded-full border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10">Logout</button>}
          </div>
          <button type="button" aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} className="rounded-full border border-white/10 bg-white/5 p-2.5 text-zinc-200 transition hover:bg-white/10 lg:hidden" onClick={() => setMobileMenuOpen((open) => !open)}>
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-[#050811]/96 px-6 pt-24 backdrop-blur-xl lg:hidden">
          <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-5">
            <a href="#command-deck" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base font-semibold text-white">Command Deck</a>
            <a href="#surfaces" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base font-semibold text-white">Surfaces</a>
            <a href="#download" onClick={() => setMobileMenuOpen(false)} className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-base font-semibold text-white">Desktop</a>
            <a href={primaryDesktopUrl} className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/35 bg-cyan-500/12 px-4 py-3 text-base font-semibold text-cyan-50"><Download size={16} />{primaryDesktopLabel}</a>
            <button onClick={onEnter} className="w-full rounded-2xl bg-white px-4 py-3 text-base font-semibold text-black">{enterLabel}</button>
          </div>
        </div>
      )}

      <main className="relative z-10">
        <section className="px-6 pb-10 pt-32 md:pb-12 md:pt-40">
          <div className="mx-auto max-w-6xl text-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-cyan-300/18 bg-white/5 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-cyan-100/85 shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.85)]" />
              Lumina {latestTag}
              <span className="text-zinc-500">Projector / Stage / Audience / Remote</span>
            </div>
            <h1 className="mx-auto mt-8 max-w-5xl text-5xl font-semibold leading-[0.96] tracking-tight text-white md:text-7xl">Lumina now shows the same projector, stage, audience, and remote system language on the public design that your team already uses in the app.</h1>
            <p className="mx-auto mt-6 max-w-4xl text-lg leading-8 text-zinc-300 md:text-xl">This redesign is built around real Lumina features: the presenter rundown, projector output, speaker timer studio, audience moderation, and remote handoff. It looks and feels like your product instead of a generic promo page.</p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a href={primaryDesktopUrl} className="inline-flex items-center gap-3 rounded-full border border-cyan-200/35 bg-[linear-gradient(135deg,rgba(14,165,233,0.42),rgba(59,130,246,0.3))] px-7 py-4 text-base font-semibold text-white shadow-[0_24px_60px_rgba(14,165,233,0.22)] transition hover:border-cyan-100/60 hover:brightness-110"><Download size={18} />{primaryDesktopLabel}</a>
              <button onClick={onEnter} className="inline-flex items-center gap-3 rounded-full border border-white/14 bg-white px-7 py-4 text-base font-semibold text-black transition hover:bg-zinc-100">{enterLabel}<ArrowRight size={18} /></button>
            </div>
          </div>
        </section>

        <section id="command-deck" className="px-6 py-12">
          <div className="mx-auto max-w-7xl rounded-[40px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,23,0.96),rgba(4,6,12,0.98))] p-4 shadow-[0_40px_120px_rgba(0,0,0,0.42)] md:p-6 xl:p-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-200/70">Lumina Command Deck</div>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-4xl">A public-facing Lumina wall built from your actual surfaces.</h2>
              </div>
              <div className="grid gap-2 text-sm text-zinc-300 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Presenter cues and run sheets</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Projector and audience-safe output</div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Stage timing, audience, and remote handoff</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_220px]">
              <div className="space-y-3">
                {COMMAND_RAIL_LEFT.map(({ title, copy, Icon, tone }) => (
                  <div key={title} className={`rounded-[24px] border p-4 shadow-[0_18px_42px_rgba(0,0,0,0.22)] ${tone}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20"><Icon size={18} /></div>
                      <div><div className="text-sm font-semibold text-white">{title}</div><p className="mt-1 text-xs leading-5 text-white/75">{copy}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <SurfaceCard eyebrow="Lumina Projector" title="Program Output" tone="border-cyan-400/20 bg-[linear-gradient(180deg,rgba(3,10,18,0.96),rgba(4,8,16,0.92))] lg:col-span-2">
                  <div className="overflow-hidden rounded-[28px] border border-cyan-300/15 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.25),transparent_32%),radial-gradient(circle_at_bottom,rgba(192,132,252,0.18),transparent_28%),linear-gradient(180deg,#0b1323,#0a0f1b_48%,#060911)] p-5 md:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="rounded-full border border-emerald-300/30 bg-emerald-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-100">Live to projector</div>
                      <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-200">Lumina / projector / stream</div>
                    </div>
                    <div className="mt-12 text-center md:mt-16">
                      <div className="text-[11px] font-bold uppercase tracking-[0.38em] text-cyan-100/65">Sermon Visual</div>
                      <div className="mt-4 text-3xl font-semibold leading-tight text-white md:text-5xl">For God so loved the world...</div>
                      <div className="mt-3 text-base text-zinc-200 md:text-lg">John 3:16</div>
                    </div>
                    <div className="mt-14 grid gap-3 md:mt-16 md:grid-cols-[minmax(0,1fr)_240px]">
                      <div className="rounded-[22px] border border-white/10 bg-black/22 px-4 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">Next cue</div><div className="mt-2 text-lg font-semibold text-white">Sermon Points</div><div className="mt-1 text-sm text-zinc-400">Projector and stage stay aligned when Lumina advances.</div></div>
                      <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-500/10 px-4 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/75">Audience QR</div><div className="mt-2 text-lg font-semibold text-white">Ready to project</div><div className="mt-1 text-sm text-cyan-50/75">Turn on intake only when the room needs it.</div></div>
                    </div>
                  </div>
                </SurfaceCard>

                <SurfaceCard eyebrow="Lumina Presenter" title="Run Sheet + Launch" tone="border-white/10 bg-[linear-gradient(180deg,rgba(16,18,28,0.96),rgba(8,10,16,0.94))]">
                  <div className="space-y-3">
                    {[
                      ['Prelude Motion', 'Queued', '00:45'],
                      ['Welcome + Announcements', 'Live', '04:00'],
                      ['Hymn: Great Is Thy Faithfulness', 'Ready', '05:30'],
                      ['Message', 'Pinned', '35:00'],
                    ].map(([item, state, duration]) => (
                      <div key={item} className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/20 px-3.5 py-3">
                        <div className={`h-2.5 w-2.5 rounded-full ${state === 'Live' ? 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]' : state === 'Pinned' ? 'bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.85)]' : 'bg-amber-300'}`} />
                        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{item}</div><div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{state}</div></div>
                        <div className="text-sm font-semibold text-zinc-200">{duration}</div>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard eyebrow="Lumina Stage" title="Speaker Timer + Confidence" tone="border-amber-400/20 bg-[linear-gradient(180deg,rgba(25,16,6,0.95),rgba(10,9,7,0.94))]">
                  <div className="rounded-[24px] border border-white/10 bg-black/25 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-100/70">Pastor main</div><div className="mt-1 text-sm font-semibold text-white">Preset: Main Message</div></div>
                      <div className="rounded-full border border-rose-300/28 bg-rose-500/12 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-rose-100">Flash ready</div>
                    </div>
                    <div className="mt-5 text-5xl font-semibold tracking-tight text-white md:text-6xl">35:00</div>
                    <div className="mt-3 h-4 overflow-hidden rounded-full bg-white/10"><div className="flex h-full"><div className="w-[72%] bg-emerald-400" /><div className="w-[18%] bg-amber-400" /><div className="w-[10%] bg-rose-500" /></div></div>
                    <div className="mt-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400"><span>Runway 72%</span><span>Amber 18%</span><span>Red 10%</span></div>
                  </div>
                </SurfaceCard>

                <SurfaceCard eyebrow="Lumina Audience" title="Moderation + Broadcast" tone="border-rose-400/20 bg-[linear-gradient(180deg,rgba(24,9,17,0.95),rgba(10,7,10,0.94))]">
                  <div className="space-y-3">
                    {[
                      ['Prayer', 'Please pray for my family this week.', 'Approved'],
                      ['Testimony', 'God provided work this month. Thank you church.', 'Pinned'],
                      ['Q&A', 'Can you share the scripture reference again?', 'Ticker'],
                    ].map(([label, message, status]) => (
                      <div key={message} className="rounded-[20px] border border-white/10 bg-black/22 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</div>
                          <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${status === 'Pinned' ? 'border border-cyan-300/20 bg-cyan-500/12 text-cyan-100' : status === 'Ticker' ? 'border border-amber-300/20 bg-amber-500/12 text-amber-100' : 'border border-emerald-300/20 bg-emerald-500/12 text-emerald-100'}`}>{status}</div>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-200">{message}</p>
                      </div>
                    ))}
                  </div>
                </SurfaceCard>

                <SurfaceCard eyebrow="Lumina Remote" title="Trusted Mobile Handoff" tone="border-blue-400/20 bg-[linear-gradient(180deg,rgba(6,15,28,0.95),rgba(7,8,14,0.94))]">
                  <div className="mx-auto max-w-[220px] rounded-[30px] border border-white/10 bg-[#080b13] p-3 shadow-[0_16px_38px_rgba(0,0,0,0.36)]">
                    <div className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,24,0.98),rgba(7,9,14,0.98))] p-4">
                      <div className="text-center text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-200/70">Lumina Remote</div>
                      <div className="mt-4 rounded-[20px] border border-cyan-400/18 bg-cyan-500/10 px-3 py-3 text-center"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-100/75">Current cue</div><div className="mt-1 text-sm font-semibold text-white">Welcome + Announcements</div></div>
                      <div className="mt-4 grid grid-cols-3 gap-2">{['Prev', 'Go', 'Next'].map((label) => <div key={label} className={`flex h-12 items-center justify-center rounded-2xl border text-sm font-semibold ${label === 'Go' ? 'border-emerald-300/20 bg-emerald-500/12 text-emerald-100' : 'border-white/10 bg-white/5 text-zinc-200'}`}>{label}</div>)}</div>
                    </div>
                  </div>
                </SurfaceCard>
              </div>

              <div className="space-y-3">
                {COMMAND_RAIL_RIGHT.map(({ title, copy, Icon, tone }) => (
                  <div key={title} className={`rounded-[24px] border p-4 shadow-[0_18px_42px_rgba(0,0,0,0.22)] ${tone}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20"><Icon size={18} /></div>
                      <div><div className="text-sm font-semibold text-white">{title}</div><p className="mt-1 text-xs leading-5 text-white/75">{copy}</p></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="surfaces" className="px-6 py-16">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/70">Operational Surfaces</div>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">The landing page is now aligned to Lumina features instead of generic presentation app language.</h2>
              <p className="mt-4 text-lg leading-8 text-zinc-300">Each block below maps to a real Lumina capability already present in the product: presenter flow, projector output, stage timing, audience moderation, remote links, and the prep stack behind them.</p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {SURFACE_DETAILS.map(({ title, copy, bullets, Icon, tone }) => (
                <div key={title} className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,24,0.92),rgba(7,9,14,0.94))] p-5 shadow-[0_22px_64px_rgba(0,0,0,0.28)]">
                  <div className="flex items-center gap-3"><div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${tone}`}><Icon size={20} /></div><div className="text-lg font-semibold text-white">{title}</div></div>
                  <p className="mt-4 text-sm leading-7 text-zinc-300">{copy}</p>
                  <div className="mt-5 space-y-3">{bullets.map((bullet) => <div key={bullet} className="flex items-start gap-3 rounded-[18px] border border-white/10 bg-white/5 px-3.5 py-3"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-cyan-300" /><div className="text-sm leading-6 text-zinc-200">{bullet}</div></div>)}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="download" className="px-6 py-16">
          <div className="mx-auto max-w-7xl rounded-[36px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,12,19,0.95),rgba(6,8,13,0.98))] p-6 shadow-[0_32px_96px_rgba(0,0,0,0.34)] md:p-8">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:items-center">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/70">Ship Lumina Everywhere</div>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white md:text-5xl">Desktop builds, browser access, and a shareable Lumina landing route.</h2>
                <p className="mt-4 max-w-2xl text-lg leading-8 text-zinc-300">Use the public landing route as the front door to Lumina on web deployments, then move straight into the live workspace, stage, output, and audience surfaces that already power the service.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-cyan-300/18 bg-cyan-500/10 px-4 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-100/75">Share route</div><div className="mt-2 font-mono text-sm text-white">/#/landing</div><div className="mt-1 text-sm text-cyan-50/80">Public marketing entry for Lumina on web deployments.</div></div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-4"><div className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Product message</div><div className="mt-2 text-sm font-semibold text-white">Projector, stage, audience, and remote now speak the same visual language.</div></div>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <a href={downloadUrls.installer} className="rounded-[24px] border border-cyan-300/25 bg-cyan-500/10 p-5 transition hover:border-cyan-200/45 hover:bg-cyan-500/15"><div className="flex items-center gap-3"><Download size={20} className="text-cyan-100" /><div className="text-lg font-semibold text-white">Windows Installer</div></div><p className="mt-3 text-sm leading-6 text-cyan-50/85">Recommended Windows setup for booth and production machines.</p></a>
                <a href={downloadUrls.macDmg} className="rounded-[24px] border border-sky-300/25 bg-sky-500/10 p-5 transition hover:border-sky-200/45 hover:bg-sky-500/15"><div className="flex items-center gap-3"><Laptop size={20} className="text-sky-100" /><div className="text-lg font-semibold text-white">macOS DMG</div></div><p className="mt-3 text-sm leading-6 text-sky-50/85">Native macOS package for teams standardizing on Mac booths.</p></a>
                <a href={downloadUrls.msi} className="rounded-[24px] border border-emerald-300/25 bg-emerald-500/10 p-5 transition hover:border-emerald-200/45 hover:bg-emerald-500/15"><div className="flex items-center gap-3"><Shield size={20} className="text-emerald-100" /><div className="text-lg font-semibold text-white">Windows MSI</div></div><p className="mt-3 text-sm leading-6 text-emerald-50/85">Managed deployment-friendly package for teams and campuses.</p></a>
                <a href={downloadUrls.portable} className="rounded-[24px] border border-white/10 bg-white/5 p-5 transition hover:border-white/20 hover:bg-white/10"><div className="flex items-center gap-3"><HardDrive size={20} className="text-zinc-100" /><div className="text-lg font-semibold text-white">Portable Booth Build</div></div><p className="mt-3 text-sm leading-6 text-zinc-300">Fast fallback option when you need Lumina on a machine without installation.</p></a>
              </div>
            </div>
            <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Cloud size={14} className="text-cyan-200" />Browser + desktop</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Mic2 size={14} className="text-amber-200" />Sermon-aware workflow</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Sparkles size={14} className="text-emerald-200" />Lumina {latestTag}</span>
              </div>
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <button onClick={onEnter} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100">Open Lumina<ArrowRight size={16} /></button>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-cyan-100 transition hover:text-white">View release history</a>
              </div>
            </div>
          </div>
        </section>

        <footer className="px-6 py-12">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10"><Sparkles size={18} className="text-cyan-100" /></div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-cyan-200/70">Lumina</div>
                  <div className="text-sm font-semibold text-white">Presenter, stage, audience, and output in one system.</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-500">Copyright 2026 Lumina Presenter. Public landing route: <span className="font-mono text-zinc-300">/#/landing</span></p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-zinc-400">
              <a href="#command-deck" className="transition hover:text-white">Command Deck</a>
              <a href="#surfaces" className="transition hover:text-white">Surfaces</a>
              <a href="#download" className="transition hover:text-white">Desktop</a>
              <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">GitHub Releases</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
