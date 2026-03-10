import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Cloud, Download, HardDrive, Laptop, Layout, Menu, Monitor, Play, Presentation, Shield, Sparkles, X } from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  onLogout?: () => void;
  isAuthenticated: boolean;
  hasSavedSession?: boolean;
}

const RELEASES_API_URL = 'https://api.github.com/repos/Coolzymccooy/lumina-presenter/releases/latest';
const RELEASES_URL = 'https://github.com/Coolzymccooy/lumina-presenter/releases';

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, onLogout, isAuthenticated, hasSavedSession = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [latestTag, setLatestTag] = useState('v2.2.20');
  const [downloadUrls, setDownloadUrls] = useState({ installer: RELEASES_URL, msi: RELEASES_URL, portable: RELEASES_URL, macDmg: RELEASES_URL });

  const isMacClient = typeof window !== 'undefined' && /mac/i.test(`${window.navigator.platform || ''} ${window.navigator.userAgent || ''}`);
  const primaryDesktopUrl = isMacClient ? downloadUrls.macDmg : downloadUrls.installer;
  const primaryDesktopLabel = isMacClient ? 'Download for macOS' : 'Download for Windows';

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

  const featureCards = [
    ['Hymn Library', 'Generate structured hymn slides from bundled public-domain hymns with section-aware verse and refrain handling.', Sparkles],
    ['Audience Studio', 'Collect, moderate, and project testimonies, prayer requests, polls, and Q&A in real time.', Presentation],
    ['Pastor Alerts', 'Send admin-only messages to the stage display for time cues and critical service communication.', Shield],
    ['Smart Ticker', 'Run approved audience messages as a clean right-to-left ticker across your live output.', Layout],
    ['Multi-Screen Output', 'Drive projector, launch, and stage display together with synchronized content states.', Monitor],
    ['Bible + AI Workflow', 'Combine scripture slides, Visionary search, local-first Bible intent groundwork, and cloud sync for faster preparation.', Cloud],
  ] as const;

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-black text-white font-sans selection:bg-purple-500/30">
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg flex items-center justify-center"><Sparkles size={18} className="text-white fill-white" /></div>
            <span className="text-xl font-bold tracking-tight">LUMINA</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#download" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Desktop App</a>
            <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</a>
            <button onClick={onEnter} className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2">
              {isAuthenticated && hasSavedSession ? 'Resume Session' : isAuthenticated ? 'Enter Workspace' : 'Sign In'} <Play size={14} fill="currentColor" />
            </button>
            {isAuthenticated && onLogout && <button onClick={onLogout} className="px-4 py-2.5 border border-white/20 text-sm font-bold rounded-lg hover:bg-white/10 transition-all">Logout</button>}
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen((open) => !open)}>{mobileMenuOpen ? <X /> : <Menu />}</button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black pt-24 px-6 flex flex-col gap-6 md:hidden">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">Features</a>
          <a href="#download" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">Desktop App</a>
          <a href={primaryDesktopUrl} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold mt-2 text-center flex items-center justify-center gap-2"><Download size={18} /> {primaryDesktopLabel}</a>
          <button onClick={onEnter} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold">{isAuthenticated && hasSavedSession ? 'Resume Session' : isAuthenticated ? 'Enter Workspace' : 'Sign In'}</button>
        </div>
      )}

      <section className="relative pt-32 pb-20 md:pt-44 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300 tracking-wide uppercase">Version {latestTag} - Windows, macOS, Hymns, Motion, Audience</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">Church Presentation,<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">Rebuilt for Live Services.</span></h1>
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-3xl mx-auto leading-relaxed">Build the run sheet, generate polished hymn slides, search scripture with AI assist, route motion backgrounds, and go live from one premium control surface. Lumina runs in the browser and as a native desktop app on Windows and macOS.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={primaryDesktopUrl} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-purple-900/30 flex items-center gap-3"><Download size={20} /> {primaryDesktopLabel}</a>
            <button onClick={onEnter} className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10 flex items-center gap-2">{isAuthenticated && hasSavedSession ? 'Resume Session' : 'Use in Browser'} <ArrowRight size={18} /></button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 max-w-4xl mx-auto text-left">
            {[
              ['Desktop', 'Windows + macOS', 'Native presenter builds with direct downloads and offline-ready service playback.', 'border-blue-500/20 bg-blue-500/5 text-blue-300'],
              ['Hymn Engine', 'Structured hymn generation', 'Built-in public-domain hymn library with smart section handling and presets.', 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'],
              ['Live Stack', 'Bible, motion, audience', 'Visionary search, motion routing, audience tools, and stage-ready control flow.', 'border-purple-500/20 bg-purple-500/5 text-purple-300'],
            ].map(([eyebrow, title, copy, theme]) => (
              <div key={title} className={`rounded-2xl border p-4 ${theme}`}>
                <div className="text-[10px] uppercase tracking-[0.35em] mb-2">{eyebrow}</div>
                <div className="text-sm font-semibold text-white">{title}</div>
                <p className="text-xs text-gray-400 mt-1">{copy}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-5">Windows + macOS desktop builds - {latestTag} - free to start</p>
        </div>
      </section>

      <section id="download" className="py-24 px-6 bg-[#050505] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 mb-6"><Laptop size={14} className="text-blue-400" /><span className="text-xs font-medium text-blue-300 tracking-wide uppercase">Native Desktop Platform</span></div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Windows and macOS, side by side.</h2>
            <p className="text-gray-400 max-w-3xl mx-auto">Lumina now treats Windows and macOS as first-class desktop targets. Prep on the web, install on the booth machine, and present offline when the network is unreliable.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] max-w-6xl mx-auto mb-12">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6 md:p-8">
              <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300 mb-3">Desktop Coverage</div>
              <h3 className="text-2xl font-bold mb-3">One release surface for Windows and macOS</h3>
              <p className="text-sm md:text-base text-gray-400 leading-relaxed">Install Lumina on the booth machine, prep on the web, then present from a native desktop runtime with the same run sheet, library, stage flow, and launch controls.</p>
              <div className="grid gap-3 sm:grid-cols-2 mt-6">
                <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4"><div className="text-[10px] uppercase tracking-[0.35em] text-blue-300 mb-2">Windows</div><div className="text-sm font-semibold text-white">Installer + MSI + Portable</div></div>
                <div className="rounded-2xl border border-sky-500/25 bg-sky-500/10 p-4"><div className="text-[10px] uppercase tracking-[0.35em] text-sky-300 mb-2">macOS</div><div className="text-sm font-semibold text-white">Native DMG release</div></div>
              </div>
            </div>
            <div className="rounded-3xl border border-purple-500/20 bg-purple-500/5 p-6 md:p-8">
              <div className="text-[10px] uppercase tracking-[0.4em] text-purple-300 mb-3">Fresh In Lumina</div>
              <div className="space-y-4">
                {['Public-domain hymn library with structured sections and premium slide generation', 'Motion search routed through a secure server path instead of exposing media keys in the browser', 'Visionary Bible workflow prepared for local-first scripture matching and faster live response'].map((entry) => (
                  <div key={entry} className="flex items-start gap-3"><CheckCircle2 size={16} className="text-purple-300 mt-0.5 shrink-0" /><p className="text-sm text-gray-300 leading-relaxed">{entry}</p></div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5 max-w-7xl mx-auto">
            <a href={downloadUrls.installer} className="group p-6 rounded-2xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400 transition-all flex flex-col items-center text-center gap-4"><Download size={28} className="text-blue-400" /><div><div className="font-bold text-lg mb-1">Windows Installer</div><div className="text-xs text-gray-400">Recommended Windows setup - NSIS - x64</div></div></a>
            <a href={downloadUrls.macDmg} className="group p-6 rounded-2xl border border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-400 transition-all flex flex-col items-center text-center gap-4"><Laptop size={28} className="text-sky-400" /><div><div className="font-bold text-lg mb-1">macOS DMG</div><div className="text-xs text-gray-400">Native Mac desktop build - direct install package</div></div></a>
            <a href={downloadUrls.msi} className="group p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400 transition-all flex flex-col items-center text-center gap-4"><Shield size={28} className="text-emerald-400" /><div><div className="font-bold text-lg mb-1">Windows MSI</div><div className="text-xs text-gray-400">Alternative Windows installer - managed deployment friendly</div></div></a>
            <a href={downloadUrls.portable} className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-center text-center gap-4"><HardDrive size={28} className="text-gray-400" /><div><div className="font-bold text-lg mb-1">Portable Windows</div><div className="text-xs text-gray-400">No install needed - quick booth or backup option</div></div></a>
            <button onClick={onEnter} className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-purple-500/40 transition-all flex flex-col items-center text-center gap-4"><Cloud size={28} className="text-purple-400" /><div><div className="font-bold text-lg mb-1">Use in Browser</div><div className="text-xs text-gray-400">No install - go straight to Studio</div></div></button>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need. Nothing you do not.</h2>
            <p className="text-gray-400 max-w-3xl mx-auto">Built for real services: hymn generation, scripture response, audience interaction, motion routing, stage confidence, and reliable live output.</p>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] mb-10">
            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 md:p-8">
              <div className="text-[10px] uppercase tracking-[0.4em] text-emerald-300 mb-3">Hymn Engine</div>
              <h3 className="text-2xl font-bold mb-3">A premium hymn workflow now lives inside the studio</h3>
              <p className="text-sm md:text-base text-gray-300 leading-relaxed">Search the bundled hymn library, preview structured verses and refrains, generate readable worship slides, and insert them straight into the run sheet with preserved styling snapshots for live services.</p>
            </div>
            <div className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 to-transparent p-6 md:p-8">
              <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300 mb-3">Live Service Stack</div>
              <div className="space-y-4">
                {['Run Sheet + Launch', 'Motion + Library', 'Bible + Visionary'].map((entry) => (
                  <div key={entry} className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="font-semibold text-white">{entry}</div></div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {featureCards.map(([title, desc, Icon]) => (
              <div key={title} className="p-8 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.06] transition-all group">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform"><Icon size={24} /></div>
                <h3 className="text-xl font-bold mb-3">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-24 px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple Pricing</h2>
            <p className="text-gray-400">Start free, then scale into full production workflows.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col">
              <h3 className="text-lg font-medium text-gray-400 mb-2">Starter</h3>
              <div className="text-4xl font-bold text-white mb-6">Free</div>
              <ul className="space-y-4 mb-8 flex-1">{['Unlimited Services', 'Windows + macOS + Web Access', 'Audience Studio Intake', 'Bible Engine', 'Hymn Library', 'Cloud Sync (1 User)'].map((entry) => (<li key={entry} className="flex items-center gap-3 text-sm text-gray-300"><CheckCircle2 size={16} className="text-green-500" /> {entry}</li>))}</ul>
              <button onClick={onEnter} className="w-full py-3 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all font-bold text-sm">Get Started</button>
            </div>
            <div className="p-8 rounded-3xl border border-purple-500 bg-purple-500/5 flex flex-col relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg uppercase tracking-wider">Most Popular</div>
              <h3 className="text-lg font-medium text-purple-400 mb-2">Pro</h3>
              <div className="text-4xl font-bold text-white mb-6">$19<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">{['Everything in Starter', 'Cloud Sync (5 Users)', 'AI Assist + Motion Tools', 'Audience Moderation + Ticker Controls', 'Advanced live-service workflow', 'Priority Support'].map((entry) => (<li key={entry} className="flex items-center gap-3 text-sm text-white"><CheckCircle2 size={16} className="text-purple-400" /> {entry}</li>))}</ul>
              <button className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all font-bold text-sm shadow-lg shadow-purple-900/50">Start Free Trial</button>
            </div>
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col">
              <h3 className="text-lg font-medium text-gray-400 mb-2">Enterprise</h3>
              <div className="text-4xl font-bold text-white mb-6">Custom</div>
              <ul className="space-y-4 mb-8 flex-1">{['Unlimited Operators', 'Multi-Campus Environments', 'Admin Roles + Access Policies', 'SLA + 24/7 Priority Support', 'Dedicated Success Manager'].map((entry) => (<li key={entry} className="flex items-center gap-3 text-sm text-gray-300"><CheckCircle2 size={16} className="text-green-500" /> {entry}</li>))}</ul>
              <button className="w-full py-3 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all font-bold text-sm">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-6 bg-gradient-to-b from-[#050505] to-black border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to go live?</h2>
          <p className="text-gray-400 mb-10">Download Lumina for Windows or macOS for offline presenting, or sign in to the web version right now.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={primaryDesktopUrl} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all flex items-center gap-3 shadow-xl shadow-purple-900/30"><Download size={20} /> {primaryDesktopLabel}</a>
            <button onClick={onEnter} className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all flex items-center gap-2">Latest Version {latestTag}<ArrowRight size={18} /></button>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-white/10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4"><div className="w-6 h-6 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-md flex items-center justify-center"><Sparkles size={12} className="text-white fill-white" /></div><span className="font-bold text-sm">LUMINA PRESENTER</span></div>
        <p className="text-gray-600 text-sm">Copyright 2026 Lumina Presenter. All rights reserved. <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Releases on GitHub</a></p>
      </footer>
    </div>
  );
};
