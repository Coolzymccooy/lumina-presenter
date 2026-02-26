import React from 'react';
import { XIcon, CopyIcon, ExternalLinkIcon, QrCodeIcon } from './Icons';

interface ConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    audienceUrl: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({ isOpen, onClose, audienceUrl }) => {
    if (!isOpen) return null;

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(audienceUrl)}`;

    const copyUrl = () => {
        navigator.clipboard.writeText(audienceUrl);
        alert('URL copied to clipboard!');
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div className="flex items-center gap-3">
                        <QrCodeIcon className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-black uppercase tracking-widest text-white">Connect Audience</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 flex flex-col items-center text-center">
                    <div className="mb-6 p-4 bg-white rounded-xl shadow-lg">
                        <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                    </div>

                    <h3 className="text-white font-bold mb-2">Scan to Participate</h3>
                    <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                        Congregation members can scan this QR code to submit prayer requests, testimonies, and questions.
                    </p>

                    <div className="w-full space-y-3">
                        <div className="p-3 bg-black border border-zinc-800 rounded-lg flex items-center justify-between group">
                            <span className="text-[11px] font-mono text-zinc-500 truncate mr-4">{audienceUrl}</span>
                            <button onClick={copyUrl} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors">
                                <CopyIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <a
                            href={audienceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
                        >
                            <ExternalLinkIcon className="w-4 h-4" />
                            OPEN SUBMISSION PAGE
                        </a>
                    </div>
                </div>

                <div className="p-4 bg-zinc-950/50 text-center">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                        Powered by Lumina Neuro-Link
                    </p>
                </div>
            </div>
        </div>
    );
};
