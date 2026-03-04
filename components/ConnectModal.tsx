import React, { useEffect, useRef, useState } from 'react';
import { XIcon, CopyIcon, ExternalLinkIcon, QrCodeIcon, MonitorIcon } from './Icons';
import { copyTextToClipboard } from '../services/clipboardService';

export type ConnectPanel = 'audience' | 'aether';

interface ConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPanel?: ConnectPanel;
    audienceUrl: string;
    obsOutputUrl: string;
    stageDisplayUrl: string;
    remoteControlUrl: string;
    isProjected: boolean;
    onSetProjected: (visible: boolean) => void;
    projectionScale: number;
    onSetProjectionScale: (scale: number) => void;
    aetherBridgeEnabled: boolean;
    onSetAetherBridgeEnabled: (enabled: boolean) => void;
    aetherBridgeAutoSync: boolean;
    onSetAetherBridgeAutoSync: (enabled: boolean) => void;
    aetherBridgeUrl: string;
    onSetAetherBridgeUrl: (url: string) => void;
    aetherBridgeToken: string;
    onSetAetherBridgeToken: (token: string) => void;
    aetherSceneProgram: string;
    onSetAetherSceneProgram: (value: string) => void;
    aetherSceneBlackout: string;
    onSetAetherSceneBlackout: (value: string) => void;
    aetherSceneLobby: string;
    onSetAetherSceneLobby: (value: string) => void;
    onAetherBridgePing: () => Promise<void> | void;
    onAetherBridgeSyncNow: () => Promise<void> | void;
    onAetherSceneSwitch: (target: 'program' | 'blackout' | 'lobby') => Promise<void> | void;
    aetherBridgeStatusTone: 'neutral' | 'ok' | 'error';
    aetherBridgeStatusText: string;
}

