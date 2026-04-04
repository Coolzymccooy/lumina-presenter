import React, { useEffect, useMemo, useRef, useState } from 'react';
import { XIcon, CopyIcon, ExternalLinkIcon, QrCodeIcon, MonitorIcon, RefreshIcon } from './Icons';
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
    aetherRoomId: string;
    onSetAetherRoomId: (id: string) => void;
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
    onAetherStreamRequest: (action: 'start' | 'stop') => Promise<void> | void;
    aetherBridgeStatusTone: 'neutral' | 'ok' | 'error';
    aetherBridgeStatusText: string;
}

type AetherSection = 'urls' | 'bridge' | 'scenes' | 'actions' | 'guidance';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const AccordionSection: React.FC<{
    title: string;
    active: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}> = ({ title, active, onToggle, children }) => (
    <div className="border border-zinc-800 rounded-xl bg-black/30 overflow-hidden">
        <button
            type="button"
            onClick={onToggle}
            className="w-full px-3 py-3 flex items-center justify-between text-left bg-zinc-950/70 hover:bg-zinc-900 text-zinc-200"
        >
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{title}</span>
            <span className="text-[10px] font-mono text-zinc-500">{active ? 'OPEN' : 'CLOSED'}</span>
        </button>
        {active && (
            <div className="p-3 space-y-3">
                {children}
            </div>
        )}
    </div>
);

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
    aetherRoomId,
    onSetAetherRoomId,
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
    onAetherStreamRequest,
    aetherBridgeStatusTone,
    aetherBridgeStatusText,
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
    const [activePanel, setActivePanel] = useState<ConnectPanel>(initialPanel);
    const [bridgeBusy, setBridgeBusy] = useState(false);
    const [projectionBusy, setProjectionBusy] = useState(false);
    const [openSections, setOpenSections] = useState<Record<AetherSection, boolean>>({
        urls: true,
        bridge: true,
        scenes: true,
        actions: true,
        guidance: false,
    });

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(audienceUrl)}`;
    const headingLabel = activePanel === 'audience' ? 'Connect Audience' : 'Aether Integration';
    const aetherStatusClass = aetherBridgeStatusTone === 'ok'
        ? 'border-emerald-700/70 bg-emerald-950/30 text-emerald-200'
        : aetherBridgeStatusTone === 'error'
            ? 'border-rose-700/70 bg-rose-950/30 text-rose-200'
            : 'border-zinc-700 bg-zinc-950/60 text-zinc-300';
    const urls = useMemo(() => ([
        { label: 'Output URL (Browser Source)', value: obsOutputUrl },
        { label: 'Stage URL', value: stageDisplayUrl },
        { label: 'Remote URL', value: remoteControlUrl },
    ]), [obsOutputUrl, remoteControlUrl, stageDisplayUrl]);

    const copyAudienceUrl = async () => {
        const copied = await copyTextToClipboard(audienceUrl);
        alert(copied ? 'Audience URL copied!' : 'Copy failed. Try again or use Ctrl+C manually.');
    };

    const copyAnyUrl = async (value: string, label: string) => {
        const copied = await copyTextToClipboard(value);
        alert(copied ? `${label} copied!` : 'Copy failed. Try again or use Ctrl+C manually.');
    };

    const clampCardToViewport = () => {
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const margin = 12;
        const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
        const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
        setPosition((prev) => {
            if (!prev) return prev;
            return {
                x: clamp(prev.x, margin, maxX),
                y: clamp(prev.y, margin, maxY),
            };
        });
    };

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
        } catch {
            // ignore
        }
        event.preventDefault();
    };

    const runBridgeAction = async (action: () => Promise<void> | void) => {
        if (bridgeBusy) return;
        setBridgeBusy(true);
        try {
            await action();
        } finally {
            setBridgeBusy(false);
        }
    };

    const runProjectionAction = async (action: () => Promise<void> | void) => {
        if (projectionBusy) return;
        setProjectionBusy(true);
        try {
            await action();
        } finally {
            window.setTimeout(() => setProjectionBusy(false), 180);
        }
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
            setProjectionBusy(false);
            return;
        }
        setActivePanel(initialPanel);
        setOpenSections({
            urls: true,
            bridge: true,
            scenes: true,
            actions: true,
            guidance: false,
        });
    }, [isOpen, initialPanel]);

    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        const onResize = () => clampCardToViewport();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onResize);
        window.setTimeout(clampCardToViewport, 0);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onResize);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-md p-3 md:p-4 overflow-y-auto animate-in fade-in duration-300">
            <button
                onClick={onClose}
                className="absolute inset-0 w-full h-full cursor-default"
                aria-label="Close connect modal backdrop"
                data-no-drag
            />
            <div
                ref={cardRef}
                className="absolute w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[calc(100vh-1.5rem)]"
                style={position
                    ? { left: position.x, top: position.y, transform: 'none' }
                    : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
            >
                <div
                    onPointerDown={beginDrag}
                    className={`sticky top-0 z-20 px-5 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/95 backdrop-blur select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                    <div className="flex items-center gap-3 min-w-0">
                        {activePanel === 'audience'
                            ? <QrCodeIcon className="w-5 h-5 text-blue-500 shrink-0" />
                            : <MonitorIcon className="w-5 h-5 text-cyan-400 shrink-0" />}
                        <div className="min-w-0">
                            <h2 className="text-sm md:text-base font-black uppercase tracking-[0.25em] text-white truncate">{headingLabel}</h2>
                            <div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">
                                {activePanel === 'audience' ? 'QR + projector controls' : 'Bridge + switcher controls'}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-all"
                        data-no-drag
                        aria-label="Close connect modal"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-5 pt-4 shrink-0" data-no-drag>
                    <div className="grid grid-cols-2 gap-2">
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
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar" data-no-drag>
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
                                <div className="p-3 bg-black border border-zinc-800 rounded-lg flex items-center justify-between gap-3">
                                    <span className="text-[11px] font-mono text-zinc-500 truncate">{audienceUrl}</span>
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
                                    onClick={() => {
                                        void runProjectionAction(() => onSetProjected(!isProjected));
                                    }}
                                    disabled={projectionBusy}
                                    className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95 border ${
                                        isProjected
                                            ? 'bg-emerald-600/25 border-emerald-500 text-emerald-200 hover:bg-emerald-600/35'
                                            : 'bg-zinc-800/60 border-zinc-700 text-zinc-200 hover:bg-zinc-800'
                                    } ${projectionBusy ? 'opacity-60 cursor-wait' : ''}`}
                                    data-no-drag
                                >
                                    <MonitorIcon className="w-4 h-4" />
                                    {projectionBusy ? 'UPDATING PROJECTOR...' : (isProjected ? 'HIDE QR FROM PROJECTOR' : 'PROJECT QR TO SCREEN')}
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
                                    Tip: Drag this modal by the header. QR projection appears on Output/Projector.
                                </p>
                            </div>
                        </div>
                    )}

                    {activePanel === 'aether' && (
                        <div className="space-y-3">
                            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300 mb-2">
                                    Aether / Switcher Integration (Phase 1-3)
                                </div>
                                <p className="text-[11px] text-zinc-400 leading-relaxed">
                                    Lumina can run as browser-source graphics and optionally push live control events into Aether bridge APIs for scene automation.
                                </p>
                            </div>

                            <AccordionSection
                                title="URLs"
                                active={openSections.urls}
                                onToggle={() => setOpenSections((prev) => ({ ...prev, urls: !prev.urls }))}
                            >
                                {urls.map((entry) => (
                                    <div key={entry.label} className="p-2 bg-black/60 border border-zinc-800 rounded-lg flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">{entry.label}</div>
                                            <div className="text-[10px] font-mono text-zinc-500 truncate">{entry.value}</div>
                                        </div>
                                        <button
                                            onClick={() => void copyAnyUrl(entry.value, entry.label)}
                                            className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                                            data-no-drag
                                        >
                                            <CopyIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </AccordionSection>

                            <AccordionSection
                                title="Bridge Settings"
                                active={openSections.bridge}
                                onToggle={() => setOpenSections((prev) => ({ ...prev, bridge: !prev.bridge }))}
                            >
                                <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-black/40 text-[11px] text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={aetherBridgeEnabled}
                                        onChange={(e) => onSetAetherBridgeEnabled(e.target.checked)}
                                        className="accent-cyan-500"
                                    />
                                    Enable Aether Bridge command delivery
                                </label>
                                <label className="flex items-center gap-2 p-2 rounded-lg border border-zinc-800 bg-black/40 text-[11px] text-zinc-300">
                                    <input
                                        type="checkbox"
                                        checked={aetherBridgeAutoSync}
                                        onChange={(e) => onSetAetherBridgeAutoSync(e.target.checked)}
                                        className="accent-cyan-500"
                                    />
                                    Auto-sync Lumina runtime state to bridge
                                </label>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] uppercase tracking-wider text-zinc-500">Bridge Endpoint URL</label>
                                        {!aetherBridgeUrl.trim() && (
                                            <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest">Required</span>
                                        )}
                                    </div>
                                    <input
                                        value={aetherBridgeUrl}
                                        onChange={(e) => onSetAetherBridgeUrl(e.target.value)}
                                        placeholder="https://aethercast.tiwaton.co.uk/api/lumina/bridge"
                                        className={`w-full px-2 py-2 rounded-lg border bg-black/60 text-[11px] text-zinc-200 font-mono placeholder:text-zinc-600 transition-colors ${
                                            aetherBridgeUrl.trim()
                                                ? 'border-zinc-700 focus:border-cyan-600'
                                                : 'border-amber-700/60 focus:border-amber-500'
                                        }`}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] uppercase tracking-wider text-zinc-500">Aether Room ID</label>
                                        {!aetherRoomId.trim() && (
                                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Optional — broadcasts to all</span>
                                        )}
                                    </div>
                                    <input
                                        value={aetherRoomId}
                                        onChange={(e) => onSetAetherRoomId(e.target.value)}
                                        placeholder="e.g. SLTN-1234 (matches ?room= in Aether URL)"
                                        className="w-full px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200 font-mono"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase tracking-wider text-zinc-500">Bridge Token (optional, local only)</label>
                                    <input
                                        value={aetherBridgeToken}
                                        onChange={(e) => onSetAetherBridgeToken(e.target.value)}
                                        placeholder="x-lumina-token"
                                        className="w-full px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200 font-mono"
                                    />
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                title="Scene Mapping"
                                active={openSections.scenes}
                                onToggle={() => setOpenSections((prev) => ({ ...prev, scenes: !prev.scenes }))}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-zinc-500">Program Scene</label>
                                        <input
                                            value={aetherSceneProgram}
                                            onChange={(e) => onSetAetherSceneProgram(e.target.value)}
                                            className="w-full px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-wider text-zinc-500">Blackout Scene</label>
                                        <input
                                            value={aetherSceneBlackout}
                                            onChange={(e) => onSetAetherSceneBlackout(e.target.value)}
                                            className="w-full px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                        />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-[10px] uppercase tracking-wider text-zinc-500">Lobby Scene</label>
                                        <input
                                            value={aetherSceneLobby}
                                            onChange={(e) => onSetAetherSceneLobby(e.target.value)}
                                            className="w-full px-2 py-2 rounded-lg border border-zinc-800 bg-black/60 text-[11px] text-zinc-200"
                                        />
                                    </div>
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                title="Actions / Status"
                                active={openSections.actions}
                                onToggle={() => setOpenSections((prev) => ({ ...prev, actions: !prev.actions }))}
                            >
                                {!aetherBridgeUrl.trim() && (
                                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-700/60 bg-amber-950/30 text-amber-300 text-[11px]">
                                        <span className="text-base leading-none">⚠️</span>
                                        <span>Enter a Bridge Endpoint URL above to enable these controls.</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <button
                                        onClick={() => void runBridgeAction(onAetherBridgePing)}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-cyan-600/80 bg-cyan-950/40 text-cyan-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-cyan-900/50 hover:border-cyan-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-cyan-900/40"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">📡</span>
                                        {bridgeBusy ? 'SENDING…' : 'PING BRIDGE'}
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(onAetherBridgeSyncNow)}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-blue-600/80 bg-blue-950/40 text-blue-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-blue-900/50 hover:border-blue-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-blue-900/40"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <RefreshIcon className="w-3.5 h-3.5" />
                                        {bridgeBusy ? 'SENDING…' : 'SYNC NOW'}
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(() => onAetherStreamRequest('start'))}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-blue-500/80 bg-blue-950/40 text-blue-100 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-blue-900/50 hover:border-blue-400 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-blue-900/40"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">▶</span>
                                        GO LIVE AETHER
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(() => onAetherStreamRequest('stop'))}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-red-600/80 bg-red-950/40 text-red-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-red-900/50 hover:border-red-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm hover:shadow-red-900/40"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">■</span>
                                        STOP LIVE AETHER
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(() => onAetherSceneSwitch('program'))}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-emerald-700/70 bg-emerald-950/30 text-emerald-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-emerald-900/40 hover:border-emerald-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">🟢</span>
                                        GO PROGRAM
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(() => onAetherSceneSwitch('blackout'))}
                                        className="flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-rose-700/80 bg-rose-950/40 text-rose-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-rose-900/50 hover:border-rose-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">⬛</span>
                                        GO BLACKOUT
                                    </button>
                                    <button
                                        onClick={() => void runBridgeAction(() => onAetherSceneSwitch('lobby'))}
                                        className="md:col-span-2 flex items-center justify-center gap-2 px-3 py-3 rounded-lg border border-amber-600/80 bg-amber-950/30 text-amber-200 text-[11px] font-black tracking-widest transition-all duration-100 hover:bg-amber-900/40 hover:border-amber-500 hover:text-white active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        disabled={bridgeBusy || !aetherBridgeUrl.trim()}
                                    >
                                        <span className="text-[13px] leading-none">🏛️</span>
                                        GO LOBBY
                                    </button>
                                </div>
                                <div className={`p-2.5 rounded-lg border text-[11px] font-medium ${aetherStatusClass}`}>
                                    {aetherBridgeStatusText || 'Bridge idle — no commands sent yet.'}
                                </div>
                                <div className="p-2.5 rounded-lg border border-zinc-800 bg-black/30 text-[11px] text-zinc-400 leading-relaxed">
                                    With Aether Bridge enabled, Lumina&apos;s existing Presenter <span className="font-semibold text-zinc-200">Go Live</span> action also sends Aether to the Program scene and can trigger stream start when coming out of blackout, hold, or an idle state.
                                </div>
                            </AccordionSection>

                            <AccordionSection
                                title="Baseline Guidance"
                                active={openSections.guidance}
                                onToggle={() => setOpenSections((prev) => ({ ...prev, guidance: !prev.guidance }))}
                            >
                                <ol className="text-[11px] text-zinc-400 list-decimal ml-4 space-y-1">
                                    <li>Add a Browser/Web source in your broadcast app.</li>
                                    <li>Paste the Lumina Output URL above as the source URL.</li>
                                    <li>Configure Aether Bridge URL for command/event automation if needed.</li>
                                </ol>
                                <div className="p-3 rounded-lg border border-zinc-800 bg-black/40">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Recommended Browser Source Baseline</div>
                                    <div className="text-[11px] text-zinc-400 leading-relaxed">
                                        1920x1080, 30 FPS, low buffering, browser-source audio disabled unless intentionally required.
                                    </div>
                                </div>
                                <a
                                    href={obsOutputUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-[11px] font-bold text-cyan-300 hover:text-white"
                                >
                                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                                    OPEN OUTPUT URL
                                </a>
                            </AccordionSection>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-zinc-950/70 text-center border-t border-zinc-800 shrink-0">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">
                        Lumina Live Bridge
                    </p>
                </div>
            </div>
        </div>
    );
};
