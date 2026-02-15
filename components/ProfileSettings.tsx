
import React, { useState } from 'react';
import { UserIcon, Settings, X, Save, Church, ShieldCheck } from 'lucide-react';

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
  const [sessionId, setSessionId] = useState(currentSettings?.sessionId || 'live');
  const [stageProfile, setStageProfile] = useState(currentSettings?.stageProfile || 'classic');
  const [machineMode, setMachineMode] = useState(!!currentSettings?.machineMode);
  const accountName = currentUser?.displayName || currentUser?.email || 'Authenticated User';
  const accountInitials = accountName.trim().slice(0, 1).toUpperCase();
  const formatAuthDate = (value?: string | null) => {
    if (!value) return 'Not available';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const handleSave = () => {
    onSave({ churchName, ccli, defaultVersion, theme, remoteAdminEmails, sessionId, stageProfile, machineMode });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-900/30 rounded-lg text-purple-400">
              <Settings size={20} />
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide">Workspace Settings</h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[72vh] overflow-y-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <UserIcon size={12} /> Account
            </h3>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
              <div className="flex items-center gap-3 mb-4">
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Profile avatar"
                    className="w-11 h-11 rounded-full border border-zinc-700 object-cover"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold">
                    {accountInitials || 'U'}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{accountName}</div>
                  <div className="text-xs text-zinc-400 truncate">{currentUser?.email || 'No email on account'}</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <div className="uppercase tracking-wider text-zinc-500 text-[9px]">User ID</div>
                  <div className="font-mono text-zinc-300 break-all">{currentUser?.uid || 'Not available'}</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <div className="uppercase tracking-wider text-zinc-500 text-[9px]">Last Login</div>
                  <div className="text-zinc-300">{formatAuthDate(currentUser?.metadata?.lastSignInTime)}</div>
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 md:col-span-2">
                  <div className="uppercase tracking-wider text-zinc-500 text-[9px]">Account Created</div>
                  <div className="text-zinc-300">{formatAuthDate(currentUser?.metadata?.creationTime)}</div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Identity Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Church size={12} /> Identity
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Church / Org Name</label>
                <input 
                  type="text" 
                  value={churchName} 
                  onChange={e => setChurchName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none transition-all"
                  placeholder="e.g. Grace Community Church"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">CCLI License #</label>
                <input 
                  type="text" 
                  value={ccli} 
                  onChange={e => setCcli(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none transition-all font-mono"
                  placeholder="12345678"
                />
              </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* Preferences Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <UserIcon size={12} /> Preferences
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Default Bible</label>
                <select 
                  value={defaultVersion} 
                  onChange={e => setDefaultVersion(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-3 text-sm text-white focus:border-purple-500 focus:outline-none appearance-none"
                >
                  <option value="kjv">KJV (King James)</option>
                  <option value="web">WEB (World English)</option>
                  <option value="niv">NIV (New Intl)</option>
                  <option value="nkjv">NKJV (New King James)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">UI Theme</label>
                <select 
                  value={theme} 
                  onChange={e => setTheme(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-3 text-sm text-white focus:border-purple-500 focus:outline-none appearance-none"
                >
                  <option value="dark">Pro Dark</option>
                  <option value="light">Daylight</option>
                  <option value="midnight">Midnight OLED</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Session ID</label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={e => setSessionId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none transition-all font-mono"
                  placeholder="live"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Stage Profile</label>
                <select
                  value={stageProfile}
                  onChange={e => setStageProfile(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-3 text-sm text-white focus:border-purple-500 focus:outline-none appearance-none"
                >
                  <option value="classic">Classic</option>
                  <option value="compact">Compact</option>
                  <option value="high_contrast">High Contrast</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={machineMode} onChange={(e) => setMachineMode(e.target.checked)} />
              Enable Machine Mode by default
            </label>
          </div>

          <hr className="border-zinc-800" />

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck size={12} /> Remote Access
            </h3>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Allowed Admin Emails</label>
              <textarea
                value={remoteAdminEmails}
                onChange={(e) => setRemoteAdminEmails(e.target.value)}
                className="w-full min-h-28 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-purple-500 focus:outline-none transition-all"
                placeholder={'pastor@church.org:owner, media@church.org:operator\nadmin2@church.org'}
              />
              <p className="mt-2 text-[10px] text-zinc-500">
                Comma/new-line separated. Optional role suffix (e.g. email:operator) is accepted.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex justify-between gap-3">
          <div>
            {onLogout && (
              <button onClick={onLogout} className="px-6 py-2.5 rounded-lg text-xs font-bold text-red-300 border border-red-900/60 bg-red-950/20 hover:bg-red-950/40 transition-colors">
                LOGOUT
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors">
              CANCEL
            </button>
            <button onClick={handleSave} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2">
              <Save size={14} /> SAVE SETTINGS
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
