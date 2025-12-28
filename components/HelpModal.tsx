
import React, { useState } from 'react';
import { MonitorIcon, PlayIcon, PlusIcon, SparklesIcon } from './Icons';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'SETUP' | 'BUILD' | 'PRESENT' | 'TROUBLE'>('SETUP');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-sm shadow-none w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-950">
          <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2 uppercase tracking-widest">
            <span className="w-5 h-5 rounded-sm bg-blue-600 flex items-center justify-center text-[10px] text-white">?</span>
            Documentation
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs font-bold uppercase">Close</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-48 bg-zinc-950 border-r border-zinc-900 flex flex-col">
             <button onClick={() => setActiveTab('SETUP')} className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${activeTab === 'SETUP' ? 'bg-zinc-900 text-white border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>1. Setup</button>
             <button onClick={() => setActiveTab('BUILD')} className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${activeTab === 'BUILD' ? 'bg-zinc-900 text-white border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>2. Build</button>
             <button onClick={() => setActiveTab('PRESENT')} className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${activeTab === 'PRESENT' ? 'bg-zinc-900 text-white border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>3. Present</button>
             <button onClick={() => setActiveTab('TROUBLE')} className={`text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-l-2 ${activeTab === 'TROUBLE' ? 'bg-zinc-900 text-white border-blue-600' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}>4. Errors</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 bg-zinc-900 text-zinc-400 leading-relaxed text-sm">
            
            {activeTab === 'SETUP' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Projection Setup</h3>
                
                <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-sm">
                  <p className="font-bold text-blue-400 text-xs uppercase mb-1">Architecture Note</p>
                  <p className="text-zinc-300">Lumina utilizes a <strong>detached window instance</strong> for output rendering. This requires browser popup permissions.</p>
                </div>

                <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-sm">
                    <p className="font-bold text-red-400 text-xs uppercase mb-1">Critical Requirement: Popup Blockers</p>
                    <p className="text-zinc-300">
                        You MUST allow popups for this site. If the Projector window fails to launch, check your browser address bar for a "Blocked Popup" icon.
                    </p>
                </div>

                <ol className="list-decimal pl-5 space-y-4 text-zinc-300">
                  <li>
                    <strong className="text-white block mb-1">Physical Connection</strong>
                    Connect external display via HDMI/DP. Configure OS to "Extend Display".
                  </li>
                  <li>
                    <strong className="text-white block mb-1">Initialization</strong>
                    Top Right → Click [LAUNCH OUTPUT].
                  </li>
                  <li>
                    <strong className="text-white block mb-1">Anti-Sleep</strong>
                    While presenting, Lumina plays a silent audio track to prevent your browser from "sleeping" this tab. Ensure audio permissions are granted if asked.
                  </li>
                </ol>
              </div>
            )}

            {activeTab === 'BUILD' && (
               <div className="space-y-6">
                 <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Service Construction</h3>
                 
                 <div className="grid gap-6">
                    <div>
                      <h4 className="font-bold text-white mb-1">Item Creation</h4>
                      <p>Use the [+] button in the sidebar or drag items from the library.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1">Local Media Uploads</h4>
			<p>Upload images and videos directly from your device. These are stored locally in IndexedDB. <strong>Note:</strong> Very large video files ({'>'}500MB) may affect browser performance.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1">AI Assist</h4>
                      <p>Generates slide breaks and formatting from raw text block input. Requires internet connection.</p>
                    </div>

                    <div>
                      <h4 className="font-bold text-white mb-1">Editor Constraints</h4>
                      <p>Text inputs are limited to 1000 characters per slide to prevent rendering engine crashes.</p>
                    </div>
                 </div>
               </div>
            )}

            {activeTab === 'PRESENT' && (
               <div className="space-y-6">
                 <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Execution</h3>
                 
                 <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                    <div className="border border-zinc-800 p-2 rounded-sm">
                      <span className="block text-zinc-500 mb-1">ADVANCE</span>
                      <span className="text-white">SPACE / RIGHT</span>
                    </div>
                    <div className="border border-zinc-800 p-2 rounded-sm">
                      <span className="block text-zinc-500 mb-1">REGRESS</span>
                      <span className="text-white">LEFT</span>
                    </div>
                    <div className="border border-zinc-800 p-2 rounded-sm">
                      <span className="block text-zinc-500 mb-1">BLACKOUT</span>
                      <span className="text-white">B</span>
                    </div>
                 </div>
               </div>
            )}

            {activeTab === 'TROUBLE' && (
               <div className="space-y-6">
                 <h3 className="text-lg font-bold text-white border-b border-zinc-800 pb-2">Diagnostics</h3>
                 
                 <div className="space-y-4">
                    <div className="border border-red-900/30 bg-red-900/10 p-4 rounded-sm">
                      <h4 className="font-bold text-red-400 text-xs uppercase mb-1">Projector Window Disappears</h4>
                      <p className="text-zinc-400">
                         If the main control window is closed or refreshed, the projector window will automatically close to prevent "orphaned" windows. This is expected behavior.
                      </p>
                    </div>

                    <div className="border border-yellow-900/30 bg-yellow-900/10 p-4 rounded-sm">
                        <h4 className="font-bold text-yellow-400 text-xs uppercase mb-1">Memory & Storage</h4>
                        <p className="text-zinc-400">
                            If the app becomes sluggish after uploading many videos, try refreshing the page. This triggers a garbage collection of the media cache.
                        </p>
                    </div>

                    <div className="border border-purple-900/30 bg-purple-900/10 p-4 rounded-sm">
                        <h4 className="font-bold text-purple-400 text-xs uppercase mb-1">AI Errors</h4>
                        <p className="text-zinc-400">
                            AI generation relies on external servers. If it fails, check your internet connection and try the "Retry" button.
                        </p>
                    </div>
                 </div>
               </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};
