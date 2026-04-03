
import React, { useEffect, useState } from 'react';
import { UserIcon, Settings, X, Save, Church, ShieldCheck, ChevronDown, ChevronUp, CreditCard, Palette, Globe, Lock, Tv2, Network } from 'lucide-react';

interface ProfileSettingsProps {
  onClose: () => void;
  onSave: (settings: any) => void;
  onLogout?: () => void;
  currentSettings: any;
  currentUser?: {
    uid?: string | null;
    email?: string | null;
    displayName?: string | null;
    photoURL?: string | null;
    metadata?: {
      creationTime?: string | null;
      lastSignInTime?: string | null;
    };
  } | null;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onClose, onSave, onLogout, currentSettings, currentUser }) => {
  const [churchName, setChurchName] = useState(currentSettings?.churchName || 'My Church');
  const [ccli, setCcli] = useState(currentSettings?.ccli || '');
  const [defaultVersion, setDefaultVersion] = useState(currentSettings?.defaultVersion || 'kjv');
  const [theme, setTheme] = useState(currentSettings?.theme || 'dark');
  const [remoteAdminEmails, setRemoteAdminEmails] = useState(currentSettings?.remoteAdminEmails || '');
  const [connectionTargetRoles, setConnectionTargetRoles] = useState<string[]>(
    Array.isArray(currentSettings?.connectionTargetRoles) && currentSettings.connectionTargetRoles.length
      ? currentSettings.connectionTargetRoles
      : ['controller', 'output', 'stage']
  );
  const [sessionId, setSessionId] = useState(currentSettings?.sessionId || 'live');
  const [stageProfile, setStageProfile] = useState(currentSettings?.stageProfile || 'classic');
  const [stageFlowLayout, setStageFlowLayout] = useState(currentSettings?.stageFlowLayout || 'balanced');
  const [machineMode, setMachineMode] = useState(!!currentSettings?.machineMode);
  const [slideBrandingEnabled, setSlideBrandingEnabled] = useState(!!currentSettings?.slideBrandingEnabled);
  const [slideBrandingSeriesLabel, setSlideBrandingSeriesLabel] = useState(currentSettings?.slideBrandingSeriesLabel || '');
  const [slideBrandingStyle, setSlideBrandingStyle] = useState<'minimal' | 'bold' | 'frosted'>(currentSettings?.slideBrandingStyle || 'minimal');
  const [slideBrandingOpacity, setSlideBrandingOpacity] = useState<number>(currentSettings?.slideBrandingOpacity ?? 0.82);
  const [ndiSources, setNdiSources] = useState<Array<{ id: string; name: string; sceneId: string }>>(
    Array.isArray(currentSettings?.ndiSources) ? currentSettings.ndiSources : []
  );

  const [activeTab, setActiveTab] = useState<string | null>('account');

  const accountName = currentUser?.displayName || currentUser?.email || 'Authenticated User';
  const accountInitials = accountName.trim().slice(0, 1).toUpperCase();

  const formatAuthDate = (value?: string | null) => {
    if (!value) return 'Not available';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  useEffect(() => {
    setRemoteAdminEmails(currentSettings?.remoteAdminEmails || '');
  }, [currentSettings?.remoteAdminEmails]);

  useEffect(() => {
    const nextSessionId = String(currentSettings?.sessionId || '').trim() || 'live';
    setSessionId(nextSessionId);
  }, [currentSettings?.sessionId]);

  const handleSave = () => {
    const normalizedSessionId = String(sessionId || '').trim() || 'live';
    onSave({ churchName, ccli, defaultVersion, theme, remoteAdminEmails, connectionTargetRoles, sessionId: normalizedSessionId, stageProfile, stageFlowLayout, machineMode, slideBrandingEnabled, slideBrandingSeriesLabel, slideBrandingStyle, slideBrandingOpacity, ndiSources });
    onClose();
  };

  const toggleTab = (tab: string) => {
    setActiveTab(activeTab === tab ? null : tab);
  };

  const SectionHeader = ({ id, icon: Icon, title, description }: { id: string, icon: any, title: string, description: string }) => (
    <div
      onClick={() => toggleTab(id)}
      className={`p-4 flex items-center justify-between cursor-pointer transition-all border-b border-zinc-800/50 ${activeTab === id ? 'bg-zinc-800/30' : 'hover:bg-zinc-800/10'}`}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-lg ${activeTab === id ? 'bg-blue-600/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
          <Icon size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">{title}</h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mt-0.5">{description}</p>
        </div>
      </div>
      {activeTab === id ? <ChevronUp size={16} className="text-zinc-600" /> : <ChevronDown size={16} className="text-zinc-600" />}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl shadow-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white shadow-lg shadow-blue-900/20">
              <Settings size={22} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white tracking-tight leading-none">Studio Workspace</h2>
              <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mt-2">Configuration & Intelligence</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all transform hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-zinc-900/40 custom-scrollbar">

          {/* Account Section */}
          <SectionHeader id="account" icon={UserIcon} title="Account & Security" description="Personal Authentication" />
          {activeTab === 'account' && (
            <div className="p-6 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              <div className="rounded-2xl border border-zinc-800 bg-black/40 p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="relative group">
                  {currentUser?.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="w-20 h-20 rounded-2xl border-2 border-zinc-800 object-cover shadow-2xl" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl border-2 border-zinc-800 bg-zinc-800 text-zinc-400 flex items-center justify-center text-3xl font-black shadow-2xl">
                      {accountInitials || 'U'}
                    </div>
                  )}
                  <div className="absolute -bottom-2 -right-2 p-1.5 bg-blue-600 rounded-lg text-white shadow-lg">
                    <ShieldCheck size={14} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-white truncate">{accountName}</h4>
                  <p className="text-sm text-zinc-500 truncate mb-4">{currentUser?.email || 'Standalone Local Instance'}</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                      <span className="text-zinc-600 font-bold mr-2">LAST LOGIN</span>
                      {formatAuthDate(currentUser?.metadata?.lastSignInTime)}
                    </div>
                    <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400">
                      <span className="text-zinc-600 font-bold mr-2">INSTANCE ID</span>
                      {currentUser?.uid?.slice(0, 12) || 'N/A'}...
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Identity Section */}
          <SectionHeader id="identity" icon={Church} title="Identity & Brand" description="Church & Licensing" />
          {activeTab === 'identity' && (
            <div className="p-6 space-y-5 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-1 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Church / Organization Name</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-blue-500 transition-colors">
                      <Church size={16} />
                    </div>
                    <input
                      type="text"
                      value={churchName}
                      onChange={e => setChurchName(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-zinc-800"
                      placeholder="e.g. Grace Community Church"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">CCLI License Number</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-blue-500 transition-colors">
                      <CreditCard size={16} />
                    </div>
                    <input
                      type="text"
                      value={ccli}
                      onChange={e => setCcli(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all font-mono placeholder:text-zinc-800"
                      placeholder="12345678"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preference Section */}
          <SectionHeader id="preference" icon={Palette} title="Studio Preferences" description="Defaults & Visuals" />
          {activeTab === 'preference' && (
            <div className="p-6 space-y-6 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Default Bible Version</label>
                  <div className="relative">
                    <select
                      value={defaultVersion}
                      onChange={e => setDefaultVersion(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="kjv">KJV (King James)</option>
                      <option value="web">WEB (World English)</option>
                      <option value="niv">NIV (New International)</option>
                      <option value="nkjv">NKJV (New King James)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-600">
                      <Globe size={16} />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Studio UI Theme</label>
                  <div className="relative">
                    <select
                      value={theme}
                      onChange={e => setTheme(e.target.value)}
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="dark">Pro Obsidian</option>
                      <option value="light">Solar High-Key</option>
                      <option value="midnight">Midnight OLED</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-zinc-600">
                      <Palette size={16} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-5 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Stage Profile</label>
                  <select
                    value={stageProfile}
                    onChange={e => setStageProfile(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="classic">Classic Confidence</option>
                    <option value="compact">Compact Grid</option>
                    <option value="high_contrast">High Contrast B&W</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Active Session ID</label>
                  <input
                    type="text"
                    value={sessionId}
                    onChange={e => setSessionId(e.target.value)}
                    data-testid="profile-settings-session-id"
                    className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none transition-all font-mono placeholder:text-zinc-800"
                    placeholder="live"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Stage Flow Layout</label>
                <select
                  value={stageFlowLayout}
                  onChange={e => setStageFlowLayout(e.target.value)}
                  className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-blue-500 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="balanced">Balanced</option>
                  <option value="speaker_focus">Speaker Focus</option>
                  <option value="preview_focus">Preview Focus</option>
                  <option value="minimal_next">Minimal Next</option>
                </select>
                <p className="text-[10px] text-zinc-500 font-medium px-1">Controls how much space stage gives to current vs next content.</p>
              </div>

              <div className="pt-2 border-t border-zinc-800/50">
                <label className="flex items-center gap-3 group cursor-pointer">
                  <div className={`w-10 h-5 rounded-full relative transition-colors border ${machineMode ? 'bg-blue-600 border-blue-500' : 'bg-zinc-800 border-zinc-700'}`}>
                    <div className={`absolute top-0.5 bottom-0.5 w-3.5 h-3.5 bg-white rounded-full transition-all ${machineMode ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                  <input type="checkbox" className="hidden" checked={machineMode} onChange={(e) => setMachineMode(e.target.checked)} />
                  <span className="text-[11px] font-bold text-zinc-400 group-hover:text-white transition-colors">AUTOMATE MACHINE MODE ON BOOT</span>
                </label>
              </div>
            </div>
          )}

          {/* Remote Access Section */}
          <SectionHeader id="remote" icon={Lock} title="Remote Intelligence" description="Admin & Access Control" />
          {activeTab === 'remote' && (
            <div className="p-6 space-y-4 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Allowed Admin Emails</label>
                <textarea
                  value={remoteAdminEmails}
                  onChange={(e) => setRemoteAdminEmails(e.target.value)}
                  data-testid="profile-settings-remote-admin-emails"
                  className="w-full min-h-[140px] bg-black border border-zinc-800 rounded-xl p-5 text-sm text-white font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-zinc-800 custom-scrollbar"
                  placeholder={'pastor@church.org:owner\nmedia@church.org:operator'}
                />
                <div className="flex items-center gap-2 px-1 py-2">
                  <div className="w-1 h-1 rounded-full bg-blue-500" />
                  <p className="text-[10px] text-zinc-500 font-medium">Comma or new-line separated. Suffix with ":role" for granular permissions.</p>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Connection Target Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {['controller', 'output', 'stage', 'remote'].map((role) => (
                    <label key={role} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-black/40 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                      <input
                        type="checkbox"
                        checked={connectionTargetRoles.includes(role)}
                        onChange={(e) => {
                          setConnectionTargetRoles((prev) => {
                            if (e.target.checked) return Array.from(new Set([...prev, role]));
                            const filtered = prev.filter((entry) => entry !== role);
                            return filtered.length ? filtered : ['controller', 'output', 'stage'];
                          });
                        }}
                        className="accent-blue-600"
                      />
                      {role}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-500 font-medium px-1">Used for the Live Connections X/Y denominator.</p>
              </div>
            </div>
          )}

          {/* NDI Sources Section */}
          <SectionHeader id="ndi" icon={Network} title="NDI Sources" description="Source → Aether scene mapping" />
          {activeTab === 'ndi' && (
            <div className="p-6 space-y-3 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              {ndiSources.length === 0 && (
                <p className="text-[11px] text-zinc-500 text-center py-3">No NDI sources configured.</p>
              )}
              {ndiSources.map((src) => (
                <div key={src.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input
                    type="text"
                    value={src.name}
                    onChange={(e) => setNdiSources((prev) => prev.map((s) => s.id === src.id ? { ...s, name: e.target.value } : s))}
                    placeholder="NDI source name"
                    className="bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none placeholder:text-zinc-700 transition-all"
                  />
                  <input
                    type="text"
                    value={src.sceneId}
                    onChange={(e) => setNdiSources((prev) => prev.map((s) => s.id === src.id ? { ...s, sceneId: e.target.value } : s))}
                    placeholder="Aether scene ID"
                    className="bg-black border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:border-blue-500 focus:outline-none font-mono placeholder:text-zinc-700 transition-all"
                  />
                  <button
                    onClick={() => setNdiSources((prev) => prev.filter((s) => s.id !== src.id))}
                    className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setNdiSources((prev) => [...prev, { id: `ndi-${Date.now()}`, name: '', sceneId: '' }])}
                className="w-full py-2 border border-dashed border-zinc-700 rounded-xl text-xs font-bold text-zinc-500 hover:border-zinc-500 hover:text-zinc-300 transition-all"
              >
                + ADD NDI SOURCE
              </button>
              <p className="text-[10px] text-zinc-600 px-1">Source name is the NDI output name. Scene ID maps to an Aether scene for <span className="font-mono">trigger_aether_scene</span> macro actions.</p>
            </div>
          )}
        </div>

        {/* ── Slide Branding ── */}
        <div className="border-b border-zinc-800/50">
          <SectionHeader id="branding" icon={Tv2} title="Slide Branding" description="Church name & series strips on slides" />
          {activeTab === 'branding' && (
            <div className="p-6 space-y-5 bg-zinc-950/30 animate-in slide-in-from-top-4 duration-300">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">Show Branding Strips</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Vertical church name + series label on slide edges</p>
                </div>
                <button
                  onClick={() => setSlideBrandingEnabled((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${slideBrandingEnabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${slideBrandingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              {slideBrandingEnabled && (
                <>
                  {/* Live mini preview */}
                  <div className="relative rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900" style={{ height: 72 }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Slide Preview Area</span>
                    </div>
                    {slideBrandingSeriesLabel && (
                      <div className={`absolute left-0 top-0 bottom-0 flex items-center justify-center ${slideBrandingStyle === 'bold' ? 'bg-black/70' : 'bg-black/45'}`} style={{ width: 20 }}>
                        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: `rgba(255,255,255,${slideBrandingOpacity})`, whiteSpace: 'nowrap' }}>
                          {slideBrandingSeriesLabel}
                        </span>
                      </div>
                    )}
                    {churchName && (
                      <div className={`absolute right-0 top-0 bottom-0 flex items-center justify-center ${slideBrandingStyle === 'bold' ? 'bg-black/70' : 'bg-black/45'}`} style={{ width: 20 }}>
                        <span style={{ writingMode: 'vertical-rl', fontSize: 7, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: `rgba(255,255,255,${slideBrandingOpacity})`, whiteSpace: 'nowrap' }}>
                          {churchName.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Series label input */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Series / Date Label <span className="text-zinc-700 normal-case font-normal">(left strip)</span></label>
                    <input
                      type="text"
                      value={slideBrandingSeriesLabel}
                      onChange={(e) => setSlideBrandingSeriesLabel(e.target.value.slice(0, 60))}
                      maxLength={60}
                      placeholder="e.g. JAN – APR · Series 2 · Week 4"
                      className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all placeholder:text-zinc-700"
                    />
                    <p className="text-[9px] text-zinc-600 px-1">Church name (right strip) uses the Church Name field above.</p>
                  </div>
                  {/* Visibility slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Text Visibility</label>
                      <span className="text-[10px] font-mono text-zinc-400">{Math.round(slideBrandingOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={20} max={100} step={5}
                      value={Math.round(slideBrandingOpacity * 100)}
                      onChange={(e) => setSlideBrandingOpacity(Number(e.target.value) / 100)}
                      className="w-full accent-blue-600"
                    />
                    <div className="flex justify-between text-[9px] text-zinc-700">
                      <span>Subtle</span><span>Vivid</span>
                    </div>
                  </div>
                  {/* Style picker */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Strip Style</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { id: 'minimal', label: 'Minimal', desc: 'Subtle, low contrast' },
                        { id: 'bold',    label: 'Bold',    desc: 'Dark strip, clear edge' },
                        { id: 'frosted', label: 'Frosted', desc: 'Deep semi-opaque' },
                      ] as const).map(({ id, label, desc }) => (
                        <button key={id} onClick={() => setSlideBrandingStyle(id)}
                          className={`p-3 rounded-xl border text-left transition-all ${slideBrandingStyle === id ? 'border-blue-500 bg-blue-950/30' : 'border-zinc-800 bg-black/40 hover:border-zinc-600'}`}
                        >
                          <div className="text-[10px] font-black text-white uppercase tracking-wide">{label}</div>
                          <div className="text-[9px] text-zinc-500 mt-0.5">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-md flex justify-between items-center gap-4">
          <div>
            {onLogout && (
              <button onClick={onLogout} className="px-5 py-2.5 rounded-xl text-xs font-black text-red-400 border border-red-900/40 bg-red-950/20 hover:bg-red-500 hover:text-white transition-all active:scale-95">
                SIGN OUT
              </button>
            )}
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-xs font-bold text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all uppercase tracking-widest">
              Discard
            </button>
            <button onClick={handleSave} className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-xl shadow-blue-900/40 transition-all transform active:scale-95 flex items-center gap-2 group">
              <Save size={16} className="group-hover:scale-110 transition-transform" />
              SYNCHRONIZE WORKSPACE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
