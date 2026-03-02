import React, { useEffect, useRef, useState } from 'react';
import { XIcon, CopyIcon, ExternalLinkIcon, QrCodeIcon, MonitorIcon } from './Icons';

interface ConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    audienceUrl: string;
    isProjected: boolean;
    onSetProjected: (visible: boolean) => void;
    projectionScale: number;
    onSetProjectionScale: (scale: number) => void;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
    isOpen,
    onClose,
    audienceUrl,
    isProjected,
    onSetProjected,
    projectionScale,
    onSetProjectionScale
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(audienceUrl)}`;

    const copyUrl = () => {
        navigator.clipboard.writeText(audienceUrl);
        alert('URL copied to clipboard!');
    };

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if ((event.target as HTMLElement).closest('[data-no-drag]')) return;
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        dragOffsetRef.current = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
        setPosition({ x: rect.left, y: rect.top });
        setDragging(true);
        try {
            event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
        event.preventDefault();
    };

    useEffect(() => {
        if (!dragging) return;
        const onPointerMove = (event: PointerEvent) => {
            const card = cardRef.current;
            if (!card) return;
            const margin = 12;
            const maxX = Math.max(margin, window.innerWidth - card.offsetWidth - margin);
            const maxY = Math.max(margin, window.innerHeight - card.offsetHeight - margin);
            const nextX = clamp(event.clientX - dragOffsetRef.current.x, margin, maxX);
            const nextY = clamp(event.clientY - dragOffsetRef.current.y, margin, maxY);
            setPosition({ x: nextX, y: nextY });
        };
        const onPointerUp = () => setDragging(false);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [dragging]);

    useEffect(() => {
        if (!isOpen) {
            setDragging(false);
            setPosition(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <button
                onClick={onClose}
                className="absolute inset-0 w-full h-full cursor-default"
                aria-label="Close connect audience modal backdrop"
                data-no-drag
            />
            <div
                ref={cardRef}
                className="absolute w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300"
                style={position
                    ? { left: position.x, top: position.y, transform: 'none' }
                    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
                <div
                    onPointerDown={beginDrag}
                    className={`p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    <div className="flex items-center gap-3">
                        <QrCodeIcon className="w-5 h-5 text-blue-500" />
                        <h2 className="text-lg font-black uppercase tracking-widest text-white">Connect Audience</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"
                        data-no-drag
                    >
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
                            data-no-drag
                        >
                            <ExternalLinkIcon className="w-4 h-4" />
                            OPEN SUBMISSION PAGE
                        </a>

                        <button
                            onClick={() => onSetProjected(!isProjected)}
                            className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border ${
                                isProjected
                                    ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200 hover:bg-emerald-600/35'
                                    : 'bg-zinc-800/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                            }`}
                            data-no-drag
                        >
                            <MonitorIcon className="w-4 h-4" />
                            {isProjected ? 'HIDE QR FROM PROJECTOR' : 'PROJECT QR TO SCREEN'}
                        </button>
                        <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/70 text-left">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Projected QR Size</span>
                                <span className="text-[11px] font-mono text-zinc-300">{Math.round((projectionScale || 1) * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                                {[0.9, 1, 1.25, 1.5].map((preset) => (
                                    <button
                                        key={preset}
                                        onClick={() => onSetProjectionScale(preset)}
                                        className={`px-2 py-1 rounded border text-[10px] font-bold ${
                                            Math.abs((projectionScale || 1) - preset) < 0.01
                                                ? 'bg-blue-600/25 border-blue-500 text-blue-200'
                                                : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                                        }`}
                                        data-no-drag
                                    >
                                        {Math.round(preset * 100)}%
                                    </button>
                                ))}
                            </div>
                            <input
                                type="range"
                                min={70}
                                max={220}
                                step={5}
                                value={Math.round((projectionScale || 1) * 100)}
                                onChange={(e) => onSetProjectionScale((Number(e.target.value) || 100) / 100)}
                                className="w-full accent-blue-500"
                                data-no-drag
                            />
                        </div>
                        <p className="text-[11px] text-zinc-500">
                            Tip: Drag this window by its header. QR projection appears on Output/Projector.
                        </p>
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
