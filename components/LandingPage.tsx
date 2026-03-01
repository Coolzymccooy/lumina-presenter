
import React, { useState, useEffect } from 'react';
import {
  Sparkles, Monitor, Cloud, Smartphone, Zap,
  Presentation, CheckCircle2, Play, Layout, Menu, X,
  Download, Wifi, WifiOff, Laptop, ArrowRight, Shield, HardDrive
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  onLogout?: () => void;
  isAuthenticated: boolean;
  hasSavedSession?: boolean;
}

const RELEASES_API_URL = "https://api.github.com/repos/Coolzymccooy/lumina-presenter/releases/latest";
const RELEASES_URL = 'https://github.com/Coolzymccooy/lumina-presenter/releases';

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, onLogout, isAuthenticated, hasSavedSession = false }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [latestTag, setLatestTag] = useState('v2.2.9');
  const [downloadUrls, setDownloadUrls] = useState({
    installer: RELEASES_URL,
    msi: RELEASES_URL,
    portable: RELEASES_URL,
  });

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
        const tagName = String(payload?.tag_name || '').trim();
        const assets = Array.isArray(payload?.assets) ? payload.assets : [];
        const findAssetUrl = (patterns: RegExp[]) => {
          const match = assets.find((asset: any) => {
            const name = String(asset?.name || '');
            return patterns.some((rx) => rx.test(name));
          });
          return String(match?.browser_download_url || '').trim() || RELEASES_URL;
        };

        const installer = findAssetUrl([
          /lumina[-\s]?presenter[-\s]?setup.*\.exe$/i,
          /setup.*lumina.*\.exe$/i,
        ]);
        const msi = findAssetUrl([
          /lumina[-\s]?presenter.*\.msi$/i,
        ]);
        const portable = findAssetUrl([
          /lumina[-\s]?presenter(?!.*setup).*\.exe$/i,
        ]);

        if (!cancelled) {
          if (tagName) setLatestTag(tagName);
          setDownloadUrls({ installer, msi, portable });
        }
      } catch {
        // Keep release page fallback links.
      }
    };
    void resolveLatestAssetUrls();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-black text-white font-sans selection:bg-purple-500/30">

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-black/80 backdrop-blur-md border-b border-white/10' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-lg flex items-center justify-center">
              <Sparkles size={18} className="text-white fill-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">LUMINA</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Features</a>
            <a href="#download" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Desktop App</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</a>
            <button
              onClick={onEnter}
              className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              {isAuthenticated && hasSavedSession ? 'Resume Session' : isAuthenticated ? 'Enter Workspace' : 'Sign In'} <Play size={14} fill="currentColor" />
            </button>
            {isAuthenticated && onLogout && (
              <button onClick={onLogout} className="px-4 py-2.5 border border-white/20 text-sm font-bold rounded-lg hover:bg-white/10 transition-all">Logout</button>
            )}
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black pt-24 px-6 flex flex-col gap-6 md:hidden">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">Features</a>
          <a href="#download" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">Desktop App</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">How it works</a>
          <a href={downloadUrls.installer} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold mt-2 text-center flex items-center justify-center gap-2">
            <Download size={18} /> Download for Windows
          </a>
          <button onClick={onEnter} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold">
            {isAuthenticated && hasSavedSession ? 'Resume Session' : isAuthenticated ? 'Enter Workspace' : 'Sign In'}
          </button>
          {isAuthenticated && onLogout && (
            <button onClick={onLogout} className="w-full py-4 border border-white/20 text-white rounded-xl font-bold">Logout</button>
          )}
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300 tracking-wide uppercase">Version {latestTag} - Desktop + Audience Studio Updates</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            The Presentation Platform <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">Built for the Future.</span>
          </h1>

          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create stunning visuals, sync across devices, and engage your audience with AI-powered tools.
            Works online <em>and</em> offline — no expensive hardware required.
          </p>

          {isAuthenticated && hasSavedSession && (
            <p className="text-sm text-emerald-300 mb-6">Session detected. Click Resume Session to jump back into your workspace.</p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={downloadUrls.installer}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-xl shadow-purple-900/30 flex items-center gap-3"
            >
              <Download size={20} /> Download for Windows
            </a>
            <button
              onClick={onEnter}
              className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10 flex items-center gap-2"
            >
              {isAuthenticated && hasSavedSession ? 'Resume Session' : 'Use in Browser'} <ArrowRight size={18} />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-4">Windows 10/11 - x64 - {latestTag} - Free</p>
        </div>

        {/* Hero Image */}
        <div className="mt-20 max-w-6xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl aspect-[16/9]">
            <div className="absolute inset-0 flex flex-col">
              <div className="h-10 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/40" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                  <div className="w-3 h-3 rounded-full bg-green-500/40" />
                </div>
                <span className="text-[10px] text-white/30 ml-2 font-mono">Lumina Presenter {latestTag}</span>
              </div>
              <div className="flex-1 flex">
                <div className="w-64 border-r border-white/5 p-4 space-y-4">
                  <div className="h-8 w-3/4 bg-white/10 rounded animate-pulse" />
                  <div className="h-20 w-full bg-white/5 rounded animate-pulse" />
                  <div className="h-20 w-full bg-white/5 rounded animate-pulse" />
                </div>
                <div className="flex-1 p-8 flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
                  <h2 className="text-4xl font-bold text-white drop-shadow-lg text-center">Welcome to Lumina</h2>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── DOWNLOAD SECTION ── */}
      <section id="download" className="py-32 px-6 bg-[#050505] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 mb-6">
              <Laptop size={14} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-300 tracking-wide uppercase">Native Desktop App</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Present Without Internet.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Even in the Basement.</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto">The Lumina desktop app runs entirely on your Windows PC — no browser, no internet required during service. Everything is cached locally so your worship experience never drops.</p>
          </div>

          {/* Offline vs Online comparison */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <WifiOff size={20} className="text-green-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Desktop App</h3>
                  <p className="text-xs text-green-400">Works fully offline</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Runs directly on your PC — no browser needed',
                  'All slides, media and settings stored locally',
                  'No internet required during service',
                  'First login needs Wi-Fi to authenticate',
                  'Instant startup — no page load',
                  'Secure, no data leaves without login',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Wifi size={20} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Browser Version</h3>
                  <p className="text-xs text-purple-400">Online only</p>
                </div>
              </div>
              <ul className="space-y-3">
                {[
                  'Open in any modern browser instantly',
                  'No installation required',
                  'Cloud sync across all devices',
                  'Always up-to-date automatically',
                  'Requires stable internet connection',
                  'Best for remote preparation & editing',
                ].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                    <CheckCircle2 size={15} className="text-purple-400 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Download Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto mb-10">
            <a
              href={downloadUrls.installer}
              className="group p-6 rounded-2xl border border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400 transition-all flex flex-col items-center text-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Download size={28} className="text-blue-400" />
              </div>
              <div>
                <div className="font-bold text-lg mb-1">Windows Installer</div>
                <div className="text-xs text-gray-400">Recommended · NSIS Setup · x64</div>
              </div>
              <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                Download .exe <ArrowRight size={14} />
              </div>
            </a>

            <a
              href={downloadUrls.msi}
              className="group p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400 transition-all flex flex-col items-center text-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Shield size={28} className="text-emerald-400" />
              </div>
              <div>
                <div className="font-bold text-lg mb-1">Windows MSI</div>
                <div className="text-xs text-gray-400">Alternative installer · x64</div>
              </div>
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold">
                Download .msi <ArrowRight size={14} />
              </div>
            </a>

            <a
              href={downloadUrls.portable}
              className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20 transition-all flex flex-col items-center text-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <HardDrive size={28} className="text-gray-400" />
              </div>
              <div>
                <div className="font-bold text-lg mb-1">Portable Version</div>
                <div className="text-xs text-gray-400">No install needed · Run anywhere · x64</div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm font-semibold">
                Download portable <ArrowRight size={14} />
              </div>
            </a>

            <button
              onClick={onEnter}
              className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-purple-500/40 transition-all flex flex-col items-center text-center gap-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Cloud size={28} className="text-purple-400" />
              </div>
              <div>
                <div className="font-bold text-lg mb-1">Use in Browser</div>
                <div className="text-xs text-gray-400">No install · Go straight to Studio</div>
              </div>
              <div className="flex items-center gap-2 text-purple-400 text-sm font-semibold">
                Open Web App <ArrowRight size={14} />
              </div>
            </button>
          </div>

          {/* How to install */}
          <div className="max-w-2xl mx-auto p-6 rounded-2xl border border-white/10 bg-white/[0.02]">
            <h3 className="font-bold text-sm text-gray-300 mb-4 uppercase tracking-wider flex items-center gap-2"><Shield size={14} className="text-green-400" /> How to install in 3 steps</h3>
            <ol className="space-y-3">
              {[
                { n: '1', t: 'Download the installer', d: 'Click "Windows Installer" above and save the .exe file.' },
                { n: '2', t: 'Run it (ignore the warning)', d: 'Windows may show a "publisher unknown" warning — click "More info" then "Run anyway". We are not yet code-signed.' },
                { n: '3', t: 'Sign in once', d: 'The first launch requires internet to authenticate. After that the app works fully offline.' },
              ].map(s => (
                <li key={s.n} className="flex items-start gap-4">
                  <span className="w-7 h-7 rounded-full bg-white/10 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                  <div>
                    <span className="font-semibold text-sm text-white">{s.t} — </span>
                    <span className="text-sm text-gray-400">{s.d}</span>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-gray-600">All releases: <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">github.com/Coolzymccooy/lumina-presenter/releases</a></p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need. <br />Nothing you don't.</h2>
            <p className="text-gray-400">Built for real services: audience interaction, stage confidence, and reliable live output.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Presentation, title: 'Audience Studio', desc: 'Collect, moderate, and project testimonies, prayer requests, polls, and Q&A in real time.' },
              { icon: Shield, title: 'Pastor Alerts', desc: 'Send admin-only messages to the stage display for time cues and emergency communication.' },
              { icon: Layout, title: 'Smart Ticker', desc: 'Run approved audience messages as a clean right-to-left ticker across your live output.' },
              { icon: Monitor, title: 'Multi-Screen Output', desc: 'Drive Projector, Launch Live, and Stage Display together with synchronized content states.' },
              { icon: HardDrive, title: 'Desktop Offline Ready', desc: 'After first sign-in, run prebuilt services locally on Windows with no internet dependency.' },
              { icon: Cloud, title: 'Bible + AI Workflow', desc: 'Combine scripture slides, AI-assisted content creation, and cloud sync for faster preparation.' },
            ].map((feature, i) => (
              <div key={i} className="p-8 bg-white/[0.03] border border-white/5 rounded-2xl hover:bg-white/[0.06] transition-all group">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-32 px-6 bg-[#050505] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">How It Works</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">From preparation to presentation, Lumina streamlines your entire workflow.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            {[
              { step: '01', title: 'Create', desc: 'Build your service flow, add songs, and import media using our drag-and-drop builder.' },
              { step: '02', title: 'Sync', desc: 'Your changes are instantly saved to the cloud. Log in from the booth and everything is ready.' },
              { step: '03', title: 'Present', desc: 'Go live with confidence. Control slides, video, and audio from a single dashboard.' },
            ].map((item, i) => (
              <div key={i} className="relative bg-black border border-white/10 p-8 rounded-2xl text-center hover:border-purple-500/50 transition-colors z-10">
                <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold text-white border-4 border-black relative -mt-16 shadow-xl">
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-32 px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Simple Pricing</h2>
            <p className="text-gray-400">Start free, then scale into full production workflows.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col">
              <h3 className="text-lg font-medium text-gray-400 mb-2">Starter</h3>
              <div className="text-4xl font-bold text-white mb-6">Free</div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Unlimited Services', 'Desktop + Web Access', 'Audience Studio Intake', 'Bible Engine', 'Cloud Sync (1 User)'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300"><CheckCircle2 size={16} className="text-green-500" /> {f}</li>
                ))}
              </ul>
              <button onClick={onEnter} className="w-full py-3 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all font-bold text-sm">Get Started</button>
            </div>

            <div className="p-8 rounded-3xl border border-purple-500 bg-purple-500/5 flex flex-col relative transform md:-translate-y-4">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg uppercase tracking-wider">Most Popular</div>
              <h3 className="text-lg font-medium text-purple-400 mb-2">Pro</h3>
              <div className="text-4xl font-bold text-white mb-6">$19<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Everything in Starter', 'Cloud Sync (5 Users)', 'AI Assist + Motion Tools', 'Audience Moderation + Ticker Controls', 'Priority Support'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-white"><CheckCircle2 size={16} className="text-purple-400" /> {f}</li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all font-bold text-sm shadow-lg shadow-purple-900/50">Start Free Trial</button>
            </div>

            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col">
              <h3 className="text-lg font-medium text-gray-400 mb-2">Enterprise</h3>
              <div className="text-4xl font-bold text-white mb-6">Custom</div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Unlimited Operators', 'Multi-Campus Environments', 'Admin Roles + Access Policies', 'SLA + 24/7 Priority Support', 'Dedicated Success Manager'].map(f => (
                  <li key={f} className="flex items-center gap-3 text-sm text-gray-300"><CheckCircle2 size={16} className="text-green-500" /> {f}</li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all font-bold text-sm">Contact Sales</button>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 px-6 bg-gradient-to-b from-[#050505] to-black border-t border-white/5 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to go live?</h2>
          <p className="text-gray-400 mb-10">Download the desktop app for offline presenting, or sign in to the web version right now.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={downloadUrls.installer} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:opacity-90 transition-all flex items-center gap-3 shadow-xl shadow-purple-900/30">
              <Download size={20} /> Download for Windows
            </a>
            <button onClick={onEnter} className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all flex items-center gap-2">
              Latest Version {latestTag}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-tr from-purple-600 to-blue-500 rounded-md flex items-center justify-center">
            <Sparkles size={12} className="text-white fill-white" />
          </div>
          <span className="font-bold text-sm">LUMINA PRESENTER</span>
        </div>
        <p className="text-gray-600 text-sm">© 2026 Lumina Presenter. All rights reserved. · <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Releases on GitHub</a></p>
      </footer>
    </div>
  );
};
