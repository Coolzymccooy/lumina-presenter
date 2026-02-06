
import React, { useState } from 'react';
import { UserIcon, Settings, X, Save, Church } from 'lucide-react';

interface ProfileSettingsProps {
  onClose: () => void;
  onSave: (settings: any) => void;
  currentSettings: any;
}

export const ProfileSettings: React.FC<ProfileSettingsProps> = ({ onClose, onSave, currentSettings }) => {
  const [churchName, setChurchName] = useState(currentSettings?.churchName || 'My Church');
  const [ccli, setCcli] = useState(currentSettings?.ccli || '');
  const [defaultVersion, setDefaultVersion] = useState(currentSettings?.defaultVersion || 'kjv');
  const [theme, setTheme] = useState(currentSettings?.theme || 'dark');

  const handleSave = () => {
    onSave({ churchName, ccli, defaultVersion, theme });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
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

        <div className="p-6 space-y-6">
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
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 bg-zinc-950/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors">
            CANCEL
          </button>
          <button onClick={handleSave} className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-900/20 transition-all flex items-center gap-2">
            <Save size={14} /> SAVE SETTINGS
          </button>
        </div>
      </div>
    </div>
  );
};