export const ConnectModal: React.FC<ConnectModalProps> = ({
    isOpen,
    onClose,
    initialPanel = 'audience',
    audienceUrl,
    obsOutputUrl,
    stageDisplayUrl,
    remoteControlUrl,
    isProjected,
    onSetProjected,
    projectionScale,
    onSetProjectionScale,
    aetherBridgeEnabled,
    onSetAetherBridgeEnabled,
    aetherBridgeAutoSync,
    onSetAetherBridgeAutoSync,
    aetherBridgeUrl,
    onSetAetherBridgeUrl,
    aetherBridgeToken,
    onSetAetherBridgeToken,
    aetherSceneProgram,
    onSetAetherSceneProgram,
    aetherSceneBlackout,
    onSetAetherSceneBlackout,
    aetherSceneLobby,
    onSetAetherSceneLobby,
    onAetherBridgePing,
    onAetherBridgeSyncNow,
    onAetherSceneSwitch,
    aetherBridgeStatusTone,
    aetherBridgeStatusText
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [activePanel, setActivePanel] = useState<ConnectPanel>(initialPanel);
    const [bridgeBusy, setBridgeBusy] = useState(false);

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(audienceUrl)}`;

    const copyAudienceUrl = async () => {
        const copied = await copyTextToClipboard(audienceUrl);
        alert(copied ? 'Audience URL copied!' : 'Copy failed. Try again or use Ctrl+C manually.');
    };

    const copyAnyUrl = async (value: string, label: string) => {
        const copied = await copyTextToClipboard(value);
        alert(copied ? `${label} copied!` : 'Copy failed. Try again or use Ctrl+C manually.');
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
            setBridgeBusy(false);
            return;
        }
        setActivePanel(initialPanel);
    }, [isOpen, initialPanel]);

    if (!isOpen) return null;

    const headingLabel = activePanel === 'audience' ? 'Connect Audience' : 'Aether Integration';
    const aetherStatusClass = aetherBridgeStatusTone === 'ok'
        ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200'
        : aetherBridgeStatusTone === 'error'
            ? 'border-rose-700/70 bg-rose-950/30 text-rose-200'
            : 'border-zinc-700 bg-zinc-950/60 text-zinc-300';

    const runBridgeAction = async (action: () => Promise<void> | void) => {
        if (bridgeBusy) return;
        setBridgeBusy(true);
        try {
            await action();
        } finally {
            setBridgeBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <button
                onClick={onClose}
                className="absolute inset-0 w-full h-full cursor-default"
                aria-label="Close connect modal backdrop"
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
                        {activePanel === 'audience'
                            ? <QrCodeIcon className="w-5 h-5 text-blue-500" />
                            : <MonitorIcon className="w-5 h-5 text-cyan-400" />}
                        <h2 className="text-lg font-black uppercase tracking-widest text-white">{headingLabel}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"
                        data-no-drag
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-2" data-no-drag>
                        <button
                            onClick={() => setActivePanel('audience')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                                activePanel === 'audience'
                                    ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            AUDIENCE
                        </button>
                        <button
                            onClick={() => setActivePanel('aether')}
                            className={`px-3 py-2 rounded-lg text-[10px] font-black tracking-widest border transition-all ${
                                activePanel === 'aether'
                                    ? 'bg-cyan-600/20 border-cyan-500 text-cyan-200'
                                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                            }`}
                        >
                            AETHER
                        </button>
                    </div>

                    {activePanel === 'audience' && (
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-6 p-4 bg-white rounded-xl shadow-lg">
                                <img src={qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                            </div>

                            <h3 className="text-white font-bold mb-2">Scan to Participate</h3>
                            <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                                Congregation members can scan this QR code to submit prayer requests, testimonies, and questions.
                            </p>

                            <div className="w-full space-y-3 text-left">
                                <div className="p-3 bg-black border border-zinc-800 rounded-lg flex items-center justify-between group">
                                    <span className="text-[11px] font-mono text-zinc-500 truncate mr-4">{audienceUrl}</span>
                                    <button onClick={copyAudienceUrl} className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors" data-no-drag>
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
                                <p className="text-[11px] text-zinc-500 text-center">
                                    Tip: Drag this window by its header. QR projection appears on Output/Projector.
                                </p>
                            </div>
                        </div>
                    )}

                    {activePanel === 'aether' && (
                        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 text-left space-y-3">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                                Aether / Switcher Integration (Phase 1-3)
                            </div>
                            <p className="text-[11px] text-zinc-400 leading-relaxed">
                                Lumina can run as browser-source graphics and optionally push live control events into Aether bridge APIs for scene automation.
                            </p>
                            <ol className="text-[11px] text-zinc-400 list-decimal ml-4 space-y-1">
                                <li>Add a Browser/Web source in your broadcast app.</li>
                                <li>Paste the Lumina Output URL below as the source URL.</li>
                                <li>Configure Aether Bridge URL for command/event automation (optional).</li>
                            </ol>

                            <div className="space-y-2">
                                <div className="p-2 bg-black/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Output URL (Browser Source)</div>
                                        <div className="text-[10px] font-mono text-zinc-500 truncate">{obsOutputUrl}</div>
                                    </div>
                                    <button
                                        onClick={() => void copyAnyUrl(obsOutputUrl, 'Output URL')}
                                        className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                                        data-no-drag
                                    >
                                        <CopyIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-2 bg-black/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Stage URL</div>
                                        <div className="text-[10px] font-mono text-zinc-500 truncate">{stageDisplayUrl}</div>
                                    </div>
                                    <button
                                        onClick={() => void copyAnyUrl(stageDisplayUrl, 'Stage URL')}
                                        className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                                        data-no-drag
                                    >
                                        <CopyIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="p-2 bg-black/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Remote URL</div>
                                        <div className="text-[10px] font-mono text-zinc-500 truncate">{remoteControlUrl}</div>
                                    </div>
                                    <button
                                        onClick={() => void copyAnyUrl(remoteControlUrl, 'Remote URL')}
                                        className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                                        data-no-drag
                                    >
                                        <CopyIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <label className="col-span-2 flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-black/40 text-[11px] text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={aetherBridgeEnabled}
                                        onChange={(e) => onSetAetherBridgeEnabled(e.target.checked)}
                                        className="accent-cyan-500"
                                        data-no-drag
                                    />
                                    Enable Aether Bridge command delivery
                                </label>
                                <label className="col-span-2 flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-black/40 text-[11px] text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={aetherBridgeAutoSync}
                                        onChange={(e) => onSetAetherBridgeAutoSync(e.target.checked)}
                                        className="accent-cyan-500"
                                        data-no-drag
                                    />
                                    Auto-sync Lumina runtime state to bridge
                                </label>
                                <label className="col-span-2 text-[10px] uppercase tracking-wider text-zinc-500">
                                    Bridge Endpoint URL
                                </label>
                                <input
                                    value={aetherBridgeUrl}
                                    onChange={(e) => onSetAetherBridgeUrl(e.target.value)}
                                    placeholder="https://aether.local/api/lumina/bridge"
                                    className="col-span-2 px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200 font-mono"
                                    data-no-drag
                                />
                                <label className="col-span-2 text-[10px] uppercase tracking-wider text-zinc-500">
                                    Bridge Token (optional, local only)
                                </label>
                                <input
                                    value={aetherBridgeToken}
                                    onChange={(e) => onSetAetherBridgeToken(e.target.value)}
                                    placeholder="x-lumina-token"
                                    className="col-span-2 px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200 font-mono"
                                    data-no-drag
                                />
                                <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                                    Program Scene
                                </label>
                                <label className="text-[10px] uppercase tracking-wider text-zinc-500">
                                    Blackout Scene
                                </label>
                                <input
                                    value={aetherSceneProgram}
                                    onChange={(e) => onSetAetherSceneProgram(e.target.value)}
                                    className="px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                    data-no-drag
                                />
                                <input
                                    value={aetherSceneBlackout}
                                    onChange={(e) => onSetAetherSceneBlackout(e.target.value)}
                                    className="px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                    data-no-drag
                                />
                                <label className="col-span-2 text-[10px] uppercase tracking-wider text-zinc-500">
                                    Lobby Scene
                                </label>
                                <input
                                    value={aetherSceneLobby}
                                    onChange={(e) => onSetAetherSceneLobby(e.target.value)}
                                    className="col-span-2 px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                    data-no-drag
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => void runBridgeAction(onAetherBridgePing)}
                                    className="px-3 py-2 rounded-lg border border-cyan-700/70 bg-cyan-950/30 text-cyan-200 text-[11px] font-bold disabled:opacity-50"
                                    disabled={bridgeBusy}
                                    data-no-drag
                                >
                                    {bridgeBusy ? 'WORKING...' : 'PING BRIDGE'}
                                </button>
                                <button
                                    onClick={() => void runBridgeAction(onAetherBridgeSyncNow)}
                                    className="px-3 py-2 rounded-lg border border-blue-700/70 bg-blue-950/30 text-blue-200 text-[11px] font-bold disabled:opacity-50"
                                    disabled={bridgeBusy}
                                    data-no-drag
                                >
                                    {bridgeBusy ? 'WORKING...' : 'SYNC NOW'}
                                </button>
                                <button
                                    onClick={() => void runBridgeAction(() => onAetherSceneSwitch('program'))}
                                    className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 text-[11px] font-bold disabled:opacity-50"
                                    disabled={bridgeBusy}
                                    data-no-drag
                                >
                                    GO PROGRAM
                                </button>
                                <button
                                    onClick={() => void runBridgeAction(() => onAetherSceneSwitch('blackout'))}
                                    className="px-3 py-2 rounded-lg border border-rose-800/80 bg-rose-950/40 text-rose-200 text-[11px] font-bold disabled:opacity-50"
                                    disabled={bridgeBusy}
                                    data-no-drag
                                >
                                    GO BLACKOUT
                                </button>
                                <button
                                    onClick={() => void runBridgeAction(() => onAetherSceneSwitch('lobby'))}
                                    className="col-span-2 px-3 py-2 rounded-lg border border-amber-700/70 bg-amber-950/30 text-amber-200 text-[11px] font-bold disabled:opacity-50"
                                    disabled={bridgeBusy}
                                    data-no-drag
                                >
                                    GO LOBBY
                                </button>
                            </div>
                            <div className={`p-2 rounded-lg border text-[11px] ${aetherStatusClass}`}>
                                {aetherBridgeStatusText || 'Bridge idle.'}
                            </div>
                            <div className="p-3 rounded-lg border border-zinc-800 bg-black/40">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Recommended Browser Source Baseline</div>
                                <div className="text-[11px] text-zinc-400 leading-relaxed">
                                    1920x1080, 30 FPS, low buffering, browser-source audio disabled (unless intentionally required).
                                </div>
                            </div>
                            <a
                                href={obsOutputUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-[11px] font-bold text-cyan-300 hover:text-white"
                                data-no-drag
                            >
                                <ExternalLinkIcon className="w-3.5 h-3.5" />
                                OPEN OUTPUT URL
                            </a>
                        </div>
                    )}
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
