
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Monitor, Cloud, Smartphone, Zap, 
  Presentation, CheckCircle2, Play, Layout, Menu, X
} from 'lucide-react';

interface LandingPageProps {
  onEnter: () => void;
  isAuthenticated: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnter, isAuthenticated }) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
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
            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Pricing</a>
            <button 
              onClick={onEnter}
              className="px-5 py-2.5 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2"
            >
              {isAuthenticated ? 'Enter Workspace' : 'Sign In'} <Play size={14} fill="currentColor" />
            </button>
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
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-2xl font-bold">How it works</a>
          <button onClick={onEnter} className="w-full py-4 bg-purple-600 text-white rounded-xl font-bold mt-4">
            {isAuthenticated ? 'Enter Workspace' : 'Sign In'}
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-medium text-gray-300 tracking-wide uppercase">Version 2.1 Live</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 leading-tight">
            The Presentation Platform <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400">Built for the Future.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Create stunning visuals, sync across devices, and engage your audience with AI-powered tools. 
            No expensive hardware required.
          </p>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4">
            <button 
              onClick={onEnter}
              className="px-8 py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-gray-100 transition-all shadow-xl shadow-white/10 flex items-center gap-2"
            >
              Start Presenting <Play size={18} fill="currentColor" />
            </button>
            <button className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-xl font-bold text-lg hover:bg-white/10 transition-all">
              View Demo
            </button>
          </div>
        </div>

        {/* Hero Image / Dashboard Preview */}
        <div className="mt-20 max-w-6xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
          <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl aspect-[16/9]">
             {/* Mock UI */}
             <div className="absolute inset-0 flex flex-col">
                <div className="h-10 border-b border-white/5 bg-white/[0.02] flex items-center px-4 gap-2">
                   <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/20" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                      <div className="w-3 h-3 rounded-full bg-green-500/20" />
                   </div>
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

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6">Everything you need. <br />Nothing you don't.</h2>
            <p className="text-gray-400">Powerful features wrapped in a simple, intuitive interface.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Cloud, title: 'Cloud Sync', desc: 'Prepare at home, present at church. Your workspace travels with you.' },
              { icon: Zap, title: 'AI Generation', desc: 'Generate sermon outlines, backgrounds, and announcements in seconds.' },
              { icon: Smartphone, title: 'Mobile Remote', desc: 'Control your presentation from any phone or tablet on the same network.' },
              { icon: Layout, title: 'Multi-Screen', desc: 'Dedicated outputs for Projector, Stage Display, and Live Stream.' },
              { icon: Monitor, title: 'Stage Display', desc: 'High-contrast confidence monitor with next-slide preview and clock.' },
              { icon: Presentation, title: 'Bible Engine', desc: 'Instant access to 10+ translations with auto-formatted slides.' },
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

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 text-center">
        <p className="text-gray-500 text-sm">© 2026 Lumina Presenter. All rights reserved.</p>
      </footer>
    </div>
  );
};
