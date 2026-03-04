
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_SCHEDULE, MOCK_SONGS, DEFAULT_BACKGROUNDS, GOSPEL_TRACKS, GospelTrack } from './constants';
import {
  ServiceItem,
  Slide,
  ItemType,
  AudienceDisplayState,
  AudienceQrProjectionState,
  AudienceMessage,
  StageAlertState,
  StageAlertLayout,
  StageTimerLayout,
  StageTimerVariant,
  ConnectionRole,
  StageMessage,
  StageMessageCategory,
  StageMessageCenterState,
  SpeakerTimerPreset,
  StageFlowLayout,
} from './types';
import { SlideRenderer } from './components/SlideRenderer';
import { AIModal } from './components/AIModal';
import { SlideEditorModal } from './components/SlideEditorModal';
import { ItemEditorPanel } from './components/ItemEditorPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HelpModal } from './components/HelpModal';
import { OutputWindow } from './components/OutputWindow';
import { LoginScreen } from './components/LoginScreen';
import { AudioLibrary } from './components/AudioLibrary';
import { BibleBrowser } from './components/BibleBrowser';
import { LandingPage } from './components/LandingPage';
import { ProfileSettings } from './components/ProfileSettings';
import { MotionLibrary } from './components/MotionLibrary';
import { WelcomeAnimation } from './components/WelcomeAnimation';
import { AudienceSubmit } from './components/AudienceSubmit'; // NEW
import { AudienceStudio } from './components/AudienceStudio'; // NEW
import { ConnectModal } from './components/ConnectModal'; // NEW
import { StageDisplay } from './components/StageDisplay';
import { RemoteControl } from './components/RemoteControl';
import { logActivity, analyzeSentimentContext } from './services/analytics';
import { auth, isFirebaseConfigured, subscribeToState, subscribeToTeamPlaylists, updateLiveState, upsertTeamPlaylist } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import { clearMediaCache, saveMedia } from './services/localMedia';
import {
  archiveRunSheetFile,
  deleteRunSheetFile,
  fetchRunSheetFiles,
  fetchServerSessionState,
  fetchSessionConnections,
  fetchWorkspaceSettings,
  getOrCreateConnectionClientId,
  getServerApiBaseUrl,
  heartbeatSessionConnection,
  importVisualPptxDeck,
  loadLatestWorkspaceSnapshot,
  renameRunSheetFile,
  resolveWorkspaceId,
  reuseRunSheetFile,
  saveServerSessionState,
  saveWorkspaceSettings,
  saveWorkspaceSnapshot
} from './services/serverApi';
import { parsePptxFile } from './services/pptxImport';
import { copyTextToClipboard } from './services/clipboardService';
import { dispatchAetherBridgeEvent } from './services/aetherBridge';
import { PlayIcon, PlusIcon, MonitorIcon, SparklesIcon, EditIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, HelpIcon, VolumeXIcon, Volume2Icon, MusicIcon, BibleIcon, Settings, ChatIcon, QrCodeIcon, CopyIcon } from './components/Icons'; // Added ChatIcon, QrCodeIcon, CopyIcon

// --- CONSTANTS ---
const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'lumina_workspace_settings_updated_at_v1';
const LIVE_STATE_QUEUE_KEY = 'lumina_live_state_queue_v1';
const RUNSHEET_FILES_LOCAL_KEY_PREFIX = 'lumina_runsheet_files_local_v1';
const PRESENTER_TOOLBAR_HINT_KEY = 'lumina_presenter_toolbar_hint_v1';
const AETHER_TOKEN_KEY_PREFIX = 'lumina_aether_bridge_token_v1';
const CLOUD_PLAYLIST_SUFFIX = 'default-playlist-v2';
const SYNC_BACKOFF_BASE_MS = 5000;
const SYNC_BACKOFF_MAX_MS = 60000;
const MAX_LIVE_QUEUE_SIZE = 40;
const SILENT_AUDIO_B64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASCCOkiJAAAAAAAAAAAAAAAAAAAAAAA=";
const PUBLIC_WEB_APP_ORIGIN = 'https://lumina-presenter.vercel.app';
const getWorkspaceSettingsKey = (workspace: string) => `${SETTINGS_KEY}:${workspace || 'default-workspace'}`;
const getWorkspaceSettingsUpdatedAtKey = (workspace: string) => `${SETTINGS_UPDATED_AT_KEY}:${workspace || 'default-workspace'}`;
const getAetherTokenKey = (workspace: string) => `${AETHER_TOKEN_KEY_PREFIX}:${workspace || 'default-workspace'}`;

type WorkspaceSettings = {
  churchName: string;
  ccli: string;
  defaultVersion: string;
  visionarySpeechLocaleMode: 'auto' | 'en-GB' | 'en-US';
  theme: 'dark' | 'light' | 'midnight';
  remoteAdminEmails: string;
  sessionId: string;
  stageProfile: 'classic' | 'compact' | 'high_contrast';
  stageFlowLayout: StageFlowLayout;
  machineMode: boolean;
  stageTimerLayout: StageTimerLayout;
  stageAlertLayout: StageAlertLayout;
  connectionTargetRoles: ConnectionRole[];
  speakerTimerPresets: SpeakerTimerPreset[];
  aetherBridgeEnabled: boolean;
  aetherBridgeAutoSync: boolean;
  aetherBridgeUrl: string;
  aetherSceneProgram: string;
  aetherSceneBlackout: string;
  aetherSceneLobby: string;
};

type AetherBridgeStatusTone = 'neutral' | 'ok' | 'error';

type SmokeTestResult = {
  name: string;
  ok: boolean;
  details: string;
};

type CloudPlaylistRecord = {
  id: string;
  title?: string;
  updatedAt?: number;
  items?: ServiceItem[];
  selectedItemId?: string;
  activeItemId?: string | null;
  activeSlideIndex?: number;
  stageAlert?: StageAlertState;
  stageMessageCenter?: StageMessageCenterState;
  audienceQrProjection?: AudienceQrProjectionState;
  workspaceSettings?: Partial<WorkspaceSettings>;
  workspaceSettingsUpdatedAt?: number;
};

type RunSheetFileRecord = {
  fileId: string;
  title: string;
  payload: {
    items: ServiceItem[];
    selectedItemId?: string | null;
  };
  createdByUid: string | null;
  createdByEmail: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
};

const DEFAULT_STAGE_TIMER_LAYOUT: StageTimerLayout = {
  x: 24,
  y: 24,
  width: 360,
  height: 150,
  fontScale: 1,
  variant: 'top-right',
  locked: false,
};

const DEFAULT_STAGE_ALERT_LAYOUT: StageAlertLayout = {
  x: 120,
  y: 84,
  width: 920,
  height: 116,
  fontScale: 1,
  locked: false,
};

const DEFAULT_CONNECTION_TARGET_ROLES: ConnectionRole[] = ['controller', 'output', 'stage'];
const VALID_CONNECTION_ROLES: ConnectionRole[] = ['controller', 'output', 'stage', 'remote'];
const VALID_STAGE_TIMER_VARIANTS: StageTimerVariant[] = ['top-right', 'top-left', 'bottom-right', 'compact-bar'];
const VALID_STAGE_MESSAGE_CATEGORIES: StageMessageCategory[] = ['urgent', 'timing', 'logistics'];
const VALID_STAGE_FLOW_LAYOUTS: StageFlowLayout[] = ['balanced', 'speaker_focus', 'preview_focus', 'minimal_next'];

const DEFAULT_SPEAKER_TIMER_PRESETS: SpeakerTimerPreset[] = [
  {
    id: 'preset-pastor-main',
    name: 'Pastor Main',
    durationSec: 35 * 60,
    amberPercent: 25,
    redPercent: 10,
    autoStartNextDefault: false,
    speakerName: 'Pastor',
  },
  {
    id: 'preset-assistant-brief',
    name: 'Assistant Brief',
    durationSec: 10 * 60,
    amberPercent: 25,
    redPercent: 10,
    autoStartNextDefault: false,
    speakerName: 'Assistant Pastor',
  },
  {
    id: 'preset-announcement',
    name: 'Announcement',
    durationSec: 5 * 60,
    amberPercent: 25,
    redPercent: 10,
    autoStartNextDefault: true,
    speakerName: 'Host',
  },
];

const createSpeakerPresetDraft = (): SpeakerTimerPreset => ({
  id: `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  name: 'New Preset',
  durationSec: 300,
  amberPercent: 25,
  redPercent: 10,
  autoStartNextDefault: false,
  speakerName: '',
});

const buildCloudPlaylistId = (uid: string) => `${uid}-${CLOUD_PLAYLIST_SUFFIX}`;

const getYoutubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i);
  return m?.[1] ?? null;
};

const looksLikeVideoUrl = (url: string): boolean => {
  if (!url) return false;
  if (getYoutubeId(url)) return true;
  const normalized = url.split('?')[0].toLowerCase();
  return normalized.endsWith('.mp4')
    || normalized.endsWith('.webm')
    || normalized.endsWith('.mov')
    || normalized.includes('/video/')
    || normalized.startsWith('blob:');
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeStageTimerLayout = (value: unknown): StageTimerLayout => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_STAGE_TIMER_LAYOUT;
  const raw = value as Record<string, unknown>;
  const variant = VALID_STAGE_TIMER_VARIANTS.includes(raw.variant as StageTimerVariant)
    ? raw.variant as StageTimerVariant
    : DEFAULT_STAGE_TIMER_LAYOUT.variant;
  return {
    x: typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : DEFAULT_STAGE_TIMER_LAYOUT.x,
    y: typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : DEFAULT_STAGE_TIMER_LAYOUT.y,
    width: typeof raw.width === 'number' && Number.isFinite(raw.width) ? clamp(raw.width, 220, 1600) : DEFAULT_STAGE_TIMER_LAYOUT.width,
    height: typeof raw.height === 'number' && Number.isFinite(raw.height) ? clamp(raw.height, 72, 900) : DEFAULT_STAGE_TIMER_LAYOUT.height,
    fontScale: typeof raw.fontScale === 'number' && Number.isFinite(raw.fontScale) ? clamp(raw.fontScale, 0.6, 3.4) : DEFAULT_STAGE_TIMER_LAYOUT.fontScale,
    variant,
    locked: !!raw.locked,
  };
};

const normalizeStageAlertLayout = (value: unknown): StageAlertLayout => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_STAGE_ALERT_LAYOUT;
  const raw = value as Record<string, unknown>;
  return {
    x: typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : DEFAULT_STAGE_ALERT_LAYOUT.x,
    y: typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : DEFAULT_STAGE_ALERT_LAYOUT.y,
    width: typeof raw.width === 'number' && Number.isFinite(raw.width) ? clamp(raw.width, 320, 1800) : DEFAULT_STAGE_ALERT_LAYOUT.width,
    height: typeof raw.height === 'number' && Number.isFinite(raw.height) ? clamp(raw.height, 88, 640) : DEFAULT_STAGE_ALERT_LAYOUT.height,
    fontScale: typeof raw.fontScale === 'number' && Number.isFinite(raw.fontScale) ? clamp(raw.fontScale, 0.7, 2.2) : DEFAULT_STAGE_ALERT_LAYOUT.fontScale,
    locked: !!raw.locked,
  };
};

const normalizeConnectionTargetRoles = (value: unknown): ConnectionRole[] => {
  if (!Array.isArray(value)) return DEFAULT_CONNECTION_TARGET_ROLES;
  const filtered = value
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry): entry is ConnectionRole => VALID_CONNECTION_ROLES.includes(entry as ConnectionRole));
  const deduped = Array.from(new Set(filtered));
  return deduped.length ? deduped : DEFAULT_CONNECTION_TARGET_ROLES;
};

const sanitizeSpeakerTimerPreset = (value: unknown): SpeakerTimerPreset | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `preset-${Date.now().toString(36)}`;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Preset';
  const durationSec = typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec)
    ? clamp(Math.round(raw.durationSec), 10, 7200)
    : 300;
  const amberPercent = typeof raw.amberPercent === 'number' && Number.isFinite(raw.amberPercent)
    ? clamp(Math.round(raw.amberPercent), 1, 99)
    : 25;
  const redPercent = typeof raw.redPercent === 'number' && Number.isFinite(raw.redPercent)
    ? clamp(Math.round(raw.redPercent), 1, 99)
    : 10;
  const speakerName = typeof raw.speakerName === 'string' ? raw.speakerName.trim() : '';
  return {
    id,
    name,
    durationSec,
    amberPercent,
    redPercent,
    autoStartNextDefault: !!raw.autoStartNextDefault,
    speakerName: speakerName || undefined,
  };
};

const sanitizeSpeakerTimerPresets = (value: unknown): SpeakerTimerPreset[] => {
  if (!Array.isArray(value)) return DEFAULT_SPEAKER_TIMER_PRESETS;
  const next: SpeakerTimerPreset[] = [];
  const seen = new Set<string>();
  value.forEach((entry) => {
    const preset = sanitizeSpeakerTimerPreset(entry);
    if (!preset) return;
    if (seen.has(preset.id)) return;
    seen.add(preset.id);
    next.push(preset);
  });
  return next.length ? next : DEFAULT_SPEAKER_TIMER_PRESETS;
};

const sanitizeWorkspaceSettings = (value: unknown): Partial<WorkspaceSettings> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const safe: Partial<WorkspaceSettings> = {};
  if (typeof raw.churchName === 'string') safe.churchName = raw.churchName;
  if (typeof raw.ccli === 'string') safe.ccli = raw.ccli;
  if (typeof raw.defaultVersion === 'string') safe.defaultVersion = raw.defaultVersion;
  if (raw.visionarySpeechLocaleMode === 'auto' || raw.visionarySpeechLocaleMode === 'en-GB' || raw.visionarySpeechLocaleMode === 'en-US') {
    safe.visionarySpeechLocaleMode = raw.visionarySpeechLocaleMode;
  }
  if (raw.theme === 'dark' || raw.theme === 'light' || raw.theme === 'midnight') safe.theme = raw.theme;
  if (typeof raw.remoteAdminEmails === 'string') safe.remoteAdminEmails = raw.remoteAdminEmails;
  if (typeof raw.sessionId === 'string') safe.sessionId = raw.sessionId;
  if (raw.stageProfile === 'classic' || raw.stageProfile === 'compact' || raw.stageProfile === 'high_contrast') {
    safe.stageProfile = raw.stageProfile;
  }
  if (typeof raw.stageFlowLayout === 'string' && VALID_STAGE_FLOW_LAYOUTS.includes(raw.stageFlowLayout as WorkspaceSettings['stageFlowLayout'])) {
    safe.stageFlowLayout = raw.stageFlowLayout as WorkspaceSettings['stageFlowLayout'];
  }
  if (typeof raw.machineMode === 'boolean') safe.machineMode = raw.machineMode;
  if (raw.stageTimerLayout && typeof raw.stageTimerLayout === 'object') {
    safe.stageTimerLayout = normalizeStageTimerLayout(raw.stageTimerLayout);
  }
  if (raw.stageAlertLayout && typeof raw.stageAlertLayout === 'object') {
    safe.stageAlertLayout = normalizeStageAlertLayout(raw.stageAlertLayout);
  }
  if (Array.isArray(raw.connectionTargetRoles)) {
    safe.connectionTargetRoles = normalizeConnectionTargetRoles(raw.connectionTargetRoles);
  }
  if (Array.isArray(raw.speakerTimerPresets)) {
    safe.speakerTimerPresets = sanitizeSpeakerTimerPresets(raw.speakerTimerPresets);
  }
  if (typeof raw.aetherBridgeEnabled === 'boolean') safe.aetherBridgeEnabled = raw.aetherBridgeEnabled;
  if (typeof raw.aetherBridgeAutoSync === 'boolean') safe.aetherBridgeAutoSync = raw.aetherBridgeAutoSync;
  if (typeof raw.aetherBridgeUrl === 'string') safe.aetherBridgeUrl = raw.aetherBridgeUrl.slice(0, 500);
  if (typeof raw.aetherSceneProgram === 'string') safe.aetherSceneProgram = raw.aetherSceneProgram.slice(0, 120);
  if (typeof raw.aetherSceneBlackout === 'string') safe.aetherSceneBlackout = raw.aetherSceneBlackout.slice(0, 120);
  if (typeof raw.aetherSceneLobby === 'string') safe.aetherSceneLobby = raw.aetherSceneLobby.slice(0, 120);
  return safe;
};

const DEFAULT_AUDIENCE_DISPLAY: AudienceDisplayState = {
  queue: [],
  autoRotate: false,
  rotateSeconds: 8,
  pinnedMessageId: null,
  tickerEnabled: false,
  activeMessageId: null,
};

const DEFAULT_AUDIENCE_QR_PROJECTION: AudienceQrProjectionState = {
  visible: false,
  audienceUrl: '',
  scale: 1,
  updatedAt: 0,
};

const DEFAULT_STAGE_ALERT: StageAlertState = {
  active: false,
  text: '',
  updatedAt: 0,
  author: null,
};

const DEFAULT_STAGE_MESSAGE_CENTER: StageMessageCenterState = {
  queue: [],
  activeMessageId: null,
  lastSentAt: 0,
};

const sanitizeAudienceDisplayState = (value: unknown): AudienceDisplayState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_AUDIENCE_DISPLAY;
  }
  const raw = value as Record<string, unknown>;
  const queue = Array.isArray(raw.queue) ? (raw.queue as AudienceMessage[]).filter((msg) => {
    return !!msg && typeof msg === 'object' && typeof msg.id === 'number' && typeof msg.text === 'string';
  }) : [];
  const rotateSeconds = typeof raw.rotateSeconds === 'number' && Number.isFinite(raw.rotateSeconds)
    ? Math.min(120, Math.max(3, Math.round(raw.rotateSeconds)))
    : DEFAULT_AUDIENCE_DISPLAY.rotateSeconds;
  const toNullableNumber = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? input : null);

  return {
    queue,
    autoRotate: !!raw.autoRotate,
    rotateSeconds,
    pinnedMessageId: toNullableNumber(raw.pinnedMessageId),
    tickerEnabled: !!raw.tickerEnabled,
    activeMessageId: toNullableNumber(raw.activeMessageId),
  };
};

const sanitizeAudienceQrProjectionState = (value: unknown): AudienceQrProjectionState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_AUDIENCE_QR_PROJECTION;
  }
  const raw = value as Record<string, unknown>;
  const audienceUrl = typeof raw.audienceUrl === 'string' ? raw.audienceUrl.trim() : '';
  return {
    visible: !!raw.visible && !!audienceUrl,
    audienceUrl,
    scale: typeof raw.scale === 'number' && Number.isFinite(raw.scale) ? clamp(raw.scale, 0.7, 2.2) : 1,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
  };
};

const sanitizeStageAlertState = (value: unknown): StageAlertState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_STAGE_ALERT;
  }
  const raw = value as Record<string, unknown>;
  return {
    active: !!raw.active,
    text: typeof raw.text === 'string' ? raw.text : '',
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
    author: typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim() : null,
  };
};

const sanitizeStageMessage = (value: unknown): StageMessage | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!text) return null;
  const category = VALID_STAGE_MESSAGE_CATEGORIES.includes(raw.category as StageMessageCategory)
    ? raw.category as StageMessageCategory
    : 'urgent';
  const id = typeof raw.id === 'string' && raw.id.trim()
    ? raw.id.trim()
    : `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const priority = raw.priority === 'high' ? 'high' : 'normal';
  const createdAt = typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const author = typeof raw.author === 'string' && raw.author.trim() ? raw.author.trim() : null;
  const templateKey = typeof raw.templateKey === 'string' && raw.templateKey.trim() ? raw.templateKey.trim() : undefined;
  return {
    id,
    category,
    text,
    priority,
    target: 'stage_only',
    createdAt,
    author,
    templateKey,
  };
};

const sanitizeStageMessageCenterState = (value: unknown): StageMessageCenterState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_STAGE_MESSAGE_CENTER;
  const raw = value as Record<string, unknown>;
  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(sanitizeStageMessage).filter((entry): entry is StageMessage => !!entry)
    : [];
  const activeMessageIdRaw = typeof raw.activeMessageId === 'string' ? raw.activeMessageId.trim() : '';
  const activeMessageId = activeMessageIdRaw && queue.some((entry) => entry.id === activeMessageIdRaw)
    ? activeMessageIdRaw
    : (queue[0]?.id || null);
  const lastSentAt = typeof raw.lastSentAt === 'number' && Number.isFinite(raw.lastSentAt)
    ? raw.lastSentAt
    : (queue[0]?.createdAt || 0);
  return {
    queue,
    activeMessageId,
    lastSentAt,
  };
};

const stageMessageFromLegacyAlert = (alert: StageAlertState): StageMessage | null => {
  const text = String(alert?.text || '').trim();
  if (!alert?.active || !text) return null;
  return {
    id: `legacy-${Math.max(1, Number(alert.updatedAt || Date.now()))}`,
    category: 'urgent',
    text,
    priority: 'high',
    target: 'stage_only',
    createdAt: Number(alert.updatedAt || Date.now()),
    author: alert.author || null,
    templateKey: 'legacy',
  };
};

const legacyAlertFromMessageCenter = (center: StageMessageCenterState): StageAlertState => {
  const active = center.queue.find((entry) => entry.id === center.activeMessageId) || null;
  if (!active) return { ...DEFAULT_STAGE_ALERT, updatedAt: Number(center.lastSentAt || Date.now()) };
  return {
    active: true,
    text: active.text,
    updatedAt: Number(active.createdAt || Date.now()),
    author: active.author || null,
  };
};

declare global {
  interface Window {
    luminaSmokeTest?: () => {
      ok: boolean;
      sessionId: string;
      timestamp: string;
      results: SmokeTestResult[];
    };
  }
}

const PauseIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
);
const RewindIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="11 19 2 12 11 5 11 19"></polygon><polygon points="22 19 13 12 22 5 22 19"></polygon></svg>
);
const ForwardIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 19 22 12 13 5 13 19"></polygon><polygon points="2 19 11 12 2 5 2 19"></polygon></svg>
);

function App() {
  // @ts-ignore
  const isElectronShell = !!window.electron?.isElectron;
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [viewState, setViewState] = useState<'landing' | 'studio' | 'audience' | 'output' | 'stage' | 'remote'>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/audience')) return 'audience';
    if (hash.startsWith('#/output')) return 'output';
    if (hash.startsWith('#/stage')) return 'stage';
    if (hash.startsWith('#/remote')) return 'remote';
    if (window.location.pathname === '/audience') return 'audience';
    if (window.location.pathname === '/output') return 'output';
    if (window.location.pathname === '/stage') return 'stage';
    if (window.location.pathname === '/remote') return 'remote';
    // @ts-ignore
    if (window.electron?.isElectron) return 'studio';
    return 'landing';
  });

  const [saveError, setSaveError] = useState<boolean>(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);

  // ✅ Projector popout window handle (opened in click handler to avoid popup blockers)
  const [outputWin, setOutputWin] = useState<Window | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Only show onboarding in the studio view for new users
    const hasSeen = localStorage.getItem('lumina_onboarding_v2.2.0');
    return !hasSeen;
  });
  const [activeSidebarTab, setActiveSidebarTab] = useState<'SCHEDULE' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES'>('SCHEDULE');
  const isSettingsHydratedRef = useRef(false);

  const parseJson = <T,>(raw: string | null, fallback: T): T => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  const getSavedState = () => {
    try {
      return parseJson(localStorage.getItem(STORAGE_KEY), null as any);
    } catch (e) {
      console.warn("State load failed", e);
      return null;
    }
  };
  const initialSavedStateRef = useRef<any>(null);
  if (initialSavedStateRef.current === null) {
    initialSavedStateRef.current = getSavedState();
  }
  const initialSavedState = initialSavedStateRef.current;

  const [schedule, setSchedule] = useState<ServiceItem[]>(() => {
    const saved = initialSavedState;
    return saved?.schedule || INITIAL_SCHEDULE;
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const saved = initialSavedState;
    const savedSchedule = saved?.schedule || INITIAL_SCHEDULE;
    return saved?.selectedItemId || savedSchedule[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'BUILDER' | 'PRESENTER'>(() => {
    const saved = initialSavedState;
    return saved?.viewMode || 'BUILDER';
  });

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSlideEditorOpen, setIsSlideEditorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); // NEW
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    churchName: 'My Church',
    ccli: '',
    defaultVersion: 'kjv',
    visionarySpeechLocaleMode: 'auto',
    theme: 'dark',
    remoteAdminEmails: '',
    sessionId: 'live',
    stageProfile: 'classic',
    stageFlowLayout: 'balanced',
    machineMode: false,
    stageTimerLayout: DEFAULT_STAGE_TIMER_LAYOUT,
    stageAlertLayout: DEFAULT_STAGE_ALERT_LAYOUT,
    connectionTargetRoles: DEFAULT_CONNECTION_TARGET_ROLES,
    speakerTimerPresets: DEFAULT_SPEAKER_TIMER_PRESETS,
    aetherBridgeEnabled: false,
    aetherBridgeAutoSync: true,
    aetherBridgeUrl: '',
    aetherSceneProgram: 'Program',
    aetherSceneBlackout: 'Blackout',
    aetherSceneLobby: 'Lobby',
  });
  const allowedAdminEmails = useMemo(() => {
    const raw = workspaceSettings.remoteAdminEmails || '';
    const parsed = raw
      .split(/[\n,;]+/)
      .map((entry) => entry.trim().toLowerCase())
      .map((entry) => {
        const [email] = entry.split(/[:|]/);
        return email.trim();
      })
      .filter(Boolean);
    return Array.from(new Set(parsed));
  }, [workspaceSettings.remoteAdminEmails]);
  const canUsePastorAlert = useMemo(() => {
    if (!user?.uid) return false;
    if (!allowedAdminEmails.length) return true;
    const normalizedUserEmail = String(user?.email || '').trim().toLowerCase();
    return !!normalizedUserEmail && allowedAdminEmails.includes(normalizedUserEmail);
  }, [user?.uid, user?.email, allowedAdminEmails]);
  const liveSessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const urlSession = params.get('session');
    if (urlSession && viewState === 'audience') return urlSession.trim();
    return (workspaceSettings.sessionId || 'live').trim() || 'live';
  }, [workspaceSettings.sessionId, viewState]);

  const workspaceId = useMemo(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const urlWorkspace = params.get('workspace');
    if (urlWorkspace && viewState === 'audience') return urlWorkspace.trim();
    return resolveWorkspaceId(user);
  }, [user?.uid, viewState]);

  const controllerClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, liveSessionId, 'controller'),
    [workspaceId, liveSessionId]
  );
  const outputClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, liveSessionId, 'output'),
    [workspaceId, liveSessionId]
  );
  const stageClientId = useMemo(
    () => getOrCreateConnectionClientId(workspaceId, liveSessionId, 'stage'),
    [workspaceId, liveSessionId]
  );
  const targetConnectionRoles = useMemo(
    () => normalizeConnectionTargetRoles(workspaceSettings.connectionTargetRoles),
    [workspaceSettings.connectionTargetRoles]
  );
  const [isMotionLibOpen, setIsMotionLibOpen] = useState(false); // NEW
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [isLyricsImportOpen, setIsLyricsImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('Imported Lyrics');
  const [importLyrics, setImportLyrics] = useState('');
  const [importModalError, setImportModalError] = useState<string | null>(null);
  const [isImportingDeck, setIsImportingDeck] = useState(false);
  const [importDeckStatus, setImportDeckStatus] = useState('');
  const [syncPendingCount, setSyncPendingCount] = useState(0);
  const [autoCueEnabled, setAutoCueEnabled] = useState(false);
  const [autoCueSeconds, setAutoCueSeconds] = useState(7);
  const [autoCueRemaining, setAutoCueRemaining] = useState(7);
  const [editingSlide, setEditingSlide] = useState<Slide | null>(null);
  const [isOutputLive, setIsOutputLive] = useState(false);
  const [isStageDisplayLive, setIsStageDisplayLive] = useState(false);
  const [lowerThirdsEnabled, setLowerThirdsEnabled] = useState(false);
  const [routingMode, setRoutingMode] = useState<'PROJECTOR' | 'STREAM' | 'LOBBY'>('PROJECTOR');
  const [teamPlaylists, setTeamPlaylists] = useState<CloudPlaylistRecord[]>([]);
  const [cloudBootstrapComplete, setCloudBootstrapComplete] = useState(!isFirebaseConfigured());
  const [stageWin, setStageWin] = useState<Window | null>(null);
  const [timerMode, setTimerMode] = useState<'COUNTDOWN' | 'ELAPSED'>(() => {
    const saved = initialSavedState;
    return saved?.timerMode === 'ELAPSED' ? 'ELAPSED' : 'COUNTDOWN';
  });
  const [timerDurationMin, setTimerDurationMin] = useState(() => {
    const saved = initialSavedState;
    const raw = Number(saved?.timerDurationMin);
    return Number.isFinite(raw) ? Math.max(1, Math.min(180, Math.round(raw))) : 35;
  });
  const [timerSeconds, setTimerSeconds] = useState(() => {
    const saved = initialSavedState;
    const raw = Number(saved?.timerSeconds);
    if (Number.isFinite(raw)) return Math.round(raw);
    const savedMode = saved?.timerMode === 'ELAPSED' ? 'ELAPSED' : 'COUNTDOWN';
    const savedDuration = Number(saved?.timerDurationMin);
    const safeDuration = Number.isFinite(savedDuration) ? Math.max(1, Math.min(180, Math.round(savedDuration))) : 35;
    return savedMode === 'COUNTDOWN' ? safeDuration * 60 : 0;
  });
  const [currentCueItemId, setCurrentCueItemId] = useState<string | null>(() => {
    const saved = initialSavedState;
    return typeof saved?.currentCueItemId === 'string' ? saved.currentCueItemId : null;
  });
  const [cueZeroHold, setCueZeroHold] = useState(false);
  const [connectionCountsByRole, setConnectionCountsByRole] = useState<Record<string, number>>({});
  const [activeTargetConnectionCount, setActiveTargetConnectionCount] = useState(0);
  const controllerConnectionFailureRef = useRef(0);
  const controllerConnectionPauseUntilRef = useRef(0);
  const outputHeartbeatFailureRef = useRef(0);
  const outputHeartbeatPauseUntilRef = useRef(0);
  const stageHeartbeatFailureRef = useRef(0);
  const stageHeartbeatPauseUntilRef = useRef(0);

  const [audienceDisplay, setAudienceDisplay] = useState<AudienceDisplayState>(() => {
    const saved = initialSavedState;
    return sanitizeAudienceDisplayState(saved?.audienceDisplay);
  });
  const [audienceQrProjection, setAudienceQrProjection] = useState<AudienceQrProjectionState>(() => {
    const saved = initialSavedState;
    return sanitizeAudienceQrProjectionState(saved?.audienceQrProjection);
  });
  const [stageAlert, setStageAlert] = useState<StageAlertState>(() => {
    const saved = initialSavedState;
    const direct = sanitizeStageAlertState(saved?.stageAlert);
    if (direct.active && direct.text.trim()) return direct;
    const center = sanitizeStageMessageCenterState(saved?.stageMessageCenter);
    return legacyAlertFromMessageCenter(center);
  });
  const [stageMessageCenter, setStageMessageCenter] = useState<StageMessageCenterState>(() => {
    const saved = initialSavedState;
    const center = sanitizeStageMessageCenterState(saved?.stageMessageCenter);
    if (center.queue.length > 0) return center;
    const legacy = stageMessageFromLegacyAlert(sanitizeStageAlertState(saved?.stageAlert));
    if (!legacy) return center;
    return {
      queue: [legacy],
      activeMessageId: legacy.id,
      lastSentAt: legacy.createdAt,
    };
  });
  const [runSheetFiles, setRunSheetFiles] = useState<RunSheetFileRecord[]>([]);
  const [runSheetFilesLoading, setRunSheetFilesLoading] = useState(false);
  const [runSheetFilesError, setRunSheetFilesError] = useState<string | null>(null);
  const [runSheetFileQuery, setRunSheetFileQuery] = useState('');
  const [runSheetArchiveTitle, setRunSheetArchiveTitle] = useState('');
  const [selectedSpeakerPresetId, setSelectedSpeakerPresetId] = useState('');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<SpeakerTimerPreset>(() => createSpeakerPresetDraft());
  const presenterControlsRef = useRef<HTMLDivElement | null>(null);
  const [presenterControlsHasOverflow, setPresenterControlsHasOverflow] = useState(false);
  const [presenterControlsCanScrollLeft, setPresenterControlsCanScrollLeft] = useState(false);
  const [presenterControlsCanScrollRight, setPresenterControlsCanScrollRight] = useState(false);
  const [presenterControlsScrollPercent, setPresenterControlsScrollPercent] = useState(0);
  const [presenterControlsShowHint, setPresenterControlsShowHint] = useState(false);
  const [isPresenterControlsHelpOpen, setIsPresenterControlsHelpOpen] = useState(false);

  const updatePresenterControlsScrollState = useCallback(() => {
    const node = presenterControlsRef.current;
    if (!node) {
      setPresenterControlsHasOverflow(false);
      setPresenterControlsCanScrollLeft(false);
      setPresenterControlsCanScrollRight(false);
      setPresenterControlsScrollPercent(0);
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const hasOverflow = maxScrollLeft > 8;
    const clampedLeft = clamp(node.scrollLeft, 0, maxScrollLeft);
    const percent = hasOverflow && maxScrollLeft > 0 ? (clampedLeft / maxScrollLeft) * 100 : 0;
    setPresenterControlsHasOverflow(hasOverflow);
    setPresenterControlsCanScrollLeft(hasOverflow && clampedLeft > 4);
    setPresenterControlsCanScrollRight(hasOverflow && clampedLeft < maxScrollLeft - 4);
    setPresenterControlsScrollPercent(percent);
  }, []);

  const markPresenterControlsHintSeen = useCallback(() => {
    try {
      localStorage.setItem(PRESENTER_TOOLBAR_HINT_KEY, '1');
    } catch {}
  }, []);

  const dismissPresenterControlsHint = useCallback(() => {
    setPresenterControlsShowHint(false);
    markPresenterControlsHintSeen();
  }, [markPresenterControlsHintSeen]);

  const openPresenterControlsHelp = useCallback(() => {
    setIsPresenterControlsHelpOpen(true);
    dismissPresenterControlsHint();
  }, [dismissPresenterControlsHint]);

  const scrollPresenterControlsBy = useCallback((delta: number) => {
    const node = presenterControlsRef.current;
    if (!node) return;
    node.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const handlePresenterControlsSliderChange = useCallback((value: number) => {
    const node = presenterControlsRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    node.scrollTo({ left: (maxScrollLeft * clamp(value, 0, 100)) / 100, behavior: 'auto' });
    updatePresenterControlsScrollState();
  }, [updatePresenterControlsScrollState]);

  // Handle Auto-Rotate Logic
  useEffect(() => {
    if (!audienceDisplay.autoRotate || audienceDisplay.queue.length === 0) return;

    const interval = setInterval(() => {
      setAudienceDisplay(prev => {
        if (prev.queue.length === 0) return prev;
        const currentIndex = prev.queue.findIndex(m => m.id === prev.activeMessageId);
        const nextIndex = (currentIndex + 1) % prev.queue.length;
        return {
          ...prev,
          activeMessageId: prev.queue[nextIndex].id
        };
      });
    }, audienceDisplay.rotateSeconds * 1000);

    return () => clearInterval(interval);
  }, [audienceDisplay.autoRotate, audienceDisplay.queue.length, audienceDisplay.rotateSeconds, audienceDisplay.activeMessageId]);

  const handleUpdateAudienceDisplay = (patch: Partial<AudienceDisplayState>) => {
    setAudienceDisplay(prev => {
      const next = { ...prev, ...patch };
      // If we just enabled auto-rotate and have a queue but no active message, set the first one
      if (patch.autoRotate && next.queue.length > 0 && !next.activeMessageId) {
        next.activeMessageId = next.queue[0].id;
      }
      return next;
    });
  };
  const nextStageMessageId = () => `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const handleQueueStageMessage = (input: {
    text: string;
    category: StageMessageCategory;
    priority?: 'normal' | 'high';
    templateKey?: string;
  }) => {
    const text = String(input.text || '').trim();
    if (!text) return;
    const createdAt = Date.now();
    const message: StageMessage = {
      id: nextStageMessageId(),
      category: input.category,
      text,
      priority: input.priority === 'high' ? 'high' : 'normal',
      target: 'stage_only',
      createdAt,
      author: String(user?.email || user?.uid || '').trim() || null,
      templateKey: input.templateKey,
    };
    setStageMessageCenter((prev) => {
      const queue = [...prev.queue, message];
      return {
        queue,
        activeMessageId: prev.activeMessageId || message.id,
        lastSentAt: createdAt,
      };
    });
  };
  const handlePromoteStageMessage = (messageId: string) => {
    setStageMessageCenter((prev) => {
      if (!prev.queue.some((entry) => entry.id === messageId)) return prev;
      return {
        ...prev,
        activeMessageId: messageId,
        lastSentAt: Date.now(),
      };
    });
  };
  const handleRemoveQueuedStageMessage = (messageId: string) => {
    setStageMessageCenter((prev) => {
      const queue = prev.queue.filter((entry) => entry.id !== messageId);
      const activeMessageId = prev.activeMessageId === messageId
        ? (queue[0]?.id || null)
        : prev.activeMessageId;
      return {
        ...prev,
        queue,
        activeMessageId,
      };
    });
  };
  const handleClearStageAlert = () => {
    setStageMessageCenter((prev) => ({
      ...prev,
      activeMessageId: null,
      lastSentAt: Date.now(),
    }));
  };
  const handleSendStageMessageNow = (input: {
    text: string;
    category: StageMessageCategory;
    priority?: 'normal' | 'high';
    templateKey?: string;
  }) => {
    const trimmed = String(input.text || '').trim();
    if (!trimmed) return;
    const now = Date.now();
    const message: StageMessage = {
      id: nextStageMessageId(),
      category: input.category,
      text: trimmed,
      priority: input.priority === 'high' ? 'high' : 'normal',
      target: 'stage_only',
      createdAt: now,
      author: String(user?.email || user?.uid || '').trim() || null,
      templateKey: input.templateKey,
    };
    setStageMessageCenter((prev) => ({
      queue: [message, ...prev.queue.filter((entry) => entry.id !== message.id)],
      activeMessageId: message.id,
      lastSentAt: now,
    }));
  };
  const handleSendStageAlert = (text: string) => {
    handleSendStageMessageNow({
      text,
      category: 'urgent',
      priority: 'high',
      templateKey: 'legacy',
    });
  };
  useEffect(() => {
    setStageAlert(legacyAlertFromMessageCenter(stageMessageCenter));
  }, [stageMessageCenter]);
  useEffect(() => {
    const presets = workspaceSettings.speakerTimerPresets || [];
    if (!presets.length) {
      setSelectedSpeakerPresetId('');
      return;
    }
    if (!selectedSpeakerPresetId || !presets.some((entry) => entry.id === selectedSpeakerPresetId)) {
      setSelectedSpeakerPresetId(presets[0].id);
    }
  }, [workspaceSettings.speakerTimerPresets, selectedSpeakerPresetId]);

  const filteredRunSheetFiles = useMemo(() => {
    const query = runSheetFileQuery.trim().toLowerCase();
    if (!query) return runSheetFiles;
    return runSheetFiles.filter((entry) => {
      return entry.title.toLowerCase().includes(query)
        || String(entry.createdByEmail || '').toLowerCase().includes(query);
    });
  }, [runSheetFiles, runSheetFileQuery]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [connectPanel, setConnectPanel] = useState<'audience' | 'aether'>('audience');
  const [aetherBridgeToken, setAetherBridgeToken] = useState('');
  const [aetherBridgeStatus, setAetherBridgeStatus] = useState<{ tone: AetherBridgeStatusTone; text: string }>({
    tone: 'neutral',
    text: 'Bridge idle.',
  });
  const aetherBridgeAutoSyncTimerRef = useRef<number | null>(null);
  const lastAetherAutoSyncKeyRef = useRef('');
  const aetherBridgeInFlightRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getAetherTokenKey(workspaceId));
      setAetherBridgeToken(String(stored || ''));
    } catch {
      setAetherBridgeToken('');
    }
  }, [workspaceId]);

  useEffect(() => {
    try {
      if (!aetherBridgeToken.trim()) {
        localStorage.removeItem(getAetherTokenKey(workspaceId));
        return;
      }
      localStorage.setItem(getAetherTokenKey(workspaceId), aetherBridgeToken.trim());
    } catch {
      // best effort local persistence for token
    }
  }, [workspaceId, aetherBridgeToken]);

  const [activeItemId, setActiveItemId] = useState<string | null>(() => {
    const saved = initialSavedState;
    return saved?.activeItemId || null;
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(() => {
    const saved = initialSavedState;
    return saved?.activeSlideIndex ?? -1;
  });

  const [blackout, setBlackout] = useState(() => {
    const saved = initialSavedState;
    return !!saved?.blackout;
  });
  const [isPlaying, setIsPlaying] = useState(() => {
    const saved = initialSavedState;
    return typeof saved?.isPlaying === 'boolean' ? saved.isPlaying : true;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const h = window.location.hash;
      if (h.startsWith('#/audience')) {
        setViewState('audience');
      } else if (h.startsWith('#/output')) {
        setViewState('output');
      } else if (h.startsWith('#/stage')) {
        setViewState('stage');
      } else if (h.startsWith('#/remote')) {
        setViewState('remote');
      } else if (h === '#/studio') {
        setViewState('studio');
      } else if (h === '#/landing' || !h) {
        setViewState(isElectronShell ? 'studio' : 'landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isElectronShell]);

  useEffect(() => {
    if (isElectronShell && viewState === 'landing') {
      setViewState('studio');
    }
  }, [isElectronShell, viewState]);
  const [outputMuted, setOutputMuted] = useState(() => {
    const saved = initialSavedState;
    return !!saved?.outputMuted;
  });
  const [isPreviewMuted, setIsPreviewMuted] = useState(true);
  const [seekCommand, setSeekCommand] = useState<number | null>(() => {
    const saved = initialSavedState;
    return typeof saved?.seekCommand === 'number' ? saved.seekCommand : null;
  });
  const [seekAmount, setSeekAmount] = useState<number>(() => {
    const saved = initialSavedState;
    return typeof saved?.seekAmount === 'number' ? saved.seekAmount : 0;
  });

  // --- AUDIO SOUNDTRACK STATE ---
  const [currentTrack, setCurrentTrack] = useState<GospelTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSlideRef = useRef<HTMLDivElement>(null);
  const antiSleepAudioRef = useRef<HTMLAudioElement>(null);
  const hasInitializedRemoteSnapshotRef = useRef(false);
  const hasHydratedCloudStateRef = useRef(false);
  const hasHydratedServerSnapshotRef = useRef(false);
  const workspaceSettingsUpdatedAtRef = useRef<number>(0);
  const hasLoadedInitialSettingsRef = useRef(false);
  const lastRemoteCommandAtRef = useRef<number | null>(null);
  const lastServerRemoteCommandAtRef = useRef<number | null>(null);
  const lastCueAutoAdvanceKeyRef = useRef<string>('');
  const lastSyncErrorRef = useRef<{ key: string; at: number } | null>(null);
  const syncFailureStreakRef = useRef(0);
  const syncBackoffUntilRef = useRef(0);
  const historyRef = useRef<Array<{ schedule: ServiceItem[]; selectedItemId: string; at: number }>>([]);
  const [historyCount, setHistoryCount] = useState(0);
  type RemoteCommand = 'NEXT' | 'PREV' | 'BLACKOUT' | 'PLAY' | 'PAUSE' | 'STOP' | 'MUTE' | 'UNMUTE';
  const isRemoteCommand = (command: unknown): command is RemoteCommand =>
    command === 'NEXT'
    || command === 'PREV'
    || command === 'BLACKOUT'
    || command === 'PLAY'
    || command === 'PAUSE'
    || command === 'STOP'
    || command === 'MUTE'
    || command === 'UNMUTE';
  const isRecord = (value: unknown): value is Record<string, any> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  const cloudPlaylistId = useMemo(() => (
    user?.uid ? buildCloudPlaylistId(user.uid) : ''
  ), [user?.uid]);

  const reportSyncFailure = useCallback((source: string, error: unknown, meta: Record<string, any> = {}) => {
    const message = error instanceof Error ? error.message : String(error || 'Unknown sync failure');
    const key = `${source}:${message}`;
    const now = Date.now();
    const last = lastSyncErrorRef.current;
    if (last && last.key === key && now - last.at < 8000) return;
    lastSyncErrorRef.current = { key, at: now };
    setSyncIssue(`${source}: ${message}`);
    logActivity(user?.uid, 'ERROR', {
      type: 'LIVE_SYNC_FAILURE',
      source,
      message,
      sessionId: liveSessionId,
      ...meta,
    });
  }, [user?.uid, liveSessionId]);

  const computeSyncBackoffMs = useCallback((failureStreak: number) => {
    return Math.min(SYNC_BACKOFF_MAX_MS, SYNC_BACKOFF_BASE_MS * (2 ** Math.max(0, failureStreak - 1)));
  }, []);

  const buildSyncPausedMessage = useCallback((seconds: number) => {
    return `Live sync paused for ${seconds}s (permissions). Presenter continues locally.`;
  }, []);

  const resetSyncBackoff = useCallback(() => {
    syncFailureStreakRef.current = 0;
    syncBackoffUntilRef.current = 0;
  }, []);

  const applySyncBackoff = useCallback((source: 'live-update' | 'flush') => {
    syncFailureStreakRef.current += 1;
    const streak = syncFailureStreakRef.current;
    const backoffMs = computeSyncBackoffMs(streak);
    const retryAt = Date.now() + backoffMs;
    syncBackoffUntilRef.current = retryAt;
    const seconds = Math.max(1, Math.ceil(backoffMs / 1000));
    reportSyncFailure('live-sync-backoff', new Error('Firestore write denied for live session'), {
      source,
      streak,
      backoffMs,
      retryAt,
    });
    setSyncIssue(buildSyncPausedMessage(seconds));
  }, [buildSyncPausedMessage, computeSyncBackoffMs, reportSyncFailure]);

  const enqueueLiveState = useCallback((payload: any) => {
    try {
      const existing = parseJson<any[]>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      const next = [...existing, { sessionId: liveSessionId, payload, at: Date.now() }].slice(-MAX_LIVE_QUEUE_SIZE);
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(next));
      setSyncPendingCount(next.length);
    } catch (error) {
      console.warn('Failed to queue live state', error);
      reportSyncFailure('queue', error, { queueOp: 'enqueue' });
    }
  }, [liveSessionId, reportSyncFailure]);

  const flushLiveStateQueue = useCallback(async () => {
    if (!navigator.onLine) return;
    const now = Date.now();
    if (syncBackoffUntilRef.current > now) {
      const remainingSeconds = Math.max(1, Math.ceil((syncBackoffUntilRef.current - now) / 1000));
      setSyncIssue(buildSyncPausedMessage(remainingSeconds));
      return;
    }
    try {
      const queued = parseJson<Array<{ sessionId: string; payload: any; at: number }>>(localStorage.getItem(LIVE_STATE_QUEUE_KEY), []);
      if (!queued.length) {
        setSyncPendingCount(0);
        return;
      }
      const failed: typeof queued = [];
      for (let idx = 0; idx < queued.length; idx += 1) {
        const entry = queued[idx];
        const [firebaseOk, serverOk] = await Promise.all([
          updateLiveState(entry.payload, entry.sessionId || liveSessionId),
          saveServerSessionState(workspaceId, entry.sessionId || liveSessionId, user, entry.payload).then((response) => !!response?.ok),
        ]);
        if (!firebaseOk && !serverOk) {
          failed.push(...queued.slice(idx));
          applySyncBackoff('flush');
          break;
        }
      }
      localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(failed));
      setSyncPendingCount(failed.length);
      if (!failed.length) {
        resetSyncBackoff();
        setSyncIssue(null);
      }
    } catch (error) {
      console.warn('Failed to flush queued live state', error);
      reportSyncFailure('flush', error, { queueOp: 'flush' });
    }
  }, [liveSessionId, workspaceId, user, reportSyncFailure, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage]);

  const syncLiveState = useCallback(async (payload: any) => {
    if (!user?.uid) return;
    if (!navigator.onLine) {
      enqueueLiveState(payload);
      return;
    }
    const now = Date.now();
    if (syncBackoffUntilRef.current > now) {
      const remainingSeconds = Math.max(1, Math.ceil((syncBackoffUntilRef.current - now) / 1000));
      setSyncIssue(buildSyncPausedMessage(remainingSeconds));
      return;
    }
    const [firebaseOk, serverOk] = await Promise.all([
      isFirebaseConfigured() ? updateLiveState(payload, liveSessionId) : Promise.resolve(false),
      saveServerSessionState(workspaceId, liveSessionId, user, payload).then((response) => !!response?.ok),
    ]);
    if (!firebaseOk && !serverOk) {
      applySyncBackoff('live-update');
      enqueueLiveState(payload);
    } else {
      resetSyncBackoff();
      if (!firebaseOk && serverOk) {
        setSyncIssue('Firebase sync denied; server sync active.');
      } else {
        setSyncIssue(null);
      }
    }
  }, [user?.uid, user, workspaceId, liveSessionId, enqueueLiveState, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage]);

  const refreshRunSheetFiles = useCallback(async () => {
    if (!workspaceId) {
      setRunSheetFiles([]);
      return;
    }
    setRunSheetFilesLoading(true);
    setRunSheetFilesError(null);
    try {
      const response = user?.uid ? await fetchRunSheetFiles(workspaceId, user) : null;
      if (response?.ok && Array.isArray(response.files)) {
        const next = response.files as RunSheetFileRecord[];
        setRunSheetFiles(next);
        writeLocalRunSheetFiles(workspaceId, next);
      } else {
        const localFiles = readLocalRunSheetFiles(workspaceId);
        setRunSheetFiles(localFiles);
        if (!localFiles.length && user?.uid) {
          setRunSheetFilesError(`Archive API unavailable at ${getServerApiBaseUrl()} (server offline or auth missing). Using local backup.`);
        }
      }
    } catch (error) {
      const localFiles = readLocalRunSheetFiles(workspaceId);
      setRunSheetFiles(localFiles);
      setRunSheetFilesError(localFiles.length
        ? `Loaded local archive backup (API unavailable at ${getServerApiBaseUrl()}).`
        : `Unable to load archived run sheets from ${getServerApiBaseUrl()}. Start/restart API server.`);
      reportSyncFailure('runsheet-files-list', error);
    } finally {
      setRunSheetFilesLoading(false);
    }
  }, [workspaceId, user, user?.uid, reportSyncFailure]);

  useEffect(() => {
    refreshRunSheetFiles();
  }, [refreshRunSheetFiles]);

  // --- SESSION PERSISTENCE LOGIC ---
  useEffect(() => {
    if (isFirebaseConfigured() && auth) {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
        // Auto-enter workspace if authenticated, but stay in audience if scanning
        if (u) {
          setViewState(prev => prev === 'audience' ? 'audience' : 'studio');
        } else {
          // Skip landing page in Electron
          // @ts-ignore
          if (window.electron?.isElectron) {
            setViewState(prev => prev === 'audience' ? 'audience' : 'studio');
          } else {
            setViewState(prev => prev === 'audience' ? 'audience' : 'landing');
          }
        }
      });
      return () => unsub();
    }

    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      hasHydratedCloudStateRef.current = true;
      setCloudBootstrapComplete(true);
      return;
    }
    if (!user?.uid) {
      hasHydratedCloudStateRef.current = false;
      setCloudBootstrapComplete(false);
      return;
    }
    hasHydratedCloudStateRef.current = false;
    setCloudBootstrapComplete(false);
  }, [user?.uid]);

  useEffect(() => {
    resetSyncBackoff();
    hasHydratedServerSnapshotRef.current = false;
    lastServerRemoteCommandAtRef.current = null;
  }, [user?.uid, liveSessionId, resetSyncBackoff]);


  useEffect(() => {
    // 1. First, try to load from local cache for instant UI
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = sanitizeWorkspaceSettings(JSON.parse(savedSettings));
        setWorkspaceSettings((prev) => ({ ...prev, ...parsed }));
      }
      const savedUpdatedAt = Number(localStorage.getItem(SETTINGS_UPDATED_AT_KEY) || '0');
      workspaceSettingsUpdatedAtRef.current = Number.isFinite(savedUpdatedAt) ? savedUpdatedAt : 0;
    } catch (error) {
      console.warn('Failed to load local workspace settings', error);
    } finally {
      // Local settings bootstrap is complete (even if cache is empty/corrupt).
      hasLoadedInitialSettingsRef.current = true;
      isSettingsHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    try {
      const scopedSettings = localStorage.getItem(getWorkspaceSettingsKey(workspaceId));
      if (scopedSettings) {
        const parsed = sanitizeWorkspaceSettings(JSON.parse(scopedSettings));
        setWorkspaceSettings((prev) => ({ ...prev, ...parsed }));
      }
      const scopedUpdatedAt = Number(localStorage.getItem(getWorkspaceSettingsUpdatedAtKey(workspaceId)) || '0');
      if (Number.isFinite(scopedUpdatedAt) && scopedUpdatedAt > workspaceSettingsUpdatedAtRef.current) {
        workspaceSettingsUpdatedAtRef.current = scopedUpdatedAt;
      }
    } catch (error) {
      console.warn('Failed to load workspace-scoped settings cache', error);
    }
  }, [workspaceId]);

  // 2. Load from server on login.
  // Only apply server settings when server payload is at least as fresh as local cache.
  useEffect(() => {
    if (!user || !workspaceId) return;

    const loadRemoteSettings = async () => {
      try {
        const res = await fetchWorkspaceSettings(workspaceId, user);
        if (res?.ok && res.settings) {
          const serverSettings = sanitizeWorkspaceSettings(res.settings);
          const serverUpdatedAt = Number(res.updatedAt || 0);
          const localUpdatedAt = workspaceSettingsUpdatedAtRef.current;
          const serverIsFresherOrEqual = serverUpdatedAt >= localUpdatedAt;

          if (!serverIsFresherOrEqual) {
            isSettingsHydratedRef.current = true;
            return;
          }

          setWorkspaceSettings((prev) => {
            const merged = { ...prev, ...serverSettings };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
            localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(serverUpdatedAt || Date.now()));
            localStorage.setItem(getWorkspaceSettingsKey(workspaceId), JSON.stringify(merged));
            localStorage.setItem(getWorkspaceSettingsUpdatedAtKey(workspaceId), String(serverUpdatedAt || Date.now()));
            workspaceSettingsUpdatedAtRef.current = serverUpdatedAt || Date.now();
            isSettingsHydratedRef.current = true;
            return merged;
          });
        } else {
          isSettingsHydratedRef.current = true;
        }
      } catch (err) {
        console.warn('Failed to load remote settings', err);
        // Keep local values if server read fails.
        isSettingsHydratedRef.current = true;
      }
    };
    loadRemoteSettings();
  }, [user, workspaceId]);

  useEffect(() => {
    document.documentElement.dataset.theme = workspaceSettings.theme;
    if (!hasLoadedInitialSettingsRef.current) return;

    const updatedAt = Date.now();
    // Only save to server if we're authenticated and it's a "fresh" change 
    // (not just hydrating from server)
    const PERSIST_THRESHOLD = 2000;
    const isRecentServerLoad = (updatedAt - workspaceSettingsUpdatedAtRef.current) < PERSIST_THRESHOLD;

    const persistSettings = async () => {
      // 1. Save to local first for speed
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(workspaceSettings));
        localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(updatedAt));
        localStorage.setItem(getWorkspaceSettingsKey(workspaceId), JSON.stringify(workspaceSettings));
        localStorage.setItem(getWorkspaceSettingsUpdatedAtKey(workspaceId), String(updatedAt));
      } catch (e) {
        setSaveError(true);
      }

      // 2. Save to server if logged in and settings are hydrated (never wipe with defaults)
      if (user?.uid && !isRecentServerLoad && isSettingsHydratedRef.current) {
        try {
          const result = await saveWorkspaceSettings(workspaceId, user, workspaceSettings);
          if (result?.ok) {
            const remoteUpdatedAt = Number(result.updatedAt || updatedAt);
            workspaceSettingsUpdatedAtRef.current = remoteUpdatedAt;
            try {
              localStorage.setItem(getWorkspaceSettingsUpdatedAtKey(workspaceId), String(remoteUpdatedAt));
              localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(remoteUpdatedAt));
            } catch {
              // ignore local metadata write error
            }
            setSyncIssue((prev) => (prev && prev.startsWith('Settings sync failed') ? null : prev));
          } else {
            const reason = extractApiFailureMessage(result, `Settings sync failed at ${getServerApiBaseUrl()}`);
            setSyncIssue(`${reason} (local values preserved).`);
          }
        } catch (err) {
          console.warn('Server settings sync failed', err);
          setSyncIssue('Settings sync failed (local values preserved). Retry by clicking Synchronize Workspace.');
        }
      }
    };

    persistSettings();
  }, [workspaceSettings, user, workspaceId]);

  useEffect(() => {
    if (!user?.uid || hasHydratedServerSnapshotRef.current) return;
    hasHydratedServerSnapshotRef.current = true;

    (async () => {
      const response = await loadLatestWorkspaceSnapshot(workspaceId, user);
      const snapshot = response?.snapshot;
      if (!snapshot?.payload) return;

      const localUpdatedAt = typeof initialSavedStateRef.current?.updatedAt === 'number'
        ? initialSavedStateRef.current.updatedAt
        : 0;
      if (localUpdatedAt > snapshot.updatedAt) return;

      const payload = snapshot.payload;
      if (Array.isArray(payload.schedule) && payload.schedule.length > 0) {
        setSchedule(payload.schedule);
      }
      if (typeof payload.selectedItemId === 'string') {
        setSelectedItemId(payload.selectedItemId);
      }
      if (typeof payload.activeItemId === 'string') {
        setActiveItemId(payload.activeItemId);
      } else {
        setActiveItemId(null);
      }
      if (typeof payload.activeSlideIndex === 'number') {
        setActiveSlideIndex(payload.activeSlideIndex);
      }
      if (payload.audienceQrProjection && typeof payload.audienceQrProjection === 'object') {
        const incomingQrProjection = sanitizeAudienceQrProjectionState(payload.audienceQrProjection);
        setAudienceQrProjection((prev) => (
          incomingQrProjection.updatedAt >= (prev.updatedAt || 0)
            ? incomingQrProjection
            : prev
        ));
      }
      if (payload.stageMessageCenter && typeof payload.stageMessageCenter === 'object') {
        const incomingCenter = sanitizeStageMessageCenterState(payload.stageMessageCenter);
        if (incomingCenter.queue.length || incomingCenter.activeMessageId || incomingCenter.lastSentAt) {
          setStageMessageCenter(incomingCenter);
        }
      } else if (payload.stageAlert && typeof payload.stageAlert === 'object') {
        const legacy = stageMessageFromLegacyAlert(sanitizeStageAlertState(payload.stageAlert));
        if (legacy) {
          setStageMessageCenter({
            queue: [legacy],
            activeMessageId: legacy.id,
            lastSentAt: legacy.createdAt,
          });
        }
      }
      if (payload.workspaceSettings && typeof payload.workspaceSettings === 'object') {
        const snapshotSettingsUpdatedAt = typeof payload.workspaceSettingsUpdatedAt === 'number'
          ? payload.workspaceSettingsUpdatedAt
          : 0;
        const localSettingsUpdatedAt = workspaceSettingsUpdatedAtRef.current;
        if (snapshotSettingsUpdatedAt && snapshotSettingsUpdatedAt >= localSettingsUpdatedAt) {
          const snapshotSettings = sanitizeWorkspaceSettings(payload.workspaceSettings);
          if (Object.keys(snapshotSettings).length > 0) {
            workspaceSettingsUpdatedAtRef.current = snapshotSettingsUpdatedAt;
            setWorkspaceSettings((prev) => ({ ...prev, ...snapshotSettings }));
          }
        }
      }
    })();
  }, [workspaceId, user?.uid, user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LIVE_STATE_QUEUE_KEY);
      const queued = raw ? JSON.parse(raw) : [];
      if (Array.isArray(queued)) {
        const trimmed = queued.slice(-MAX_LIVE_QUEUE_SIZE);
        if (trimmed.length !== queued.length) {
          localStorage.setItem(LIVE_STATE_QUEUE_KEY, JSON.stringify(trimmed));
        }
        setSyncPendingCount(trimmed.length);
      } else {
        setSyncPendingCount(0);
      }
    } catch {
      setSyncPendingCount(0);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      flushLiveStateQueue();
    };
    window.addEventListener('online', onOnline);
    flushLiveStateQueue();
    return () => window.removeEventListener('online', onOnline);
  }, [flushLiveStateQueue]);

  useEffect(() => {
    const cleanup = () => clearMediaCache();
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && antiSleepAudioRef.current) {
      antiSleepAudioRef.current.play().catch(e => console.log("Anti-sleep audio needs interaction", e));
    } else if (antiSleepAudioRef.current) {
      antiSleepAudioRef.current.pause();
    }
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && activeSidebarTab !== 'SCHEDULE') {
      setActiveSidebarTab('SCHEDULE');
    }
  }, [viewMode, activeSidebarTab]);

  // --- AUDIO PLAYER EFFECT ---
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsAudioPlaying(false);
      setAudioProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  const handlePlayTrack = (track: GospelTrack) => {
    if (audioRef.current) {
      if (currentTrack?.id === track.id) {
        toggleAudio();
      } else {
        audioRef.current.src = track.url;
        audioRef.current.play().catch(e => console.error("Audio playback error", e));
        setCurrentTrack(track);
        setIsAudioPlaying(true);
        logActivity(user?.uid, 'ERROR', { type: 'AUDIO_PLAY', track: track.title });
      }
    }
  };

  const toggleAudio = () => {
    if (audioRef.current && currentTrack) {
      if (isAudioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsAudioPlaying(!isAudioPlaying);
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsAudioPlaying(false);
      setAudioProgress(0);
      setCurrentTrack(null);
    }
  };

  const handleLoginSuccess = (loggedInUser: any) => {
    setUser(loggedInUser);
    if (!isFirebaseConfigured()) {
      localStorage.setItem('lumina_demo_user', JSON.stringify(loggedInUser));
    }
    logActivity(loggedInUser.uid, 'SESSION_START');
    setViewState('studio'); // Transition to app
  };

  const handleLogout = () => {
    if (user) logActivity(user.uid, 'SESSION_END');
    if (isFirebaseConfigured() && auth) auth.signOut();
    else localStorage.removeItem('lumina_demo_user');
    setUser(null);
    setViewState(isElectronShell ? 'studio' : 'landing');
  };

  useEffect(() => {
    if (!user) return;
    const id = window.setTimeout(() => {
      const saveData = {
        schedule,
        selectedItemId,
        viewMode,
        activeItemId,
        activeSlideIndex,
        blackout,
        isPlaying,
        outputMuted,
        seekCommand,
        seekAmount,
        lowerThirdsEnabled,
        routingMode,
        timerMode,
        timerDurationMin,
        timerSeconds,
        currentCueItemId,
        audienceDisplay,
        audienceQrProjection,
        stageAlert,
        stageMessageCenter,
        workspaceSettings,
        updatedAt: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
        setSaveError(false);
      } catch (e: any) {
        if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') setSaveError(true);
      }
    }, 180);
    return () => window.clearTimeout(id);
  }, [schedule, selectedItemId, viewMode, activeItemId, activeSlideIndex, blackout, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, routingMode, timerMode, timerDurationMin, timerSeconds, currentCueItemId, audienceDisplay, audienceQrProjection, stageAlert, stageMessageCenter, workspaceSettings, user]);



  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    const updatedAt = Date.now();
    const settingsUpdatedAt = workspaceSettingsUpdatedAtRef.current || updatedAt;
    syncLiveState({
      scheduleSnapshot: schedule,
      workspaceSettings,
      workspaceSettingsUpdatedAt: settingsUpdatedAt,
      audienceQrProjection,
      stageMessageCenter,
      stageAlert: legacyAlertFromMessageCenter(stageMessageCenter),
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
    (async () => {
      try {
        await upsertTeamPlaylist(user.uid, cloudPlaylistId, {
          title: 'Default Playlist',
          items: schedule,
          selectedItemId,
          activeItemId,
          activeSlideIndex,
          workspaceSettings,
          workspaceSettingsUpdatedAt: settingsUpdatedAt,
          audienceQrProjection,
          stageMessageCenter,
          updatedAt,
        });
        await saveWorkspaceSnapshot(workspaceId, user, {
          schedule,
          selectedItemId,
          activeItemId,
          activeSlideIndex,
          workspaceSettings,
          workspaceSettingsUpdatedAt: settingsUpdatedAt,
          audienceQrProjection,
          stageMessageCenter,
          updatedAt,
        });
      } catch (error) {
        reportSyncFailure('playlist-upsert', error, { itemCount: schedule.length });
      }
    })();
  }, [
    schedule,
    selectedItemId,
    activeItemId,
    activeSlideIndex,
    workspaceSettings,
    audienceQrProjection,
    stageMessageCenter,
    user?.uid,
    user?.email,
    allowedAdminEmails,
    syncLiveState,
    reportSyncFailure,
    cloudBootstrapComplete,
    cloudPlaylistId,
    workspaceId,
    user,
  ]);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && activeSlideRef.current) {
      activeSlideRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeSlideIndex, activeItemId, viewMode]);

  const hasSavedSession = (() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  const selectedItem = schedule.find(i => i.id === selectedItemId) || null;
  const activeItem = schedule.find(i => i.id === activeItemId) || null;
  const activeSlide = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex] : null;
  const previewLowerThirds = lowerThirdsEnabled && routingMode !== 'PROJECTOR';
  const nextSlidePreview = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex + 1] || null : null;
  const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
  const activeBackgroundUrl = (activeSlide?.backgroundUrl || activeItem?.theme?.backgroundUrl || '').trim();
  const isActiveVideo = !!activeSlide && (
    activeSlide.mediaType === 'video'
    || (!activeSlide.mediaType && activeItem?.theme.mediaType === 'video')
    || looksLikeVideoUrl(activeBackgroundUrl)
  );
  const enabledTimerCues = useMemo(() => {
    return schedule
      .map((item, idx) => {
        const cue = item.timerCue;
        if (!cue?.enabled) return null;
        const durationSec = Number.isFinite(cue.durationSec) ? Math.max(1, Math.round(cue.durationSec)) : 300;
        const amberPercent = Number.isFinite(cue.amberPercent) ? clamp(Number(cue.amberPercent), 1, 99) : 25;
        const redPercent = Number.isFinite(cue.redPercent) ? clamp(Number(cue.redPercent), 1, 99) : 10;
        return {
          itemId: item.id,
          itemTitle: item.title,
          scheduleIndex: idx,
          cue: {
            enabled: true,
            durationSec,
            speakerName: typeof cue.speakerName === 'string' ? cue.speakerName : '',
            autoStartNext: !!cue.autoStartNext,
            amberPercent,
            redPercent,
          },
        };
      })
      .filter((entry): entry is {
        itemId: string;
        itemTitle: string;
        scheduleIndex: number;
        cue: {
          enabled: true;
          durationSec: number;
          speakerName: string;
          autoStartNext: boolean;
          amberPercent: number;
          redPercent: number;
        };
      } => !!entry);
  }, [schedule]);
  useEffect(() => {
    if (!enabledTimerCues.length) {
      if (currentCueItemId !== null) setCurrentCueItemId(null);
      return;
    }
    if (currentCueItemId && enabledTimerCues.some((entry) => entry.itemId === currentCueItemId)) return;
    const preferredId = activeItemId && enabledTimerCues.some((entry) => entry.itemId === activeItemId)
      ? activeItemId
      : enabledTimerCues[0].itemId;
    setCurrentCueItemId(preferredId);
  }, [enabledTimerCues, currentCueItemId, activeItemId]);
  const currentCueIndex = enabledTimerCues.findIndex((entry) => entry.itemId === currentCueItemId);
  const currentCue = currentCueIndex >= 0 ? enabledTimerCues[currentCueIndex] : null;
  const currentCueDurationSec = currentCue?.cue.durationSec || (timerDurationMin * 60);
  const currentCueSpeaker = (currentCue?.cue.speakerName || '').trim();
  const currentCueAmberPercent = currentCue?.cue.amberPercent || 25;
  const currentCueRedPercent = currentCue?.cue.redPercent || 10;
  const effectiveTimerDurationSec = timerMode === 'COUNTDOWN' ? currentCueDurationSec : Math.max(1, timerDurationMin * 60);
  const applyManualCountdownMinutes = (nextMinutesRaw: number) => {
    const nextMinutes = Math.max(1, Math.min(180, Number(nextMinutesRaw) || 1));
    const nextDurationSec = nextMinutes * 60;
    setTimerDurationMin(nextMinutes);
    setCueZeroHold(false);
    if (currentCueItemId) {
      setSchedule((prev) => prev.map((item) => {
        if (item.id !== currentCueItemId) return item;
        const existingCue = item.timerCue || {
          enabled: true,
          durationSec: nextDurationSec,
          speakerName: '',
          autoStartNext: false,
          amberPercent: 25,
          redPercent: 10,
        };
        return {
          ...item,
          timerCue: {
            ...existingCue,
            enabled: existingCue.enabled ?? true,
            durationSec: nextDurationSec,
          },
        };
      }));
    }
    if (!timerRunning) {
      setTimerSeconds(nextDurationSec);
    }
  };
  const formatTimer = (total: number) => {
    const negative = total < 0;
    const abs = Math.abs(total);
    const mm = Math.floor(abs / 60).toString().padStart(2, '0');
    const ss = Math.floor(abs % 60).toString().padStart(2, '0');
    return `${negative ? '-' : ''}${mm}:${ss}`;
  };
  const isTimerOvertime = timerMode === 'COUNTDOWN' && (timerSeconds < 0 || cueZeroHold);
  const getShareBaseOrigin = () => {
    if (typeof window === 'undefined') return PUBLIC_WEB_APP_ORIGIN;
    const origin = window.location.origin || '';
    if (/^https?:\/\//i.test(origin)) return origin;
    return PUBLIC_WEB_APP_ORIGIN;
  };
  const buildSharedRouteUrl = (route: 'output' | 'remote' | 'stage') => {
    const base = getShareBaseOrigin();
    const root = base ? `${base}/#/${route}` : `/#/${route}`;
    const params = new URLSearchParams({
      session: liveSessionId,
      workspace: workspaceId,
    });

    if (route === 'output') {
      params.set('api', getServerApiBaseUrl());
      params.set('fullscreen', '1');
    } else if (route === 'stage') {
      params.set('api', getServerApiBaseUrl());
    }

    return `${root}?${params.toString()}`;
  };
  const obsOutputUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('output')
    : `/#/output?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1`;
  const remoteControlUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('remote')
    : `/#/remote?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}`;
  const stageDisplayUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('stage')
    : `/#/stage?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}`;
  const copyShareUrl = useCallback(async (url: string, successMessage?: string) => {
    const copied = await copyTextToClipboard(url);
    if (!copied) {
      alert('Copy failed. Try again or use Ctrl+C manually.');
      return;
    }
    if (successMessage) {
      alert(successMessage);
    }
  }, []);

  const audienceUrl = useMemo(() => {
    return `${getShareBaseOrigin()}/#/audience?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&api=${encodeURIComponent(getServerApiBaseUrl())}`;
  }, [liveSessionId, workspaceId]);

  const resolveAetherSceneName = useCallback((target: 'program' | 'blackout' | 'lobby') => {
    const byTarget = {
      program: (workspaceSettings.aetherSceneProgram || '').trim() || 'Program',
      blackout: (workspaceSettings.aetherSceneBlackout || '').trim() || 'Blackout',
      lobby: (workspaceSettings.aetherSceneLobby || '').trim() || 'Lobby',
    };
    return byTarget[target];
  }, [workspaceSettings.aetherSceneProgram, workspaceSettings.aetherSceneBlackout, workspaceSettings.aetherSceneLobby]);

  const resolveCurrentAetherSceneTarget = useCallback((): 'program' | 'blackout' | 'lobby' => {
    if (blackout) return 'blackout';
    if (routingMode === 'LOBBY') return 'lobby';
    return 'program';
  }, [blackout, routingMode]);

  const buildAetherStatePayload = useCallback((origin: 'auto' | 'manual') => {
    const activeSlideContent = String(activeSlide?.content || '').replace(/\s+/g, ' ').trim();
    const activeSlidePreview = activeSlideContent.length > 220
      ? `${activeSlideContent.slice(0, 217)}...`
      : activeSlideContent;
    const activeStageMessage = stageMessageCenter.queue.find((entry) => entry.id === stageMessageCenter.activeMessageId) || null;
    const sceneTarget = resolveCurrentAetherSceneTarget();
    return {
      origin,
      sceneTarget,
      sceneName: resolveAetherSceneName(sceneTarget),
      runtime: {
        blackout,
        routingMode,
        isPlaying,
        outputMuted,
        lowerThirdsEnabled,
      },
      session: {
        workspaceId,
        sessionId: liveSessionId,
      },
      activeItem: activeItem
        ? {
          id: activeItem.id,
          title: activeItem.title,
          type: activeItem.type,
        }
        : null,
      activeSlide: activeSlide
        ? {
          index: activeSlideIndex,
          label: String(activeSlide.label || `Slide ${activeSlideIndex + 1}`),
          preview: activeSlidePreview,
        }
        : null,
      stage: {
        timerMode,
        timerSeconds,
        timerDurationSec: effectiveTimerDurationSec,
        speaker: currentCueSpeaker,
        activeMessage: activeStageMessage
          ? {
            id: activeStageMessage.id,
            category: activeStageMessage.category,
            text: activeStageMessage.text,
            priority: activeStageMessage.priority,
          }
          : null,
      },
      audience: {
        qrProjected: !!audienceQrProjection.visible,
      },
      urls: {
        output: obsOutputUrl,
        stage: stageDisplayUrl,
        remote: remoteControlUrl,
      },
      sentAt: Date.now(),
    };
  }, [
    activeItem,
    activeSlide,
    activeSlideIndex,
    audienceQrProjection.visible,
    blackout,
    currentCueSpeaker,
    effectiveTimerDurationSec,
    isPlaying,
    liveSessionId,
    lowerThirdsEnabled,
    obsOutputUrl,
    outputMuted,
    remoteControlUrl,
    resolveAetherSceneName,
    resolveCurrentAetherSceneTarget,
    routingMode,
    stageDisplayUrl,
    stageMessageCenter.activeMessageId,
    stageMessageCenter.queue,
    timerMode,
    timerSeconds,
    workspaceId,
  ]);

  const dispatchAetherEvent = useCallback(async (
    event: 'lumina.bridge.ping' | 'lumina.state.sync' | 'lumina.scene.switch',
    payload: Record<string, unknown>,
    options?: { timeoutMs?: number; successLabel?: string; failureLabel?: string }
  ) => {
    const endpointUrl = String(workspaceSettings.aetherBridgeUrl || '').trim();
    if (!endpointUrl) {
      setAetherBridgeStatus({
        tone: 'error',
        text: 'Set Aether bridge URL first.',
      });
      return { ok: false };
    }
    const result = await dispatchAetherBridgeEvent({
      endpointUrl,
      accessToken: String(aetherBridgeToken || '').trim() || undefined,
      event,
      workspaceId,
      sessionId: liveSessionId,
      payload,
      timeoutMs: options?.timeoutMs,
    });
    if (result.ok) {
      const label = options?.successLabel || `${event} accepted`;
      setAetherBridgeStatus({
        tone: 'ok',
        text: `${label} (${result.durationMs}ms).`,
      });
    } else {
      const label = options?.failureLabel || `${event} failed`;
      setAetherBridgeStatus({
        tone: 'error',
        text: `${label}: ${result.message || result.error || 'unknown error'}`,
      });
    }
    return result;
  }, [aetherBridgeToken, liveSessionId, workspaceId, workspaceSettings.aetherBridgeUrl]);

  const handleAetherBridgeTest = useCallback(async () => {
    await dispatchAetherEvent(
      'lumina.bridge.ping',
      {
        app: 'lumina-presenter',
        mode: viewMode,
        workspaceId,
        sessionId: liveSessionId,
      },
      {
        timeoutMs: 4000,
        successLabel: 'Bridge ping succeeded',
        failureLabel: 'Bridge ping failed',
      }
    );
  }, [dispatchAetherEvent, liveSessionId, viewMode, workspaceId]);

  const handleAetherBridgeSyncNow = useCallback(async () => {
    await dispatchAetherEvent(
      'lumina.state.sync',
      buildAetherStatePayload('manual'),
      {
        timeoutMs: 5000,
        successLabel: 'State sync sent',
        failureLabel: 'State sync failed',
      }
    );
  }, [buildAetherStatePayload, dispatchAetherEvent]);

  const handleAetherSceneSwitch = useCallback(async (target: 'program' | 'blackout' | 'lobby') => {
    await dispatchAetherEvent(
      'lumina.scene.switch',
      {
        target,
        sceneName: resolveAetherSceneName(target),
        workspaceId,
        sessionId: liveSessionId,
      },
      {
        timeoutMs: 4500,
        successLabel: `${resolveAetherSceneName(target)} scene command sent`,
        failureLabel: `${resolveAetherSceneName(target)} scene command failed`,
      }
    );
  }, [dispatchAetherEvent, liveSessionId, resolveAetherSceneName, workspaceId]);

  useEffect(() => {
    if (viewState !== 'studio') return;
    if (!workspaceSettings.aetherBridgeEnabled) return;
    if (!workspaceSettings.aetherBridgeAutoSync) return;
    if (!String(workspaceSettings.aetherBridgeUrl || '').trim()) return;

    const syncFingerprint = JSON.stringify({
      activeItemId,
      activeSlideIndex,
      blackout,
      routingMode,
      isPlaying,
      outputMuted,
      timerMode,
      timerSeconds,
      activeStageMessageId: stageMessageCenter.activeMessageId,
      stageMessageAt: stageMessageCenter.lastSentAt,
      qrProjected: audienceQrProjection.visible,
    });
    if (lastAetherAutoSyncKeyRef.current === syncFingerprint) return;
    lastAetherAutoSyncKeyRef.current = syncFingerprint;

    if (aetherBridgeAutoSyncTimerRef.current) {
      window.clearTimeout(aetherBridgeAutoSyncTimerRef.current);
    }

    aetherBridgeAutoSyncTimerRef.current = window.setTimeout(() => {
      if (aetherBridgeInFlightRef.current) return;
      aetherBridgeInFlightRef.current = true;
      void dispatchAetherEvent(
        'lumina.state.sync',
        buildAetherStatePayload('auto'),
        {
          timeoutMs: 4500,
          successLabel: 'Auto sync sent',
          failureLabel: 'Auto sync failed',
        }
      ).finally(() => {
        aetherBridgeInFlightRef.current = false;
      });
    }, 280);

    return () => {
      if (aetherBridgeAutoSyncTimerRef.current) {
        window.clearTimeout(aetherBridgeAutoSyncTimerRef.current);
        aetherBridgeAutoSyncTimerRef.current = null;
      }
    };
  }, [
    activeItemId,
    activeSlideIndex,
    audienceQrProjection.visible,
    blackout,
    buildAetherStatePayload,
    dispatchAetherEvent,
    isPlaying,
    outputMuted,
    routingMode,
    stageMessageCenter.activeMessageId,
    stageMessageCenter.lastSentAt,
    timerMode,
    timerSeconds,
    viewState,
    workspaceSettings.aetherBridgeAutoSync,
    workspaceSettings.aetherBridgeEnabled,
    workspaceSettings.aetherBridgeUrl,
  ]);

  useEffect(() => {
    setAudienceQrProjection((prev) => {
      if (!prev.visible) return prev;
      if (prev.audienceUrl === audienceUrl) return prev;
      return {
        ...prev,
        audienceUrl,
        updatedAt: Date.now(),
      };
    });
  }, [audienceUrl]);

  const setAudienceQrProjectionVisible = useCallback((visible: boolean) => {
    setAudienceQrProjection((prev) => ({
      ...prev,
      visible,
      audienceUrl,
      updatedAt: Date.now(),
    }));
  }, [audienceUrl]);

  const setAudienceQrProjectionScale = useCallback((scale: number) => {
    setAudienceQrProjection((prev) => ({
      ...prev,
      scale: clamp(scale, 0.7, 2.2),
      audienceUrl,
      updatedAt: Date.now(),
    }));
  }, [audienceUrl]);

  const cloneSchedule = (value: ServiceItem[]) => JSON.parse(JSON.stringify(value)) as ServiceItem[];
  const pushHistory = () => {
    historyRef.current.push({
      schedule: cloneSchedule(schedule),
      selectedItemId,
      at: Date.now(),
    });
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    setHistoryCount(historyRef.current.length);
  };
  const rollbackLastChange = () => {
    const last = historyRef.current.pop();
    if (!last) return;
    setSchedule(last.schedule);
    setSelectedItemId(last.selectedItemId);
    setHistoryCount(historyRef.current.length);
  };

  const buildTemplate = (templateId: 'CLASSIC' | 'YOUTH' | 'PRAYER'): ServiceItem[] => {
    const now = Date.now();
    const baseTheme = {
      backgroundUrl: DEFAULT_BACKGROUNDS[0],
      mediaType: 'image' as const,
      fontFamily: 'sans-serif',
      textColor: '#ffffff',
      shadow: true,
      fontSize: 'large' as const,
    };
    if (templateId === 'CLASSIC') {
      return cloneSchedule(INITIAL_SCHEDULE).map((item, idx) => ({ ...item, id: `${now}-${idx}` }));
    }
    if (templateId === 'YOUTH') {
      return [
        {
          id: `${now}-1`,
          title: 'Countdown + Hype',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[9], fontSize: 'xlarge' },
          slides: [
            { id: `${now}-1a`, label: 'Start', content: 'Service starts in 05:00' },
            { id: `${now}-1b`, label: 'Welcome', content: 'Welcome to Youth Night' },
          ],
        },
        {
          id: `${now}-2`,
          title: 'Worship Set',
          type: ItemType.SONG,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[7], fontSize: 'large' },
          slides: [
            { id: `${now}-2a`, label: 'Verse 1', content: 'You are here, moving in our midst' },
            { id: `${now}-2b`, label: 'Chorus', content: 'Way maker, miracle worker' },
          ],
        },
        {
          id: `${now}-3`,
          title: 'Message + Call',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[2], fontSize: 'medium' },
          slides: [
            { id: `${now}-3a`, label: 'Main Point', content: 'Faith over fear' },
            { id: `${now}-3b`, label: 'Response', content: 'Prayer team available at the front' },
          ],
        },
      ];
    }
    return [
      {
        id: `${now}-p1`,
        title: 'Prayer + Reflection',
        type: ItemType.SCRIPTURE,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[5], fontFamily: 'serif', fontSize: 'medium' },
        slides: [
          { id: `${now}-p1a`, label: 'Reading', content: 'Psalm 23:1-3' },
          { id: `${now}-p1b`, label: 'Meditation', content: 'Be still and know that I am God.' },
        ],
      },
      {
        id: `${now}-p2`,
        title: 'Intercession',
        type: ItemType.ANNOUNCEMENT,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[10], fontSize: 'large' },
        slides: [
          { id: `${now}-p2a`, label: 'Prayer Focus', content: 'Families, healing, and community leaders' },
        ],
      },
    ];
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    window.luminaSmokeTest = () => {
      const results: SmokeTestResult[] = [];
      const templates: Array<'CLASSIC' | 'YOUTH' | 'PRAYER'> = ['CLASSIC', 'YOUTH', 'PRAYER'];
      templates.forEach((templateId) => {
        const built = buildTemplate(templateId);
        const ok = Array.isArray(built)
          && built.length > 0
          && built.every((item) => item && Array.isArray(item.slides) && item.slides.length > 0);
        results.push({
          name: `template:${templateId.toLowerCase()}`,
          ok,
          details: ok ? `items=${built.length}` : 'Template returned invalid item/slide structure',
        });
      });

      const cueOk = Number.isFinite(autoCueSeconds) && autoCueSeconds >= 2 && autoCueSeconds <= 120;
      results.push({
        name: 'cue:bounds',
        ok: cueOk,
        details: cueOk ? `autoCueSeconds=${autoCueSeconds}` : `Out of bounds: ${autoCueSeconds}`,
      });

      const samples: Array<unknown> = ['NEXT', 'PREV', 'BLACKOUT', 'PLAY', 'PAUSE', 'STOP', 'MUTE', 'UNMUTE', 'SKIP', null, 2];
      const marks = samples.map((sample) => isRemoteCommand(sample));
      const remoteGuardOk = marks[0] && marks[1] && marks[2] && marks[3] && marks[4] && marks[5] && marks[6] && marks[7] && !marks[8] && !marks[9] && !marks[10];
      results.push({
        name: 'remote:command-guard',
        ok: remoteGuardOk,
        details: `accepted=${samples.filter((_, idx) => marks[idx]).join(',') || 'none'}`,
      });

      return {
        ok: results.every((entry) => entry.ok),
        sessionId: liveSessionId,
        timestamp: new Date().toISOString(),
        results,
      };
    };

    return () => {
      delete window.luminaSmokeTest;
    };
  }, [autoCueSeconds, liveSessionId]);

  const applyTemplate = (templateId: 'CLASSIC' | 'YOUTH' | 'PRAYER') => {
    const template = buildTemplate(templateId);
    if (!template.length) return;
    historyRef.current.push({ schedule: cloneSchedule(schedule), selectedItemId, at: Date.now() });
    setHistoryCount(historyRef.current.length);
    setSchedule(template);
    setSelectedItemId(template[0].id);
    setActiveItemId(null);
    setActiveSlideIndex(-1);
    setIsTemplateOpen(false);
  };

  const getRunSheetLocalStorageKey = (workspace: string) => `${RUNSHEET_FILES_LOCAL_KEY_PREFIX}:${workspace || 'default-workspace'}`;

  const readLocalRunSheetFiles = (workspace: string): RunSheetFileRecord[] => {
    try {
      const key = getRunSheetLocalStorageKey(workspace);
      const parsed = parseJson<RunSheetFileRecord[]>(localStorage.getItem(key), []);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.fileId === 'string')
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    } catch {
      return [];
    }
  };

  const writeLocalRunSheetFiles = (workspace: string, files: RunSheetFileRecord[]) => {
    try {
      const key = getRunSheetLocalStorageKey(workspace);
      const normalized = [...files].sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      localStorage.setItem(key, JSON.stringify(normalized));
    } catch {
      // best effort local persistence
    }
  };

  const extractApiFailureMessage = (response: any, fallback: string) => {
    if (!response || typeof response !== 'object') return fallback;
    const status = Number(response.status || 0);
    const code = String(response.error || '').toUpperCase();
    if (status === 401 || code === 'AUTH_REQUIRED') {
      return `Archive API rejected auth for workspace "${workspaceId}". Sign in again, then retry.`;
    }
    if (status === 403 || code === 'FORBIDDEN') {
      return `Signed in, but API denied workspace write for "${workspaceId}". Check owner/admin allowlist.`;
    }
    if (status === 404) {
      return `Archive endpoint not found on API ${getServerApiBaseUrl()}. Deploy latest backend.`;
    }
    const message = String(response.message || '').trim();
    if (message) return `${fallback} (${message})`;
    return fallback;
  };

  const makeRunSheetFileId = () => `runsheet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const createLocalRunSheetFileRecord = (
    title: string,
    payload: { items: ServiceItem[]; selectedItemId?: string | null }
  ): RunSheetFileRecord => {
    const createdAt = Date.now();
    const safeTitle = String(title || '').trim() || `Run Sheet ${new Date(createdAt).toLocaleString()}`;
    const items = Array.isArray(payload.items) ? cloneSchedule(payload.items) : [];
    return {
      fileId: makeRunSheetFileId(),
      title: safeTitle,
      payload: {
        items,
        selectedItemId: typeof payload.selectedItemId === 'string' ? payload.selectedItemId : null,
      },
      createdByUid: String(user?.uid || '').trim() || null,
      createdByEmail: String(user?.email || '').trim() || null,
      createdAt,
      updatedAt: createdAt,
      lastUsedAt: null,
    };
  };

  const upsertRunSheetFileState = (file: RunSheetFileRecord) => {
    setRunSheetFiles((prev) => {
      const next = [file, ...prev.filter((entry) => entry.fileId !== file.fileId)];
      writeLocalRunSheetFiles(workspaceId, next);
      return next;
    });
  };

  const removeRunSheetFileState = (fileId: string) => {
    setRunSheetFiles((prev) => {
      const next = prev.filter((entry) => entry.fileId !== fileId);
      writeLocalRunSheetFiles(workspaceId, next);
      return next;
    });
  };

  const archiveRunSheetPayload = async (
    title: string,
    payload: { items: ServiceItem[]; selectedItemId?: string | null }
  ): Promise<{ ok: boolean; file?: RunSheetFileRecord; source: 'server' | 'local' | 'none'; reason?: string }> => {
    const safePayload = {
      items: Array.isArray(payload.items) ? cloneSchedule(payload.items) : [],
      selectedItemId: typeof payload.selectedItemId === 'string' ? payload.selectedItemId : null,
    };
    if (!safePayload.items.length) {
      return { ok: false, source: 'none' };
    }

    let apiFailureReason: string | undefined;
    try {
      if (user?.uid) {
        const response = await archiveRunSheetFile(workspaceId, user, { title, payload: safePayload });
        if (response?.ok && response.file) {
          const file = response.file as RunSheetFileRecord;
          upsertRunSheetFileState(file);
          return { ok: true, source: 'server', file };
        }
        if (response && !response.ok) {
          apiFailureReason = extractApiFailureMessage(response, `Archive API failed at ${getServerApiBaseUrl()}`);
        }
      }
    } catch (error) {
      reportSyncFailure('runsheet-archive-create', error, { title });
    }

    const localFile = createLocalRunSheetFileRecord(title, safePayload);
    upsertRunSheetFileState(localFile);
    return { ok: true, source: 'local', file: localFile, reason: apiFailureReason };
  };

  const applyIncomingRunSheetPayload = (
    payload: { items: ServiceItem[]; selectedItemId?: string | null },
    mode: 'replace' | 'duplicate'
  ) => {
    const incomingItems = Array.isArray(payload.items) ? cloneSchedule(payload.items) : [];
    if (!incomingItems.length) return false;

    pushHistory();
    if (mode === 'replace') {
      setSchedule(incomingItems);
      const nextSelected = typeof payload.selectedItemId === 'string'
        && incomingItems.some((entry) => entry.id === payload.selectedItemId)
        ? payload.selectedItemId
        : incomingItems[0]?.id || '';
      setSelectedItemId(nextSelected);
    } else {
      setSchedule((prev) => [
        ...prev,
        ...incomingItems.map((item) => ({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${item.id}` })),
      ]);
    }
    setActiveItemId(null);
    setActiveSlideIndex(-1);
    return true;
  };

  const handleArchiveRunSheet = async (startNewAfterArchive = false) => {
    const title = runSheetArchiveTitle.trim() || `Run Sheet ${new Date().toLocaleString()}`;
    const result = await archiveRunSheetPayload(title, {
      items: schedule,
      selectedItemId,
    });
    if (!result.ok) {
      setRunSheetFilesError('Cannot archive an empty run sheet.');
      return;
    }
    setRunSheetArchiveTitle('');
    setRunSheetFilesError(result.source === 'local'
      ? (result.reason || `Saved in local archive backup (API unavailable at ${getServerApiBaseUrl()} or not signed in).`)
      : null);
    if (startNewAfterArchive) {
      const fresh = buildTemplate('CLASSIC');
      pushHistory();
      setSchedule(fresh);
      setSelectedItemId(fresh[0]?.id || '');
      setActiveItemId(null);
      setActiveSlideIndex(-1);
      setActiveSidebarTab('SCHEDULE');
    }
  };

  const handleArchiveSingleRunSheetItem = async (itemId: string) => {
    const item = schedule.find((entry) => entry.id === itemId);
    if (!item) return;
    const confirmed = window.confirm(`Move "${item.title}" to Run Sheet Files? It will be removed from the active run sheet.`);
    if (!confirmed) return;

    const title = `${item.title} • ${new Date().toLocaleString()}`;
    const result = await archiveRunSheetPayload(title, {
      items: [item],
      selectedItemId: item.id,
    });
    if (!result.ok) {
      setRunSheetFilesError('Move failed. Please try again.');
      return;
    }

    const nextSchedule = schedule.filter((entry) => entry.id !== itemId);
    pushHistory();
    setSchedule(nextSchedule);
    if (selectedItemId === itemId) {
      setSelectedItemId(nextSchedule[0]?.id || '');
    }
    if (activeItemId === itemId) {
      setActiveItemId(null);
      setActiveSlideIndex(-1);
    }
    setRunSheetFilesError(result.source === 'local'
      ? (result.reason || `Moved to local archive backup (API unavailable at ${getServerApiBaseUrl()} or not signed in).`)
      : null);
    setActiveSidebarTab('FILES');
  };

  const handleReuseRunSheet = async (fileId: string, mode: 'replace' | 'duplicate' = 'replace') => {
    let source: 'server' | 'local' = 'local';
    try {
      if (user?.uid) {
        const response = await reuseRunSheetFile(workspaceId, fileId, user);
        if (response?.ok && response.payload && Array.isArray(response.payload.items)) {
          const applied = applyIncomingRunSheetPayload(response.payload as { items: ServiceItem[]; selectedItemId?: string | null }, mode);
          if (!applied) {
            setRunSheetFilesError('Selected archive file has no items.');
            return;
          }
          if (response.file) {
            upsertRunSheetFileState(response.file as RunSheetFileRecord);
          }
          setRunSheetFilesError(null);
          return;
        }
        if (response && !response.ok) {
          setRunSheetFilesError(extractApiFailureMessage(response, `Reuse API failed at ${getServerApiBaseUrl()}`));
        }
      }
    } catch (error) {
      source = 'local';
      reportSyncFailure('runsheet-archive-reuse', error, { fileId, mode });
    }

    const localFile = runSheetFiles.find((entry) => entry.fileId === fileId)
      || readLocalRunSheetFiles(workspaceId).find((entry) => entry.fileId === fileId);
    if (!localFile?.payload || !Array.isArray(localFile.payload.items)) {
      setRunSheetFilesError('Archive file not found locally.');
      return;
    }

    const applied = applyIncomingRunSheetPayload(localFile.payload, mode);
    if (!applied) {
      setRunSheetFilesError('Selected archive file has no items.');
      return;
    }

    const touchedAt = Date.now();
    const touchedFile: RunSheetFileRecord = {
      ...localFile,
      updatedAt: touchedAt,
      lastUsedAt: touchedAt,
    };
    upsertRunSheetFileState(touchedFile);
    setRunSheetFilesError(source === 'local'
      ? 'Reused local archive backup (API unavailable or not signed in).'
      : null);
  };

  const handleRenameRunSheet = async (fileId: string) => {
    const existing = runSheetFiles.find((entry) => entry.fileId === fileId);
    const nextTitle = window.prompt('Rename run sheet', existing?.title || '');
    const trimmed = String(nextTitle || '').trim();
    if (!trimmed) return;
    try {
      if (user?.uid) {
        const response = await renameRunSheetFile(workspaceId, fileId, trimmed, user);
        if (response?.ok && response.file) {
          upsertRunSheetFileState(response.file as RunSheetFileRecord);
          setRunSheetFilesError(null);
          return;
        }
        if (response && !response.ok) {
          setRunSheetFilesError(extractApiFailureMessage(response, `Rename API failed at ${getServerApiBaseUrl()}`));
        }
      }
    } catch (error) {
      reportSyncFailure('runsheet-archive-rename', error, { fileId });
    }

    let changed = false;
    setRunSheetFiles((prev) => {
      const updatedAt = Date.now();
      const next = prev.map((entry) => {
        if (entry.fileId !== fileId) return entry;
        changed = true;
        return { ...entry, title: trimmed, updatedAt };
      });
      if (changed) writeLocalRunSheetFiles(workspaceId, next);
      return next;
    });
    setRunSheetFilesError(changed
      ? 'Renamed in local archive backup (API unavailable or not signed in).'
      : 'Unable to rename archive file.');
  };

  const handleDeleteRunSheet = async (fileId: string) => {
    if (!window.confirm('Delete this archived run sheet?')) return;
    try {
      if (user?.uid) {
        const response = await deleteRunSheetFile(workspaceId, fileId, user);
        if (response?.ok) {
          removeRunSheetFileState(fileId);
          setRunSheetFilesError(null);
          return;
        }
        if (response && !response.ok) {
          setRunSheetFilesError(extractApiFailureMessage(response, `Delete API failed at ${getServerApiBaseUrl()}`));
        }
      }
    } catch (error) {
      reportSyncFailure('runsheet-archive-delete', error, { fileId });
    }
    removeRunSheetFileState(fileId);
    setRunSheetFilesError('Deleted from local archive backup (API unavailable or not signed in).');
  };

  const openCreatePresetModal = () => {
    setEditingPresetId(null);
    setPresetDraft(createSpeakerPresetDraft());
    setIsPresetModalOpen(true);
  };

  const openEditPresetModal = (preset: SpeakerTimerPreset) => {
    setEditingPresetId(preset.id);
    setPresetDraft({
      ...preset,
      speakerName: preset.speakerName || '',
    });
    setIsPresetModalOpen(true);
  };

  const savePresetDraft = () => {
    const normalized = sanitizeSpeakerTimerPreset(presetDraft);
    if (!normalized) return;
    setWorkspaceSettings((prev) => {
      const existing = Array.isArray(prev.speakerTimerPresets) ? prev.speakerTimerPresets : [];
      if (editingPresetId) {
        return {
          ...prev,
          speakerTimerPresets: existing.map((entry) => (
            entry.id === editingPresetId ? { ...normalized, id: editingPresetId } : entry
          )),
        };
      }
      return {
        ...prev,
        speakerTimerPresets: [...existing, normalized],
      };
    });
    setIsPresetModalOpen(false);
  };

  const deleteSpeakerPreset = (presetId: string) => {
    if (!window.confirm('Delete this speaker preset?')) return;
    setWorkspaceSettings((prev) => {
      const existing = Array.isArray(prev.speakerTimerPresets) ? prev.speakerTimerPresets : [];
      const next = existing.filter((entry) => entry.id !== presetId);
      return {
        ...prev,
        speakerTimerPresets: next.length ? next : DEFAULT_SPEAKER_TIMER_PRESETS,
      };
    });
  };

  const applySpeakerPresetToItem = (itemId: string, presetId: string) => {
    const preset = (workspaceSettings.speakerTimerPresets || []).find((entry) => entry.id === presetId);
    if (!preset || !itemId) return;
    setSchedule((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        timerCue: {
          ...(item.timerCue || {}),
          enabled: true,
          durationSec: Math.max(1, Math.round(preset.durationSec)),
          speakerName: preset.speakerName || item.timerCue?.speakerName || '',
          autoStartNext: !!preset.autoStartNextDefault,
          amberPercent: clamp(preset.amberPercent, 1, 99),
          redPercent: clamp(preset.redPercent, 1, 99),
          presetId: preset.id,
        },
      };
    }));
    if (currentCueItemId === itemId && !timerRunning) {
      setTimerMode('COUNTDOWN');
      setTimerDurationMin(Math.max(1, Math.ceil(preset.durationSec / 60)));
      setTimerSeconds(Math.max(1, Math.round(preset.durationSec)));
      setCueZeroHold(false);
    }
  };

  const applySelectedPresetToCurrentCue = () => {
    const targetItemId = currentCueItemId || selectedItemId;
    if (!targetItemId || !selectedSpeakerPresetId) return;
    applySpeakerPresetToItem(targetItemId, selectedSpeakerPresetId);
  };

  const importLyricsAsItem = () => {
    setImportModalError(null);
    const raw = importLyrics.trim();
    if (!raw) return;
    const chunks = raw
      .split(/\n\s*\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (!chunks.length) return;
    const now = Date.now();
    const slides: Slide[] = chunks.map((content, idx) => ({
      id: `${now}-${idx}`,
      label: `Part ${idx + 1}`,
      content,
    }));
    const newItem: ServiceItem = {
      id: `${now}`,
      title: importTitle.trim() || 'Imported Lyrics',
      type: ItemType.SONG,
      slides,
      theme: {
        backgroundUrl: DEFAULT_BACKGROUNDS[0],
        mediaType: 'image',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'large',
      },
    };
    addItem(newItem);
    setImportTitle('Imported Lyrics');
    setImportLyrics('');
    setIsLyricsImportOpen(false);
  };

  const resolveImportedDeckTitle = (fallbackTitle: string) => {
    const customTitle = importTitle.trim();
    if (customTitle && customTitle.toLowerCase() !== 'imported lyrics') return customTitle;
    return fallbackTitle || 'Imported Presentation';
  };

  const base64ToFile = (base64: string, filename: string, mimeType = 'image/png') => {
    const raw = (base64 || '').trim();
    const clean = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let idx = 0; idx < binary.length; idx += 1) {
      bytes[idx] = binary.charCodeAt(idx);
    }
    return new File([bytes], filename, { type: mimeType });
  };

  const buildTextSlidesFromPptx = async (file: File) => {
    const parsed = await parsePptxFile(file);
    const now = Date.now();
    const slides: Slide[] = parsed.slides.map((entry, idx) => ({
      id: `${now}-pptx-text-${idx + 1}`,
      label: entry.label || `Slide ${idx + 1}`,
      content: entry.content,
      notes: entry.notes,
    }));
    return {
      suggestedTitle: parsed.title,
      slides,
    };
  };

  const buildVisualSlidesFromPptx = async (
    file: File,
    onProgress?: (message: string) => void
  ) => {
    if (!user?.uid) {
      throw new Error('Please sign in before importing PowerPoint visuals.');
    }
    const converted = await importVisualPptxDeck(workspaceId, user, file);
    if (!converted?.ok || !Array.isArray(converted.slides) || !converted.slides.length) {
      throw new Error(converted?.message || 'Visual PowerPoint import failed.');
    }

    const now = Date.now();
    const slides: Slide[] = [];
    for (let idx = 0; idx < converted.slides.length; idx += 1) {
      const entry = converted.slides[idx];
      onProgress?.(`Saving slide ${idx + 1} of ${converted.slides.length}...`);
      const fileName = entry?.name || `slide-${idx + 1}.png`;
      const remoteUrl = String(entry?.imageUrl || '').trim();
      let backgroundUrl = remoteUrl;
      if (!backgroundUrl) {
        if (!entry?.imageBase64) {
          throw new Error(`Visual import slide ${idx + 1} is missing image data.`);
        }
        const imageFile = base64ToFile(entry.imageBase64, fileName, 'image/png');
        backgroundUrl = await saveMedia(imageFile);
      }
      slides.push({
        id: `${now}-pptx-visual-${idx + 1}`,
        label: `Slide ${idx + 1}`,
        content: '',
        backgroundUrl,
        mediaType: 'image',
        notes: '',
      });
    }
    return {
      suggestedTitle: file.name.replace(/\.[^.]+$/, ''),
      slides,
    };
  };

  const isVisualRendererUnavailable = (message: string) => {
    const normalized = (message || '').toLowerCase();
    return normalized.includes('soffice')
      || normalized.includes('libreoffice')
      || normalized.includes('renderer is unavailable')
      || normalized.includes('visual powerpoint import endpoint is not available');
  };

  const importPowerPointTextAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing PowerPoint text...');
    try {
      const parsed = await buildTextSlidesFromPptx(file);
      const now = Date.now();
      const slides = parsed.slides;

      const importedItem: ServiceItem = {
        id: `${now}`,
        title: resolveImportedDeckTitle(parsed.suggestedTitle),
        type: ItemType.ANNOUNCEMENT,
        slides,
        theme: {
          backgroundUrl: DEFAULT_BACKGROUNDS[0],
          mediaType: 'image',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: true,
          fontSize: 'large',
        },
      };

      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: slides.length, mode: 'text' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      const message = error?.message || 'PowerPoint import failed.';
      setImportModalError(message);
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importPowerPointVisualAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Rendering slide visuals...');
    try {
      let converted = await buildVisualSlidesFromPptx(file, (status) => setImportDeckStatus(status));
      let fallbackToText = false;
      if (!converted.slides.length) {
        throw new Error('Visual PowerPoint import returned no slides.');
      }
      if (isElectronShell && converted.slides.every((entry) => !entry.backgroundUrl)) {
        setImportDeckStatus('Visual render unavailable. Falling back to PPTX text import...');
        converted = await buildTextSlidesFromPptx(file);
        fallbackToText = true;
      }
      const now = Date.now();
      const slides = converted.slides;

      const importedItem: ServiceItem = {
        id: `${now}`,
        title: resolveImportedDeckTitle(converted.suggestedTitle),
        type: fallbackToText ? ItemType.ANNOUNCEMENT : ItemType.MEDIA,
        slides,
        theme: {
          backgroundUrl: fallbackToText ? DEFAULT_BACKGROUNDS[0] : '',
          mediaType: 'image',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: fallbackToText ? true : false,
          fontSize: fallbackToText ? 'large' : 'medium',
        },
      };

      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: slides.length, mode: fallbackToText ? 'visual_fallback_text' : 'visual' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      const message = error?.message || 'Visual PowerPoint import failed.';
      if (isElectronShell && isVisualRendererUnavailable(message)) {
        try {
          setImportDeckStatus('Visual renderer unavailable. Falling back to PPTX text import...');
          const parsed = await buildTextSlidesFromPptx(file);
          const now = Date.now();
          const importedItem: ServiceItem = {
            id: `${now}`,
            title: resolveImportedDeckTitle(parsed.suggestedTitle),
            type: ItemType.ANNOUNCEMENT,
            slides: parsed.slides,
            theme: {
              backgroundUrl: DEFAULT_BACKGROUNDS[0],
              mediaType: 'image',
              fontFamily: 'sans-serif',
              textColor: '#ffffff',
              shadow: true,
              fontSize: 'large',
            },
          };
          addItem(importedItem);
          logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: parsed.slides.length, mode: 'visual_server_unavailable_fallback_text' });
          setImportTitle('Imported Lyrics');
          setImportLyrics('');
          setIsLyricsImportOpen(false);
          alert('Visual PPTX renderer is unavailable on the server. Lumina imported this deck as text slides so you can continue.');
        } catch (fallbackError: any) {
          setImportModalError(fallbackError?.message || message);
        }
      } else {
        setImportModalError(message);
      }
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importPowerPointVisualSlidesForSlideEditor = async (file: File): Promise<Slide[]> => {
    try {
      const visual = await buildVisualSlidesFromPptx(file);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: visual.slides.length, mode: 'visual_slide_editor' });
      return visual.slides;
    } catch (error: any) {
      const message = error?.message || 'Visual PowerPoint import failed.';
      if (isElectronShell && isVisualRendererUnavailable(message)) {
        const parsed = await buildTextSlidesFromPptx(file);
        logActivity(user?.uid, 'IMPORT_PPTX', {
          filename: file.name,
          slideCount: parsed.slides.length,
          mode: 'visual_slide_editor_server_unavailable_fallback_text',
        });
        alert('Visual PPTX renderer is unavailable on the server. Lumina imported this deck as text slides.');
        return parsed.slides;
      }
      throw error;
    }
  };

  const importPowerPointTextSlidesForSlideEditor = async (file: File): Promise<Slide[]> => {
    const text = await buildTextSlidesFromPptx(file);
    logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: text.slides.length, mode: 'text_slide_editor' });
    return text.slides;
  };


  const addItem = (item: ServiceItem) => {
    pushHistory();
    setSchedule(prev => [...prev, item]);
    setSelectedItemId(item.id);
    logActivity(user?.uid, 'ADD_ITEM', { type: item.type, title: item.title });
  };

  const handleAIItemGenerated = (item: ServiceItem) => {
    const sentiment = analyzeSentimentContext(item.title + ' ' + (item.slides[0]?.content || ''));
    logActivity(user?.uid, 'AI_GENERATION', { sentiment, slideCount: item.slides.length, type: item.type });
    addItem(item);
  };

  const updateItem = (updatedItem: ServiceItem) => {
    pushHistory();
    setSchedule(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const removeItem = (id: string) => {
    pushHistory();
    logActivity(user?.uid, 'DELETE_ITEM', { itemId: id });
    const newSchedule = schedule.filter(i => i.id !== id);
    setSchedule(newSchedule);
    if (selectedItemId === id) setSelectedItemId(newSchedule[0]?.id || '');
  };

  const addEmptyItem = () => {
    const newItem: ServiceItem = {
      id: Date.now().toString(),
      title: "New Item",
      type: ItemType.ANNOUNCEMENT,
      slides: [],
      theme: { backgroundUrl: DEFAULT_BACKGROUNDS[2], fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' }
    };
    addItem(newItem);
  };

  const goLive = (item: ServiceItem, slideIndex: number = 0) => {
    if (!item || !Array.isArray(item.slides) || item.slides.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(item.slides.length - 1, slideIndex));
    setActiveItemId(item.id);
    setActiveSlideIndex(boundedIndex);
    if (item.timerCue?.enabled) {
      const cueDuration = Number.isFinite(item.timerCue.durationSec) ? Math.max(1, Math.round(item.timerCue.durationSec)) : 300;
      setCurrentCueItemId(item.id);
      if (!timerRunning) {
        setTimerMode('COUNTDOWN');
        setTimerDurationMin(Math.max(1, Math.ceil(cueDuration / 60)));
        setTimerSeconds(cueDuration);
        setCueZeroHold(false);
      }
    }
    setBlackout(false);
    setIsPlaying(true);
    logActivity(user?.uid, 'PRESENTATION_START', { itemTitle: item.title });
  };
  const handleProjectAudienceMessage = (text: string, label?: string) => {
    const existingIdx = schedule.findIndex(i => i.id === 'audience-live-item');
    const newItem: ServiceItem = {
      id: 'audience-live-item',
      title: label || 'Audience Message',
      type: ItemType.ANNOUNCEMENT,
      slides: [{
        id: 'audience-slide',
        content: text,
        label: label || 'Audience Message'
      }],
      theme: {
        backgroundUrl: DEFAULT_BACKGROUNDS[0],
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'medium'
      }
    };

    if (existingIdx >= 0) {
      updateItem(newItem);
    } else {
      addItem(newItem);
    }

    setLowerThirdsEnabled(true);
    goLive(newItem, 0);
  };


  const nextSlide = useCallback(() => {
    setBlackout((prev) => (prev ? false : prev));
    if (!activeItem) return;
    if (activeSlideIndex < activeItem.slides.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    } else {
      const currentItemIdx = schedule.findIndex(i => i.id === activeItem.id);
      if (currentItemIdx < schedule.length - 1) {
        const nextItem = schedule[currentItemIdx + 1];
        if (!nextItem || !Array.isArray(nextItem.slides) || nextItem.slides.length === 0) return;
        setActiveItemId(nextItem.id);
        setActiveSlideIndex(0);
        setIsPlaying(true);
      }
    }
  }, [activeItem, activeSlideIndex, schedule]);

  const prevSlide = useCallback(() => {
    setBlackout((prev) => (prev ? false : prev));
    if (!activeItem) return;
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    } else {
      const currentItemIdx = schedule.findIndex(i => i.id === activeItem.id);
      if (currentItemIdx > 0) {
        const prevItem = schedule[currentItemIdx - 1];
        if (!prevItem || !Array.isArray(prevItem.slides) || prevItem.slides.length === 0) return;
        setActiveItemId(prevItem.id);
        setActiveSlideIndex(prevItem.slides.length - 1);
        setIsPlaying(true);
      }
    }
  }, [activeItem, activeSlideIndex, schedule]);

  const activateCueByItemId = useCallback((itemId: string, options: { autoStart?: boolean; goLiveItem?: boolean } = {}) => {
    const cueEntry = enabledTimerCues.find((entry) => entry.itemId === itemId);
    if (!cueEntry) return;
    setCurrentCueItemId(cueEntry.itemId);
    setTimerMode('COUNTDOWN');
    setTimerDurationMin(Math.max(1, Math.ceil(cueEntry.cue.durationSec / 60)));
    setTimerSeconds(cueEntry.cue.durationSec);
    setCueZeroHold(false);
    setTimerRunning(!!options.autoStart);
    if (options.goLiveItem) {
      const cueItem = schedule.find((entry) => entry.id === cueEntry.itemId);
      if (cueItem && Array.isArray(cueItem.slides) && cueItem.slides.length > 0) {
        setActiveItemId(cueItem.id);
        setActiveSlideIndex(0);
        setBlackout(false);
        setIsPlaying(true);
      }
    }
  }, [enabledTimerCues, schedule]);

  const moveCueByOffset = useCallback((offset: number, options: { autoStart?: boolean; goLiveItem?: boolean } = {}) => {
    if (!enabledTimerCues.length) return;
    const currentIndex = enabledTimerCues.findIndex((entry) => entry.itemId === currentCueItemId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = clamp(baseIndex + offset, 0, enabledTimerCues.length - 1);
    const target = enabledTimerCues[nextIndex];
    if (!target) return;
    activateCueByItemId(target.itemId, options);
  }, [enabledTimerCues, currentCueItemId, activateCueByItemId]);

  const triggerSeek = (seconds: number) => {
    setSeekAmount(seconds);
    setSeekCommand(Date.now());
  };

  const stopProgramVideo = useCallback(() => {
    setIsPlaying(false);
    // Large negative seek safely clamps to zero in the renderer.
    setSeekAmount(-86400);
    setSeekCommand(Date.now());
  }, []);

  const executeRemoteCommand = useCallback((command: RemoteCommand) => {
    if (command === 'NEXT') nextSlide();
    if (command === 'PREV') prevSlide();
    if (command === 'BLACKOUT') setBlackout((prev) => !prev);
    if (command === 'PLAY') setIsPlaying(true);
    if (command === 'PAUSE') setIsPlaying(false);
    if (command === 'STOP') stopProgramVideo();
    if (command === 'MUTE') setOutputMuted(true);
    if (command === 'UNMUTE') setOutputMuted(false);
  }, [nextSlide, prevSlide, stopProgramVideo]);

  const handleSaveSlideFromEditor = (slideToSave: Slide) => {
    if (!selectedItem) return;
    const slideExists = selectedItem.slides.find((entry) => entry.id === slideToSave.id);
    const nextSlides = slideExists
      ? selectedItem.slides.map((entry) => (entry.id === slideToSave.id ? slideToSave : entry))
      : [...selectedItem.slides, slideToSave];
    updateItem({ ...selectedItem, slides: nextSlides });
    setIsSlideEditorOpen(false);
  };

  const handleInsertSlidesFromEditor = (slidesToInsert: Slide[], replaceCurrentId?: string | null) => {
    if (!selectedItem || !slidesToInsert.length) return;
    const incoming = slidesToInsert.map((entry, idx) => ({
      ...entry,
      id: entry.id || `${Date.now()}-import-${idx + 1}`,
    }));

    const nextSlides = [...selectedItem.slides];
    if (replaceCurrentId) {
      const targetIndex = nextSlides.findIndex((entry) => entry.id === replaceCurrentId);
      if (targetIndex >= 0) {
        const [first, ...rest] = incoming;
        const replacement = { ...first, id: replaceCurrentId };
        nextSlides.splice(targetIndex, 1, replacement, ...rest);
      } else {
        nextSlides.push(...incoming);
      }
    } else {
      nextSlides.push(...incoming);
    }

    updateItem({ ...selectedItem, slides: nextSlides });
    setIsSlideEditorOpen(false);
  };

  const handleEditSlide = (slide: Slide) => {
    setEditingSlide(slide);
    setIsSlideEditorOpen(true);
  };

  const handleDeleteSlide = (slideId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedItem) return;
    const newSlides = selectedItem.slides.filter(s => s.id !== slideId);
    updateItem({ ...selectedItem, slides: newSlides });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
      if (isTypingTarget) return;
      if (isAIModalOpen || isSlideEditorOpen || isHelpOpen || isProfileOpen || isMotionLibOpen || isTemplateOpen || isLyricsImportOpen) return;
      if (viewMode !== 'PRESENTER') return;
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prevSlide(); break;
        case 'b': setBlackout(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, nextSlide, prevSlide, isAIModalOpen, isSlideEditorOpen, isHelpOpen, isProfileOpen, isMotionLibOpen, isTemplateOpen, isLyricsImportOpen]);




  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid) return;

    let unsubPlaylists = () => { };
    try {
      unsubPlaylists = subscribeToTeamPlaylists(
        user.uid,
        (data) => {
          const playlists = Array.isArray(data) ? (data as CloudPlaylistRecord[]) : [];
          setTeamPlaylists(playlists);

          if (hasHydratedCloudStateRef.current) return;
          hasHydratedCloudStateRef.current = true;
          setCloudBootstrapComplete(true);

          const preferred = playlists.find((entry) => entry.id === cloudPlaylistId) || playlists[0];
          if (!preferred) return;

          const localUpdatedAt = typeof initialSavedStateRef.current?.updatedAt === 'number'
            ? initialSavedStateRef.current.updatedAt
            : 0;

          const cloudUpdatedAt = typeof preferred.updatedAt === 'number' ? preferred.updatedAt : 0;
          if (localUpdatedAt > cloudUpdatedAt) return;

          if (Array.isArray(preferred.items) && preferred.items.length > 0) {
            const nextSchedule = preferred.items as ServiceItem[];
            setSchedule(nextSchedule);

            const preferredSelected = typeof preferred.selectedItemId === 'string' ? preferred.selectedItemId : '';
            const selectedExists = nextSchedule.some((item) => item.id === preferredSelected);
            setSelectedItemId(selectedExists ? preferredSelected : nextSchedule[0]?.id || '');

            const preferredActiveItemId = typeof preferred.activeItemId === 'string' ? preferred.activeItemId : null;
            const activeItem = preferredActiveItemId
              ? nextSchedule.find((item) => item.id === preferredActiveItemId)
              : null;
            if (activeItem) {
              const rawActiveIndex = typeof preferred.activeSlideIndex === 'number' ? preferred.activeSlideIndex : 0;
              const boundedIndex = Math.max(0, Math.min(activeItem.slides.length - 1, rawActiveIndex));
              setActiveItemId(activeItem.id);
              setActiveSlideIndex(activeItem.slides.length > 0 ? boundedIndex : -1);
            } else {
              setActiveItemId(null);
              setActiveSlideIndex(-1);
            }
          }

          if (preferred.stageMessageCenter && typeof preferred.stageMessageCenter === 'object') {
            const cloudCenter = sanitizeStageMessageCenterState(preferred.stageMessageCenter);
            if (cloudCenter.queue.length || cloudCenter.activeMessageId || cloudCenter.lastSentAt) {
              setStageMessageCenter(cloudCenter);
            }
          } else if (preferred.stageAlert && typeof preferred.stageAlert === 'object') {
            const legacy = stageMessageFromLegacyAlert(sanitizeStageAlertState(preferred.stageAlert));
            if (legacy) {
              setStageMessageCenter({
                queue: [legacy],
                activeMessageId: legacy.id,
                lastSentAt: legacy.createdAt,
              });
            }
          }

          if (preferred.audienceQrProjection && typeof preferred.audienceQrProjection === 'object') {
            const cloudQrProjection = sanitizeAudienceQrProjectionState(preferred.audienceQrProjection);
            setAudienceQrProjection((prev) => (
              cloudQrProjection.updatedAt >= (prev.updatedAt || 0)
                ? cloudQrProjection
                : prev
            ));
          }

          const cloudSettings = sanitizeWorkspaceSettings(preferred.workspaceSettings);
          const cloudSettingsUpdatedAt = typeof preferred.workspaceSettingsUpdatedAt === 'number'
            ? preferred.workspaceSettingsUpdatedAt
            : 0;
          const localSettingsUpdatedAt = workspaceSettingsUpdatedAtRef.current;
          if (Object.keys(cloudSettings).length > 0 && cloudSettingsUpdatedAt && cloudSettingsUpdatedAt >= localSettingsUpdatedAt) {
            workspaceSettingsUpdatedAtRef.current = cloudSettingsUpdatedAt;
            setWorkspaceSettings((prev) => ({ ...prev, ...cloudSettings }));
          }
        },
        (error) => {
          reportSyncFailure('playlist-subscribe', error, { teamId: user.uid });
          if (!hasHydratedCloudStateRef.current) {
            hasHydratedCloudStateRef.current = true;
            setCloudBootstrapComplete(true);
          }
        }
      );
    } catch (error) {
      reportSyncFailure('playlist-subscribe', error, { teamId: user.uid });
      if (!hasHydratedCloudStateRef.current) {
        hasHydratedCloudStateRef.current = true;
        setCloudBootstrapComplete(true);
      }
    }

    return () => {
      unsubPlaylists();
    };
  }, [user?.uid, cloudPlaylistId, reportSyncFailure]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !user?.uid || !cloudBootstrapComplete) return;

    const unsubState = subscribeToState((data) => {
      if (!isRecord(data)) {
        reportSyncFailure('remote-snapshot-parse', new Error('Snapshot payload is not an object'));
        return;
      }

      const rawIncomingAt = data.remoteCommandAt;
      const incomingAt = typeof rawIncomingAt === 'number' && Number.isFinite(rawIncomingAt) ? rawIncomingAt : null;

      // First snapshot should only initialize marker to avoid replaying stale commands.
      if (!hasInitializedRemoteSnapshotRef.current) {
        hasInitializedRemoteSnapshotRef.current = true;
        lastRemoteCommandAtRef.current = incomingAt;
        return;
      }

      if (!incomingAt || incomingAt === lastRemoteCommandAtRef.current) return;
      lastRemoteCommandAtRef.current = incomingAt;

      const command = data.remoteCommand;
      if (!isRemoteCommand(command)) {
        reportSyncFailure('remote-command-parse', new Error('Unsupported remote command payload'), {
          command: String(command),
          remoteCommandAt: incomingAt,
        });
        return;
      }

      executeRemoteCommand(command);

    }, liveSessionId, (error) => {
      reportSyncFailure('remote-subscribe', error);
    });

    return () => {
      unsubState();
      hasInitializedRemoteSnapshotRef.current = false;
      lastRemoteCommandAtRef.current = null;
    };
  }, [user?.uid, cloudBootstrapComplete, executeRemoteCommand, liveSessionId, reportSyncFailure]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    let active = true;
    const pollServerCommands = async () => {
      const response = await fetchServerSessionState(workspaceId, liveSessionId);
      if (!active || !response?.state) return;
      const data = response.state;
      const rawIncomingAt = data.remoteCommandAt;
      const incomingAt = typeof rawIncomingAt === 'number' && Number.isFinite(rawIncomingAt) ? rawIncomingAt : null;
      if (!incomingAt || incomingAt === lastServerRemoteCommandAtRef.current) return;
      lastServerRemoteCommandAtRef.current = incomingAt;

      const command = data.remoteCommand;
      if (!isRemoteCommand(command)) return;
      executeRemoteCommand(command);
    };
    pollServerCommands();
    const id = window.setInterval(pollServerCommands, 650);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, liveSessionId, user?.uid, cloudBootstrapComplete, executeRemoteCommand]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    syncLiveState({
      activeItemId,
      activeSlideIndex,
      blackout,
      isPlaying,
      outputMuted,
      seekCommand,
      seekAmount,
      lowerThirdsEnabled,
      routingMode,
      timerMode,
      timerSeconds,
      timerDurationSec: effectiveTimerDurationSec,
      timerCueSpeaker: currentCueSpeaker,
      timerCueAmberPercent: currentCueAmberPercent,
      timerCueRedPercent: currentCueRedPercent,
      currentCueItemId,
      audienceDisplay,
      audienceQrProjection,
      stageMessageCenter,
      stageAlert: legacyAlertFromMessageCenter(stageMessageCenter),
      workspaceSettings,
      workspaceSettingsUpdatedAt: workspaceSettingsUpdatedAtRef.current || Date.now(),
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [activeItemId, activeSlideIndex, blackout, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, routingMode, timerMode, timerSeconds, effectiveTimerDurationSec, currentCueSpeaker, currentCueAmberPercent, currentCueRedPercent, currentCueItemId, audienceDisplay, audienceQrProjection, stageMessageCenter, workspaceSettings, user?.uid, user?.email, allowedAdminEmails, syncLiveState, cloudBootstrapComplete]);

  useEffect(() => {
    if (user?.uid && cloudBootstrapComplete && workspaceSettings.machineMode) {
      const hasAutoLaunched = (window as any)._luminaAutoLaunched;
      if (!hasAutoLaunched) {
        (window as any)._luminaAutoLaunched = true;
        // Small delay to ensure browser has settled
        window.setTimeout(() => {
          if (!isOutputLive) handleToggleOutput();
          if (!isStageDisplayLive) handleToggleStageDisplay();
        }, 3000);
      }
    }
  }, [user?.uid, cloudBootstrapComplete, workspaceSettings.machineMode, isOutputLive, isStageDisplayLive]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    syncLiveState({
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [user?.uid, user?.email, allowedAdminEmails, syncLiveState, cloudBootstrapComplete]);

  useEffect(() => {
    if (!user?.uid || viewState !== 'studio') return;
    if (!workspaceId || !liveSessionId) return;
    let active = true;
    const pulse = async () => {
      const nowTs = Date.now();
      if (nowTs < controllerConnectionPauseUntilRef.current) return;
      try {
        const heartbeat = await heartbeatSessionConnection(workspaceId, liveSessionId, 'controller', controllerClientId, {
          route: 'studio',
          viewMode,
          uid: user?.uid || '',
        });
        const response = await fetchSessionConnections(workspaceId, liveSessionId);
        const ok = heartbeat?.ok === true && response?.ok === true;
        if (!ok) {
          controllerConnectionFailureRef.current += 1;
          if (controllerConnectionFailureRef.current >= 3) {
            controllerConnectionPauseUntilRef.current = Date.now() + 60000;
          }
          return;
        }
        controllerConnectionFailureRef.current = 0;
        controllerConnectionPauseUntilRef.current = 0;
        if (!active) return;
        const byRole = response?.counts?.byRole || {};
        setConnectionCountsByRole(byRole);
        const satisfied = targetConnectionRoles.reduce((sum, role) => (
          sum + ((Number(byRole[role] || 0) > 0) ? 1 : 0)
        ), 0);
        setActiveTargetConnectionCount(satisfied);
      } catch {
        controllerConnectionFailureRef.current += 1;
        if (controllerConnectionFailureRef.current >= 3) {
          controllerConnectionPauseUntilRef.current = Date.now() + 60000;
        }
      }
    };
    pulse();
    const id = window.setInterval(pulse, 4000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, liveSessionId, controllerClientId, targetConnectionRoles, viewMode, user?.uid, viewState]);

  useEffect(() => {
    if (!user?.uid || viewState !== 'studio') return;
    if (!isOutputLive) return;
    const beat = async () => {
      const nowTs = Date.now();
      if (nowTs < outputHeartbeatPauseUntilRef.current) return;
      try {
        const heartbeat = await heartbeatSessionConnection(workspaceId, liveSessionId, 'output', outputClientId, {
          route: 'studio-popout',
        });
        if (heartbeat?.ok === true) {
          outputHeartbeatFailureRef.current = 0;
          outputHeartbeatPauseUntilRef.current = 0;
          return;
        }
        outputHeartbeatFailureRef.current += 1;
      } catch {
        outputHeartbeatFailureRef.current += 1;
      }
      if (outputHeartbeatFailureRef.current >= 3) {
        outputHeartbeatPauseUntilRef.current = Date.now() + 60000;
      }
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [isOutputLive, workspaceId, liveSessionId, outputClientId, user?.uid, viewState]);

  useEffect(() => {
    if (!user?.uid || viewState !== 'studio') return;
    if (!isStageDisplayLive) return;
    const beat = async () => {
      const nowTs = Date.now();
      if (nowTs < stageHeartbeatPauseUntilRef.current) return;
      try {
        const heartbeat = await heartbeatSessionConnection(workspaceId, liveSessionId, 'stage', stageClientId, {
          route: 'studio-popout',
        });
        if (heartbeat?.ok === true) {
          stageHeartbeatFailureRef.current = 0;
          stageHeartbeatPauseUntilRef.current = 0;
          return;
        }
        stageHeartbeatFailureRef.current += 1;
      } catch {
        stageHeartbeatFailureRef.current += 1;
      }
      if (stageHeartbeatFailureRef.current >= 3) {
        stageHeartbeatPauseUntilRef.current = Date.now() + 60000;
      }
    };
    beat();
    const id = window.setInterval(beat, 4000);
    return () => window.clearInterval(id);
  }, [isStageDisplayLive, workspaceId, liveSessionId, stageClientId, user?.uid, viewState]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let active = true;
    navigator.requestMIDIAccess().then((access) => {
      if (!active) return;
      const onMidiMessage = (event: any) => {
        const [status, note, velocity] = event.data || [];
        if ((status & 0xf0) !== 0x90 || velocity === 0) return;
        if (note === 60) nextSlide();
        if (note === 59) prevSlide();
        if (note === 58) setBlackout((prev) => !prev);
      };

      access.inputs.forEach((input) => {
        input.onmidimessage = onMidiMessage;
      });
    }).catch((error) => console.warn('MIDI unavailable', error));

    return () => {
      active = false;
    };
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    if (!timerRunning) return;

    const id = window.setInterval(() => {
      setTimerSeconds((prev) => {
        if (timerMode === 'COUNTDOWN') return prev - 1;
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning, timerMode, currentCueItemId]);

  useEffect(() => {
    if (timerMode !== 'COUNTDOWN') return;
    if (!timerRunning) return;
    if (!currentCue) return;
    if (timerSeconds > 0) {
      lastCueAutoAdvanceKeyRef.current = '';
      return;
    }
    const guardKey = currentCue.itemId;
    if (lastCueAutoAdvanceKeyRef.current === guardKey) return;
    lastCueAutoAdvanceKeyRef.current = guardKey;

    if (currentCue.cue.autoStartNext) {
      const nextCue = enabledTimerCues[currentCueIndex + 1];
      if (nextCue) {
        activateCueByItemId(nextCue.itemId, { autoStart: true, goLiveItem: true });
        return;
      }
    }
  }, [timerMode, timerRunning, timerSeconds, currentCue, currentCueIndex, enabledTimerCues, activateCueByItemId]);

  useEffect(() => {
    if (timerRunning || timerSeconds > 0) {
      setCueZeroHold(false);
    }
  }, [timerRunning, timerSeconds, currentCueItemId]);

  useEffect(() => {
    if (viewMode !== 'PRESENTER') return;
    const node = presenterControlsRef.current;
    if (!node) return;

    const handleUpdate = () => updatePresenterControlsScrollState();
    handleUpdate();
    node.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(handleUpdate);
      resizeObserver.observe(node);
      if (node.firstElementChild instanceof HTMLElement) {
        resizeObserver.observe(node.firstElementChild);
      }
    }

    return () => {
      node.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
      resizeObserver?.disconnect();
    };
  }, [viewMode, updatePresenterControlsScrollState]);

  useEffect(() => {
    if (viewMode !== 'PRESENTER') return;
    updatePresenterControlsScrollState();
  }, [
    viewMode,
    updatePresenterControlsScrollState,
    enabledTimerCues.length,
    selectedSpeakerPresetId,
    timerMode,
    routingMode,
    blackout,
    autoCueEnabled,
    workspaceSettings.stageFlowLayout,
    workspaceSettings.machineMode
  ]);

  useEffect(() => {
    if (viewMode !== 'PRESENTER' || !presenterControlsHasOverflow) return;
    try {
      if (localStorage.getItem(PRESENTER_TOOLBAR_HINT_KEY)) return;
    } catch {}
    setPresenterControlsShowHint(true);
  }, [viewMode, presenterControlsHasOverflow]);

  useEffect(() => {
    if (!autoCueEnabled) return;
    if (viewMode !== 'PRESENTER') return;
    if (!activeItem) return;

    setAutoCueRemaining(autoCueSeconds);
    const id = window.setInterval(() => {
      setAutoCueRemaining((prev) => {
        if (prev <= 1) {
          nextSlide();
          return autoCueSeconds;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoCueEnabled, autoCueSeconds, viewMode, activeItemId, nextSlide, activeItem]);

  // ✅ Launch Output handler (opens window synchronously from user gesture — popup-safe)
  const handleToggleOutput = () => {
    if (!activeItem && selectedItem && selectedItem.slides.length > 0) {
      goLive(selectedItem, 0);
    } else if (activeItem && !activeSlide && activeItem.slides.length > 0) {
      goLive(activeItem, 0);
    }

    if (isOutputLive) {
      setIsOutputLive(false);
      try { outputWin?.close(); } catch { }
      setOutputWin(null);
      return;
    }

    const width = window.screen?.availWidth || 1280;
    const height = window.screen?.availHeight || 720;
    const w = window.open(
      "about:blank",
      "LuminaOutput",
      `popup=yes,width=${width},height=${height},left=0,top=0,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes`
    );

    if (!w || w.closed || typeof w.closed === "undefined") {
      setPopupBlocked(true);
      setIsOutputLive(false);
      setOutputWin(null);
      return;
    }

    setPopupBlocked(false);
    setOutputWin(w);
    setIsOutputLive(true);
    try {
      w.focus();
      w.moveTo?.(0, 0);
      w.resizeTo?.(width, height);
    } catch { }
  };

  useEffect(() => {
    if (!isOutputLive || !outputWin) return;
    const checkClosed = window.setInterval(() => {
      if (outputWin.closed) {
        setIsOutputLive(false);
        setOutputWin(null);
        window.clearInterval(checkClosed);
      }
    }, 500);
    return () => window.clearInterval(checkClosed);
  }, [isOutputLive, outputWin]);

  const handleToggleStageDisplay = () => {
    if (isStageDisplayLive) {
      setIsStageDisplayLive(false);
      try { stageWin?.close(); } catch { }
      setStageWin(null);
      return;
    }

    const w = window.open(
      "about:blank",
      "LuminaStageDisplay",
      "width=1280,height=720,menubar=no,toolbar=no,location=no,status=no"
    );

    if (!w || w.closed || typeof w.closed === "undefined") {
      setPopupBlocked(true);
      setIsStageDisplayLive(false);
      setStageWin(null);
      return;
    }

    setPopupBlocked(false);
    setStageWin(w);
    setIsStageDisplayLive(true);
    try { w.focus(); } catch { }
  };

  if (authLoading) return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-xs animate-pulse">LOADING NEURAL HUB...</div>;

  // ROUTING: LANDING PAGE
  if (viewState === 'landing') {
    if (isElectronShell) {
      return null;
    }
    return <LandingPage onEnter={() => setViewState('studio')} onLogout={user ? handleLogout : undefined} isAuthenticated={!!user} hasSavedSession={hasSavedSession} />;
  }

  // ROUTING: AUDIENCE SUBMISSION PAGE
  if (viewState === 'audience') {
    return <AudienceSubmit workspaceId={workspaceId} />;
  }

  // ROUTING: PROJECTOR / OBS OUTPUT
  if (viewState === 'output') {
    return (
      <div className="h-screen w-screen bg-black overflow-hidden relative">
        {blackout ? (
          <div className="w-full h-full bg-black flex items-center justify-center text-red-900 font-mono text-xs font-bold tracking-[0.2em]">BLACKOUT</div>
        ) : (!activeItem || !activeSlide) ? (
          <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 font-mono text-xs font-bold tracking-[0.2em]">WAITING_FOR_LIVE_CONTENT</div>
        ) : (
          <SlideRenderer
            slide={activeSlide}
            item={activeItem}
            isPlaying={isPlaying}
            seekCommand={seekCommand}
            seekAmount={seekAmount}
            isMuted={outputMuted}
            isProjector={true}
            lowerThirds={routingMode !== 'PROJECTOR'}
            audienceOverlay={audienceDisplay}
            projectedAudienceQr={audienceQrProjection}
          />
        )}
      </div>
    );
  }

  if (viewState === 'stage') {
    if (blackout) {
      return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 text-xs uppercase tracking-[0.25em] font-mono">BLACKOUT ACTIVE</div>;
    }
    return (
      <StageDisplay
        currentSlide={activeSlide}
        nextSlide={nextSlidePreview}
        activeItem={activeItem}
        timerLabel={currentCueSpeaker ? `${currentCueSpeaker} Timer` : 'Pastor Timer'}
        timerDisplay={formatTimer(timerSeconds)}
        timerMode={timerMode}
        isTimerOvertime={isTimerOvertime}
        timerRemainingSec={timerSeconds}
        timerDurationSec={effectiveTimerDurationSec}
        timerAmberPercent={currentCueAmberPercent}
        timerRedPercent={currentCueRedPercent}
        timerLayout={workspaceSettings.stageTimerLayout}
        onTimerLayoutChange={(layout) => {
          setWorkspaceSettings((prev) => ({ ...prev, stageTimerLayout: layout }));
        }}
        stageAlertLayout={workspaceSettings.stageAlertLayout}
        onStageAlertLayoutChange={(layout) => {
          setWorkspaceSettings((prev) => ({ ...prev, stageAlertLayout: layout }));
        }}
        profile={workspaceSettings.stageProfile}
        flowLayout={workspaceSettings.stageFlowLayout}
        audienceOverlay={audienceDisplay}
        stageAlert={stageAlert}
        stageMessageCenter={stageMessageCenter}
      />
    );
  }

  // ROUTING: REMOTE CONTROL
  if (viewState === 'remote') {
    return <RemoteControl />;
  }

  // ROUTING: LOGIN (If not authenticated, force login for studio)
  if (!user && viewState === 'studio') {
    if (showOnboarding) {
      return (
        <WelcomeAnimation
          onFinish={() => {
            localStorage.setItem('lumina_onboarding_v2.2.0', 'true');
            setShowOnboarding(false);
          }}
        />
      );
    }
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const ScheduleList = () => (
    <div className="flex-1 overflow-y-auto bg-zinc-950">
      {teamPlaylists.length > 0 && (<div className="px-3 py-2 text-[10px] text-emerald-400 border-b border-zinc-900">Cloud Playlists Synced: {teamPlaylists.length}</div>)}
      {schedule.map((item, idx) => (
        <div key={item.id} className="flex flex-col border-b border-zinc-900">
          <div onClick={() => {
            setSelectedItemId(item.id);
            if (viewMode === 'PRESENTER') {
              setBlackout(false);
              if (Array.isArray(item.slides) && item.slides.length > 0) {
                const currentIdx = activeItemId === item.id && activeSlideIndex >= 0 ? activeSlideIndex : 0;
                goLive(item, currentIdx);
              }
            }
          }} className={`px-3 py-3 cursor-pointer flex items-center justify-between group transition-colors ${selectedItemId === item.id ? 'bg-zinc-900 border-l-2 border-l-blue-600' : 'hover:bg-zinc-900/50 border-l-2 border-l-transparent'} ${activeItemId === item.id ? 'bg-red-950/20' : ''}`}>
            <div className="flex flex-col truncate flex-1 min-w-0 pr-2">
              <span className={`font-medium text-sm truncate ${activeItemId === item.id ? 'text-red-500' : 'text-zinc-300'}`}>{item.title}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1 flex items-center gap-1">{item.type}</span>
            </div>
            <div className="flex gap-1 items-center">
              {activeItemId === item.id && <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>}
              {viewMode === 'BUILDER' ? (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleArchiveSingleRunSheetItem(item.id); }}
                    className="p-1 hover:text-blue-300 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Move item to Run Sheet Files"
                  >
                    <CopyIcon className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className="p-1 hover:text-red-400 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"><TrashIcon className="w-4 h-4" /></button>
                </>
              ) : (
                <button onClick={(e) => { e.stopPropagation(); goLive(item); }} className={`p-1 transition-colors ${activeItemId === item.id ? 'text-red-500' : 'text-zinc-600 hover:text-white'}`}><PlayIcon className="w-4 h-4 fill-current" /></button>
              )}
            </div>
          </div>
          {selectedItemId === item.id && item.slides.length > 0 && (
            <div className="bg-zinc-950 border-b border-zinc-900">
              {item.slides.map((slide, sIdx) => (
                <div key={slide.id} className={`pl-8 pr-3 py-2 text-xs text-zinc-500 hover:text-zinc-200 cursor-pointer border-l-2 ${activeItemId === item.id && activeSlideIndex === sIdx ? 'text-red-400 font-bold border-l-red-600 bg-red-950/10' : 'border-l-transparent hover:bg-zinc-900/30'}`} onClick={(e) => { e.stopPropagation(); if (viewMode === 'PRESENTER') goLive(item, sIdx); }}>
                  <div className="flex justify-between items-center"><span className="truncate flex-1 font-mono text-[10px] opacity-80">{slide.label || `SLIDE ${sIdx + 1}`}</span>{activeItemId === item.id && activeSlideIndex === sIdx && <span className="text-[9px] uppercase tracking-widest text-red-600 font-bold">LIVE</span>}</div>
                  <div className="truncate opacity-70 mt-0.5 font-sans">{slide.content.substring(0, 40)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // ROUTING: STUDIO (MAIN APP)
  return (
    <div className={`theme-${workspaceSettings.theme} flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-zinc-950 text-zinc-200 font-sans selection:bg-blue-900 selection:text-white relative`}>
      <audio ref={antiSleepAudioRef} src={SILENT_AUDIO_B64} loop muted />
      {saveError && <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-4 py-2 rounded-sm shadow-xl z-50 flex items-center gap-3 text-xs font-bold animate-pulse"><span>⚠ STORAGE FULL: Changes are NOT saving.</span><button onClick={() => setSaveError(false)} className="hover:text-zinc-300">✕</button></div>}
      {syncIssue && <div className="absolute top-24 right-4 z-50 max-w-md bg-amber-950/90 border border-amber-800 text-amber-200 px-3 py-2 rounded-sm text-[11px]"><span className="font-bold">SYNC WARNING:</span> {syncIssue}</div>}
      {popupBlocked && <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4"><div className="bg-zinc-900 border border-red-500 p-6 max-w-md rounded-lg shadow-2xl text-center"><div className="text-red-500 mb-2"><MonitorIcon className="w-12 h-12 mx-auto" /></div><h2 className="text-xl font-bold text-white mb-2">Projection Blocked</h2><p className="text-zinc-400 text-sm mb-4">The browser blocked the projector window. Check address bar pop-up settings.</p><button onClick={() => { setPopupBlocked(false); setIsOutputLive(false); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold transition-colors">I Understand</button></div></div>}

      <header className="h-14 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 z-[100] shadow-xl">
        {/* LEFT: BRAND & MODES */}
        <div className="flex items-center gap-6">
          <div
            onClick={() => setViewState(isElectronShell ? 'studio' : 'landing')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-100 transition-all group"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/40 group-hover:scale-110 transition-transform">
              <span className="text-white font-black text-xs">L</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-[0.2em] leading-tight">LUMINA</span>
              <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Studio v2.1</span>
            </div>
          </div>

          <div className="h-6 w-px bg-zinc-800"></div>

          <div className="flex bg-black/40 p-1 rounded-xl border border-zinc-800/50">
            <button
              onClick={() => setViewMode('BUILDER')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${viewMode === 'BUILDER' ? 'bg-zinc-800 text-white shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              BUILD
            </button>
            <button
              onClick={() => setViewMode('PRESENTER')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${viewMode === 'PRESENTER' ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50' : 'text-zinc-600 hover:text-zinc-400'}`}
            >
              PRESENT
            </button>
          </div>

          <button
            onClick={rollbackLastChange}
            disabled={historyCount === 0}
            className="px-3 py-1.5 rounded-lg text-[10px] font-bold border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-20 disabled:grayscale transition-all flex items-center gap-2"
          >
            <ArrowLeftIcon className="w-3 h-3" /> ROLLBACK
          </button>
        </div>

        {/* MIDDLE: STATUS TELEMETRY */}
        <div className="hidden lg:flex items-center gap-4 bg-zinc-900/20 px-4 py-1.5 rounded-full border border-zinc-800/30">
          <div className="flex flex-col items-center">
            <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">Session ID</span>
            <span className="text-[10px] font-mono text-zinc-400">{liveSessionId}</span>
          </div>
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className={`text-[9px] font-black tracking-widest ${navigator.onLine ? 'text-emerald-500/80' : 'text-amber-500/80'}`}>
              {navigator.onLine ? 'SYSTEM ONLINE' : 'OFFLINE MODE'}
            </span>
          </div>
          {syncPendingCount > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-800"></div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-amber-500 animate-pulse tracking-widest">SYNCING {syncPendingCount}</span>
              </div>
            </>
          )}
          <div className="h-4 w-px bg-zinc-800"></div>
          <div className="flex items-center gap-2" title={`controller:${connectionCountsByRole.controller || 0} output:${connectionCountsByRole.output || 0} stage:${connectionCountsByRole.stage || 0} remote:${connectionCountsByRole.remote || 0}`}>
            <span className={`text-[9px] font-black tracking-widest ${activeTargetConnectionCount >= targetConnectionRoles.length ? 'text-emerald-400' : 'text-amber-400'}`}>
              LIVE CONNECTIONS {activeTargetConnectionCount}/{targetConnectionRoles.length}
            </span>
          </div>
        </div>

        {/* RIGHT: COMMAND CENTER */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/30 p-1 rounded-xl border border-zinc-800/40 gap-1 mr-2">
            <button
              onClick={() => {
                setConnectPanel('audience');
                setIsConnectOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95"
            >
              <QrCodeIcon className="w-3.5 h-3.5" /> CONNECT
            </button>
            <button
              onClick={() => {
                setConnectPanel('aether');
                setIsConnectOpen(true);
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/10 text-cyan-300 hover:bg-cyan-600/20 rounded-lg text-[10px] font-black tracking-widest transition-all active:scale-95"
            >
              <MonitorIcon className="w-3.5 h-3.5" /> AETHER
            </button>
            <button onClick={() => setIsAIModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-300 hover:text-white rounded-lg text-[10px] font-black tracking-widest transition-all">
              <SparklesIcon className="w-3 h-3 text-purple-400" /> AI ASSIST
            </button>
            <button
              onClick={() => setWorkspaceSettings(prev => ({ ...prev, machineMode: !prev.machineMode }))}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${workspaceSettings.machineMode ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50' : 'text-zinc-500 hover:bg-zinc-800'}`}
            >
              MACHINE
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleToggleOutput}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border shadow-lg ${isOutputLive ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-950/50' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
            >
              <MonitorIcon className="w-3.5 h-3.5" /> {isOutputLive ? 'PROJECTION ON' : 'LAUNCH LIVE'}
            </button>
            <button
              onClick={handleToggleStageDisplay}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all border shadow-lg ${isStageDisplayLive ? 'bg-purple-600 border-purple-500 text-white shadow-purple-950/50' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
            >
              STAGE
            </button>

            <button
              onClick={() => void copyShareUrl(remoteControlUrl, 'Remote Control URL copied!')}
              className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700"
              title="Copy Remote URL"
            >
              <CopyIcon className="w-4.5 h-4.5" />
            </button>
            <button
              onClick={() => void copyShareUrl(stageDisplayUrl, 'Stage URL copied!')}
              className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700"
              title="Copy Stage URL"
            >
              <MonitorIcon className="w-4.5 h-4.5" />
            </button>

            <button onClick={() => setIsProfileOpen(true)} className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all border border-transparent hover:border-zinc-700">
              <Settings className="w-4.5 h-4.5" />
            </button>

            <button onClick={() => setIsHelpOpen(true)} className="p-2.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-xl transition-all mr-2">
              <HelpIcon className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE NAV BAR (Visible only on small screens) */}
      {!isElectronShell && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50">
          <button onClick={() => setViewMode('BUILDER')} className={`flex flex-col items-center gap-1 ${viewMode === 'BUILDER' ? 'text-white' : 'text-zinc-500'}`}><EditIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">BUILD</span></button>
          <button onClick={() => setViewMode('PRESENTER')} className={`flex flex-col items-center gap-1 ${viewMode === 'PRESENTER' ? 'text-white' : 'text-zinc-500'}`}><PlayIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">PRESENT</span></button>
          <button onClick={handleToggleOutput} className={`flex flex-col items-center gap-1 ${isOutputLive ? 'text-emerald-400' : 'text-zinc-500'}`}><MonitorIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">OUTPUT</span></button>
        </div>
      )}

      <div className={`flex-1 flex overflow-hidden min-w-0 ${isElectronShell ? '' : 'mb-16 md:mb-0'}`}>
        {/* Sidebar with Tabs (Hidden on Mobile unless Builder Mode) */}
        <div className={`group flex flex-col h-full bg-zinc-900/50 border-r border-zinc-800 shrink-0 overflow-hidden z-20 ${isElectronShell ? 'w-12' : 'w-12 hover:w-48 transition-all'}`}>
          <div className="flex flex-col flex-1 p-1 gap-1">
            <button onClick={() => setActiveSidebarTab('SCHEDULE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'SCHEDULE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="SCHEDULE"><MonitorIcon className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Schedule</span></button>
            <button onClick={() => setActiveSidebarTab('FILES')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'FILES' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="RUN SHEET FILES"><CopyIcon className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Files</span></button>
            <button onClick={() => setActiveSidebarTab('AUDIO')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'AUDIO' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="AUDIO MIXER"><Volume2Icon className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Audio Mixer</span></button>
            <button onClick={() => setActiveSidebarTab('BIBLE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'BIBLE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="BIBLE LIBRARY"><BibleIcon className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Bible Hub</span></button>
            <button onClick={() => setActiveSidebarTab('AUDIENCE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'AUDIENCE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="AUDIENCE STUDIO"><ChatIcon className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Audience</span></button>
          </div>
          <div className="p-1 border-t border-zinc-800">
            <button onClick={() => setIsProfileOpen(true)} className="w-full p-2.5 rounded-sm flex items-center gap-3 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors" title="SETTINGS"><Settings className="w-5 h-5 shrink-0" /><span className="text-xs font-bold tracking-tight uppercase opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Settings</span></button>
          </div>
        </div>

        {/* SIDEBAR PANEL */}
        <div className={`flex flex-col bg-zinc-950 border-r border-zinc-900 shrink-0 ${isElectronShell ? 'w-80 min-w-[20rem]' : 'w-[calc(100vw-3rem)] max-w-80 md:w-80'}`}>
          {activeSidebarTab === 'SCHEDULE' && (
            <>
              <div className="p-3 border-b border-zinc-900 flex items-center justify-between shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Run Sheet</h3>
                <div className="flex gap-1">
                  <button onClick={() => setIsTemplateOpen(true)} className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-sm text-[9px] font-bold transition-all">TPL</button>
                  <button onClick={() => setIsLyricsImportOpen(true)} className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-sm text-[9px] font-bold transition-all">LYR</button>
                  <button onClick={addEmptyItem} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-sm transition-colors"><PlusIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <ScheduleList />
            </>
          )}
          {activeSidebarTab === 'FILES' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-zinc-900 shrink-0">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Run Sheet Files</h3>
              </div>
              <div className="p-3 border-b border-zinc-900 bg-zinc-900/20 space-y-2 shrink-0">
                <input
                  value={runSheetArchiveTitle}
                  onChange={(e) => setRunSheetArchiveTitle(e.target.value)}
                  placeholder="Archive title (optional)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleArchiveRunSheet(false)}
                    className="px-2 py-1.5 text-[10px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-200 hover:border-zinc-500"
                  >
                    Archive Current
                  </button>
                  <button
                    onClick={() => handleArchiveRunSheet(true)}
                    className="px-2 py-1.5 text-[10px] font-bold border border-zinc-700 rounded bg-blue-900/40 text-blue-200 hover:border-blue-500"
                  >
                    Archive + New
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={runSheetFileQuery}
                    onChange={(e) => setRunSheetFileQuery(e.target.value)}
                    placeholder="Search files..."
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                  />
                  <button
                    onClick={refreshRunSheetFiles}
                    className="px-2 py-1.5 text-[10px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300"
                  >
                    Refresh
                  </button>
                </div>
                {runSheetFilesError && (
                  <div className="text-[10px] text-rose-400 border border-rose-900/60 bg-rose-950/30 rounded px-2 py-1">
                    {runSheetFilesError}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-2">
                {runSheetFilesLoading && (
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Loading files...</div>
                )}
                {!runSheetFilesLoading && filteredRunSheetFiles.length === 0 && (
                  <div className="text-[10px] text-zinc-600 uppercase tracking-wider">No archived run sheets</div>
                )}
                {filteredRunSheetFiles.map((file) => (
                  <div key={file.fileId} className="border border-zinc-800 rounded p-2 bg-zinc-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-zinc-200 truncate">{file.title}</div>
                        <div className="text-[9px] text-zinc-500">
                          {new Date(file.updatedAt).toLocaleString()} • {(file.payload?.items || []).length} items
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      <button onClick={() => handleReuseRunSheet(file.fileId, 'replace')} className="px-2 py-1 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-200">Reuse</button>
                      <button onClick={() => handleReuseRunSheet(file.fileId, 'duplicate')} className="px-2 py-1 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Duplicate</button>
                      <button onClick={() => handleRenameRunSheet(file.fileId)} className="px-2 py-1 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Rename</button>
                      <button onClick={() => handleDeleteRunSheet(file.fileId)} className="px-2 py-1 text-[9px] font-bold border border-rose-900/70 rounded bg-rose-950/20 text-rose-300">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {activeSidebarTab === 'AUDIO' && <AudioLibrary currentTrackId={currentTrack?.id} isPlaying={isAudioPlaying} progress={audioProgress} onPlay={handlePlayTrack} onToggle={() => setIsAudioPlaying(!isAudioPlaying)} onStop={stopAudio} onVolumeChange={setAudioVolume} volume={audioVolume} />}
          {activeSidebarTab === 'BIBLE' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 border-b border-zinc-900 shrink-0"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Bible Hub</h3></div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
                <BibleBrowser
                  onProjectRequest={(item) => goLive(item)}
                  onAddRequest={addItem}
                  speechLocaleMode={workspaceSettings.visionarySpeechLocaleMode}
                  onSpeechLocaleModeChange={(mode) => setWorkspaceSettings((prev) => ({ ...prev, visionarySpeechLocaleMode: mode }))}
                />
              </div>
            </div>
          )}
          {activeSidebarTab === 'AUDIENCE' && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="p-3 border-b border-zinc-900 shrink-0"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Audience Studio</h3></div>
              <AudienceStudio
                workspaceId={workspaceId}
                user={user}
                onProjectRequest={(text, label) => {
                  handleProjectAudienceMessage(text, label);
                  setActiveSidebarTab('SCHEDULE');
                }}
                displayState={audienceDisplay}
                onUpdateDisplay={handleUpdateAudienceDisplay}
                stageAlert={stageAlert}
                stageMessageCenter={stageMessageCenter}
                onQueueStageMessage={handleQueueStageMessage}
                onSendStageMessageNow={handleSendStageMessageNow}
                onPromoteStageMessage={handlePromoteStageMessage}
                onRemoveQueuedStageMessage={handleRemoveQueuedStageMessage}
                onSendStageAlert={handleSendStageAlert}
                onClearStageAlert={handleClearStageAlert}
                canUseStageAlert={canUsePastorAlert}
              />
            </div>
          )}
        </div>

        {/* ... (Existing Builder/Presenter Logic) ... */}
        {
          viewMode === 'BUILDER' ? (
            <div className={`flex-1 flex bg-zinc-950 min-w-0 ${isElectronShell ? '' : 'hidden md:flex'}`}>
              <div className="w-56 bg-zinc-900/30 border-r border-zinc-900 flex flex-col hidden lg:flex">
                <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-600 text-[10px] uppercase tracking-wider flex items-center">Library</div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {MOCK_SONGS.map((song, i) => (<div key={i} className="p-2 bg-zinc-900 rounded-sm cursor-pointer hover:bg-zinc-800 border border-zinc-800/50" onClick={() => setIsAIModalOpen(true)}><div className="font-bold text-xs text-zinc-300">{song.title}</div></div>))}
                </div>
              </div>
              <div className="flex-1 bg-zinc-950 flex flex-col overflow-hidden">
                {selectedItem ? (
                  <>
                    <ItemEditorPanel
                      item={selectedItem}
                      onUpdate={updateItem}
                      onOpenLibrary={() => setIsMotionLibOpen(true)}
                      speakerPresets={workspaceSettings.speakerTimerPresets}
                    />
                    <div className="flex-1 overflow-y-auto p-6 bg-zinc-950">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {selectedItem.slides.map((slide, idx) => (
                          <div key={slide.id} className="group relative">
                            <div className="aspect-video bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 group-hover:border-blue-500/50 transition-all"><SlideRenderer slide={slide} item={selectedItem} fitContainer={true} isThumbnail={true} /></div>
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 flex gap-1"><button onClick={() => handleEditSlide(slide)} className="p-1 bg-zinc-900 border border-zinc-700 rounded-sm hover:text-blue-400 text-zinc-400"><EditIcon className="w-3 h-3" /></button><button onClick={(e) => handleDeleteSlide(slide.id, e)} className="p-1 bg-zinc-900 border border-zinc-700 rounded-sm hover:text-red-400 text-zinc-400"><TrashIcon className="w-3 h-3" /></button></div>
                          </div>
                        ))}
                        <button onClick={() => { setEditingSlide(null); setIsSlideEditorOpen(true); }} className="aspect-video border border-dashed border-zinc-800 rounded-sm flex flex-col items-center justify-center text-zinc-600 hover:text-zinc-400 bg-zinc-900/20"><PlusIcon className="w-6 h-6 mb-2" /><span className="text-xs font-medium uppercase tracking-wide">Add Slide</span></button>
                      </div>
                    </div>
                  </>
                ) : <div className="flex-1 flex items-center justify-center text-zinc-600 font-mono text-xs uppercase">SELECT_ITEM_TO_EDIT</div>}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col lg:flex-row bg-black min-w-0">
              <div className="flex-1 flex flex-col relative min-w-0">
                <div className={`flex-1 relative flex items-center bg-zinc-950 overflow-hidden border-r border-zinc-900 ${isElectronShell ? 'justify-start px-4' : 'justify-center'}`}>
                  <div className="aspect-video w-full max-w-4xl border border-zinc-800 bg-black relative group">
                    {blackout ? (<div className="w-full h-full bg-black flex items-center justify-center text-red-900 font-mono text-xs font-bold tracking-[0.2em]">BLACKOUT</div>) : (
                      <SlideRenderer
                        slide={activeSlide}
                        item={activeItem}
                        isPlaying={isPlaying}
                        seekCommand={seekCommand}
                        seekAmount={seekAmount}
                        isMuted={isPreviewMuted}
                        lowerThirds={lowerThirdsEnabled}
                        audienceOverlay={audienceDisplay}
                      />
                    )}
                    <div className="absolute top-0 left-0 bg-zinc-900 text-zinc-500 text-[9px] font-bold px-2 py-0.5 border-r border-b border-zinc-800 flex items-center gap-2 z-50 shadow-md">PREVIEW <button onClick={() => setIsPreviewMuted(!isPreviewMuted)} className={`ml-2 hover:text-white transition-colors ${isPreviewMuted ? 'text-red-400' : 'text-green-400'}`}>{isPreviewMuted ? <VolumeXIcon className="w-3 h-3" /> : <Volume2Icon className="w-3 h-3" />}</button></div>
                  </div>
                </div>
                <div className="relative border-t border-zinc-800 bg-zinc-900">
                  <div
                    ref={presenterControlsRef}
                    className="min-h-16 flex items-center px-3 md:px-6 gap-3 overflow-x-auto custom-scrollbar scroll-smooth"
                  >
                  <div className="flex items-center gap-2 shrink-0"><button onClick={prevSlide} className="h-12 w-14 rounded-sm bg-zinc-800 hover:bg-zinc-700 text-white flex items-center justify-center border border-zinc-700 active:scale-95 transition-transform"><ArrowLeftIcon className="w-5 h-5" /></button><button onClick={nextSlide} className="h-12 w-28 rounded-sm bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-bold text-sm tracking-wide active:scale-95 transition-transform"><ArrowRightIcon className="w-5 h-5 mr-1" /> NEXT</button></div>
                  {isActiveVideo && (<div className="flex items-center gap-2 bg-zinc-950 rounded-sm p-1 border border-zinc-800 shrink-0"><button onClick={() => triggerSeek(-10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><RewindIcon className="w-4 h-4" /></button><button onClick={() => setIsPlaying(!isPlaying)} className={`p-2.5 rounded-sm ${isPlaying ? 'bg-zinc-800 text-white' : 'bg-green-900/50 text-green-400'}`}>{isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 fill-current" />}</button><button onClick={() => triggerSeek(10)} className="p-2.5 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded-sm"><ForwardIcon className="w-4 h-4" /></button></div>)}
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { if (routingMode !== 'PROJECTOR') setLowerThirdsEnabled((prev) => !prev); }} title={routingMode === 'PROJECTOR' ? 'Projector mode keeps full-screen text (lower thirds disabled).' : 'Toggle lower thirds overlay'} className={`h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border ${lowerThirdsEnabled ? 'bg-blue-950 text-blue-400 border-blue-900' : 'bg-zinc-950 text-zinc-400 border-zinc-800'} ${routingMode === 'PROJECTOR' ? 'opacity-60 cursor-not-allowed' : ''}`}>LOWER THIRDS</button>
                    <select value={routingMode} onChange={(e) => setRoutingMode(e.target.value as any)} className="h-12 px-2 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs rounded-sm">
                      <option value="PROJECTOR">Projector</option>
                      <option value="STREAM">Stream</option>
                      <option value="LOBBY">Lobby</option>
                    </select>
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12">
                      <select value={timerMode} onChange={(e) => {
                        const mode = e.target.value as 'COUNTDOWN' | 'ELAPSED';
                        setTimerMode(mode);
                        setTimerRunning(false);
                        setCueZeroHold(false);
                        setTimerSeconds(mode === 'COUNTDOWN' ? effectiveTimerDurationSec : 0);
                      }} className="bg-transparent text-zinc-300 text-[10px]">
                        <option value="COUNTDOWN">Countdown</option>
                        <option value="ELAPSED">Elapsed</option>
                      </select>
                      {timerMode === 'COUNTDOWN' && (
                        <input type="number" min={1} max={180} value={timerDurationMin} onChange={(e) => {
                          applyManualCountdownMinutes(Number(e.target.value));
                        }} className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200" />
                      )}
                      <div className={`text-[11px] font-mono w-14 text-center ${isTimerOvertime ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>{formatTimer(timerSeconds)}</div>
                      <button onClick={() => {
                        setCueZeroHold(false);
                        setTimerRunning((p) => !p);
                      }} className="text-[10px] px-2 py-1 bg-zinc-800 rounded">{timerRunning ? 'Pause' : 'Start'}</button>
                      <button onClick={() => {
                        setTimerRunning(false);
                        setCueZeroHold(false);
                        setTimerSeconds(timerMode === 'COUNTDOWN' ? effectiveTimerDurationSec : 0);
                      }} className="text-[10px] px-2 py-1 bg-zinc-800 rounded">Reset</button>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12">
                      <span className="text-[10px] text-zinc-400">Cue</span>
                      <input
                        type="number"
                        min={2}
                        max={120}
                        value={autoCueSeconds}
                        onChange={(e) => {
                          const value = Math.max(2, Math.min(120, Number(e.target.value) || 2));
                          setAutoCueSeconds(value);
                          setAutoCueRemaining(value);
                        }}
                        className="w-12 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200"
                        title="Auto-cue seconds for next slide"
                      />
                      <button
                        onClick={() => setAutoCueEnabled((p) => !p)}
                        className={`text-[10px] px-2 py-1 rounded ${autoCueEnabled ? 'bg-cyan-900/40 text-cyan-300' : 'bg-zinc-800 text-zinc-300'}`}
                        title="Toggle auto-cue slide advance"
                      >
                        {autoCueEnabled ? `On ${autoCueRemaining}s` : 'Off'}
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12 max-w-[340px]">
                      <span className="text-[10px] text-zinc-400">Preset</span>
                      <select
                        value={selectedSpeakerPresetId}
                        onChange={(e) => setSelectedSpeakerPresetId(e.target.value)}
                        className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200"
                      >
                        {(workspaceSettings.speakerTimerPresets || []).map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={applySelectedPresetToCurrentCue}
                        disabled={!selectedSpeakerPresetId || !(currentCueItemId || selectedItemId)}
                        className="text-[10px] px-2 py-1 bg-zinc-800 rounded disabled:opacity-40"
                      >
                        Apply
                      </button>
                      <button
                        onClick={openCreatePresetModal}
                        className="text-[10px] px-2 py-1 bg-zinc-800 rounded"
                      >
                        Manage
                      </button>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12 max-w-[360px]">
                      <span className="text-[10px] text-zinc-400">Rundown</span>
                      <button
                        onClick={() => moveCueByOffset(-1, { autoStart: false, goLiveItem: true })}
                        disabled={!enabledTimerCues.length}
                        className="text-[10px] px-2 py-1 bg-zinc-800 rounded disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => moveCueByOffset(1, { autoStart: false, goLiveItem: true })}
                        disabled={!enabledTimerCues.length}
                        className="text-[10px] px-2 py-1 bg-zinc-800 rounded disabled:opacity-40"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => currentCue && activateCueByItemId(currentCue.itemId, { autoStart: false, goLiveItem: true })}
                        disabled={!currentCue}
                        className="text-[10px] px-2 py-1 bg-zinc-800 rounded disabled:opacity-40"
                      >
                        Load
                      </button>
                      <div className="text-[10px] text-zinc-300 truncate">
                        {currentCue
                          ? `${currentCueIndex + 1}/${enabledTimerCues.length} ${currentCue.itemTitle}${currentCue.cue.autoStartNext ? ' (auto)' : ''}`
                          : 'No timer cues enabled'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-sm px-2 h-12 max-w-[260px]">
                      <span className="text-[10px] text-zinc-400">Stage Grid</span>
                      <select
                        value={workspaceSettings.stageFlowLayout}
                        onChange={(e) => {
                          const next = e.target.value as StageFlowLayout;
                          setWorkspaceSettings((prev) => ({
                            ...prev,
                            stageFlowLayout: VALID_STAGE_FLOW_LAYOUTS.includes(next) ? next : 'balanced',
                          }));
                        }}
                        className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200"
                        title="Stage display layout flow"
                      >
                        <option value="balanced">Balanced</option>
                        <option value="speaker_focus">Speaker Focus</option>
                        <option value="preview_focus">Preview Focus</option>
                        <option value="minimal_next">Minimal Next</option>
                      </select>
                    </div>
                    <button onClick={() => void copyShareUrl(obsOutputUrl)} className="h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border bg-zinc-950 text-zinc-300 border-zinc-800 hover:text-white">COPY OBS URL</button>
                    <button onClick={() => void copyShareUrl(stageDisplayUrl)} className="h-12 px-3 rounded-sm font-bold text-[10px] tracking-wider border bg-zinc-950 text-zinc-300 border-zinc-800 hover:text-white">COPY STAGE URL</button>
                    <button onClick={() => setBlackout(!blackout)} className={`h-12 px-4 rounded-sm font-bold text-xs tracking-wider border active:scale-95 transition-all ${blackout ? 'bg-red-950 text-red-500 border-red-900' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'}`}>{blackout ? 'UNBLANK' : 'BLACKOUT'}</button>
                  </div>
                </div>
                {presenterControlsHasOverflow && (
                  <>
                    <div className={`pointer-events-none absolute top-0 left-0 h-16 w-14 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-transparent transition-opacity ${presenterControlsCanScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
                    <div className={`pointer-events-none absolute top-0 right-0 h-16 w-14 bg-gradient-to-l from-zinc-900 via-zinc-900/80 to-transparent transition-opacity ${presenterControlsCanScrollRight ? 'opacity-100' : 'opacity-0'}`} />
                    <button
                      onClick={() => scrollPresenterControlsBy(-320)}
                      disabled={!presenterControlsCanScrollLeft}
                      className="absolute left-1 top-8 -translate-y-1/2 h-7 w-7 rounded-full border border-zinc-700 bg-zinc-950/90 text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Scroll controls left"
                    >
                      <ArrowLeftIcon className="w-4 h-4 mx-auto" />
                    </button>
                    <button
                      onClick={() => scrollPresenterControlsBy(320)}
                      disabled={!presenterControlsCanScrollRight}
                      className="absolute right-1 top-8 -translate-y-1/2 h-7 w-7 rounded-full border border-zinc-700 bg-zinc-950/90 text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Scroll controls right"
                    >
                      <ArrowRightIcon className="w-4 h-4 mx-auto" />
                    </button>
                  </>
                )}
                {presenterControlsHasOverflow && (
                  <div className="px-3 md:px-6 pb-2 border-t border-zinc-800/80 bg-zinc-950/70 flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-bold shrink-0">Controls</span>
                    <button
                      onClick={() => scrollPresenterControlsBy(-320)}
                      disabled={!presenterControlsCanScrollLeft}
                      className="h-6 px-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] font-bold disabled:opacity-35"
                    >
                      Left
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(presenterControlsScrollPercent)}
                      onChange={(e) => handlePresenterControlsSliderChange(Number(e.target.value))}
                      className="flex-1 accent-blue-500"
                      aria-label="Presenter toolbar scroll position"
                    />
                    <button
                      onClick={() => scrollPresenterControlsBy(320)}
                      disabled={!presenterControlsCanScrollRight}
                      className="h-6 px-2 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] font-bold disabled:opacity-35"
                    >
                      Right
                    </button>
                    <button
                      onClick={openPresenterControlsHelp}
                      className="h-6 px-2 rounded border border-cyan-800 bg-cyan-950/30 text-cyan-200 text-[10px] font-bold"
                      title="How to use toolbar slider"
                    >
                      How to scroll
                    </button>
                  </div>
                )}
                {presenterControlsShowHint && presenterControlsHasOverflow && (
                  <div className="absolute bottom-full right-3 mb-2 z-20 max-w-xs rounded border border-blue-900 bg-blue-950/95 shadow-xl p-2">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-blue-300 font-bold">More controls available</div>
                    <div className="mt-1 text-[10px] text-blue-100 leading-relaxed">
                      This row scrolls sideways. Use the slider or arrows to reveal buttons like COPY OBS URL.
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        onClick={openPresenterControlsHelp}
                        className="px-2 py-1 rounded border border-blue-700 bg-blue-900/50 text-[10px] text-blue-100 font-bold"
                      >
                        Show help
                      </button>
                      <button
                        onClick={dismissPresenterControlsHint}
                        className="px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-[10px] text-zinc-200 font-bold"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                )}
                </div>
              </div>
              <div className={`w-full lg:w-72 bg-zinc-950 border-l border-zinc-900 flex flex-col h-64 lg:h-auto border-t lg:border-t-0 ${workspaceSettings.machineMode ? 'hidden' : (isElectronShell ? 'flex' : 'hidden md:flex')}`}>
                <div className="h-10 px-3 border-b border-zinc-900 font-bold text-zinc-500 text-[10px] uppercase tracking-wider flex justify-between items-center bg-zinc-950"><span>Live Queue</span>{activeItem && <span className="text-red-500 animate-pulse">* LIVE</span>}</div>
                {enabledTimerCues.length > 0 && (
                  <div className="px-2 py-2 border-b border-zinc-900 bg-zinc-950/60">
                    <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Rundown Cues</div>
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {enabledTimerCues.map((cue, idx) => (
                        <button
                          key={cue.itemId}
                          onClick={() => activateCueByItemId(cue.itemId, { autoStart: false, goLiveItem: true })}
                          className={`shrink-0 px-2 py-1 rounded border text-[9px] font-bold ${cue.itemId === currentCueItemId ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'}`}
                        >
                          {idx + 1}. {cue.itemTitle}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-3 grid grid-cols-3 lg:grid-cols-2 gap-2 content-start scroll-smooth">
                  {activeItem?.slides.map((slide, idx) => (<div key={slide.id} ref={activeSlideIndex === idx ? activeSlideRef : null} onClick={() => { setActiveSlideIndex(idx); setBlackout(false); setIsPlaying(true); }} className={`cursor-pointer rounded-sm overflow-hidden border transition-all relative aspect-video ${activeSlideIndex === idx ? 'ring-2 ring-red-500 border-red-500 opacity-100' : 'border-zinc-800 opacity-50 hover:opacity-80'}`}><div className="absolute inset-0 pointer-events-none"><SlideRenderer slide={slide} item={activeItem} fitContainer={true} isThumbnail={true} /></div><div className="absolute bottom-0 left-0 right-0 bg-black/80 text-zinc-300 text-[9px] px-1 py-0.5 font-mono truncate border-t border-zinc-800">{idx + 1}. {slide.label}</div></div>))}
                  {!activeItem && <div className="col-span-3 lg:col-span-2 text-center text-zinc-700 text-xs font-mono py-10 uppercase">NO_ACTIVE_ITEM</div>}
                </div>
              </div>
            </div>
          )
        }
      </div>

      {
        isOutputLive && (
          <OutputWindow
            title="Lumina Output (Projector)"
            externalWindow={outputWin}
            onClose={() => {
              setIsOutputLive(false);
              setOutputWin(null);
            }}
            onBlock={() => {
              setPopupBlocked(true);
              setIsOutputLive(false);
              setOutputWin(null);
            }}
          >
            <div className="h-screen w-screen bg-black overflow-hidden relative">
              {blackout ? (
                <div className="w-full h-full bg-black flex items-center justify-center text-red-900 font-mono text-xs font-bold tracking-[0.2em]">BLACKOUT</div>
              ) : (!activeItem || !activeSlide) ? (
                <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 font-mono text-xs font-bold tracking-[0.2em]">WAITING_FOR_LIVE_CONTENT</div>
              ) : (
                <SlideRenderer
                  slide={activeSlide}
                  item={activeItem}
                  fitContainer={true}
                  isPlaying={isPlaying}
                  seekCommand={seekCommand}
                  seekAmount={seekAmount}
                  isMuted={outputMuted}
                  isProjector={true}
                  lowerThirds={routingMode !== 'PROJECTOR'}
                  showSlideLabel={true}
                  showProjectorHelper={false}
                  audienceOverlay={audienceDisplay}
                  projectedAudienceQr={audienceQrProjection}
                />
              )}
            </div>
          </OutputWindow>
        )
      }

      {
        isStageDisplayLive && (
          <OutputWindow
            title="Lumina Stage Display"
            externalWindow={stageWin}
            onClose={() => {
              setIsStageDisplayLive(false);
              setStageWin(null);
            }}
            onBlock={() => {
              setPopupBlocked(true);
              setIsStageDisplayLive(false);
              setStageWin(null);
            }}
          >
            <StageDisplay
              currentSlide={activeSlide}
              nextSlide={nextSlidePreview}
              activeItem={activeItem}
              timerLabel={currentCueSpeaker ? `${currentCueSpeaker} Timer` : 'Pastor Timer'}
              timerDisplay={formatTimer(timerSeconds)}
              timerMode={timerMode}
              isTimerOvertime={isTimerOvertime}
              timerRemainingSec={timerSeconds}
              timerDurationSec={effectiveTimerDurationSec}
              timerAmberPercent={currentCueAmberPercent}
              timerRedPercent={currentCueRedPercent}
              timerLayout={workspaceSettings.stageTimerLayout}
              onTimerLayoutChange={(layout) => {
                setWorkspaceSettings((prev) => ({ ...prev, stageTimerLayout: layout }));
              }}
              stageAlertLayout={workspaceSettings.stageAlertLayout}
              onStageAlertLayoutChange={(layout) => {
                setWorkspaceSettings((prev) => ({ ...prev, stageAlertLayout: layout }));
              }}
              profile={workspaceSettings.stageProfile}
              flowLayout={workspaceSettings.stageFlowLayout}
              audienceOverlay={audienceDisplay}
              stageAlert={stageAlert}
              stageMessageCenter={stageMessageCenter}
            />
          </OutputWindow>
        )
      }

      {
        isTemplateOpen && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-1">Apply Service Template</h3>
              <p className="text-xs text-zinc-500 mb-4">Replaces the current run sheet.</p>
              <div className="grid grid-cols-1 gap-2 mb-4">
                <button onClick={() => applyTemplate('CLASSIC')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Classic Sunday</div><div className="text-[11px] text-zinc-500">Welcome + Worship + Message</div></button>
                <button onClick={() => applyTemplate('YOUTH')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Youth Night</div><div className="text-[11px] text-zinc-500">Countdown + Hype + Response</div></button>
                <button onClick={() => applyTemplate('PRAYER')} className="text-left px-3 py-2 border border-zinc-800 rounded hover:border-zinc-600"><div className="text-sm font-semibold">Prayer Service</div><div className="text-[11px] text-zinc-500">Reflection + Intercession</div></button>
              </div>
              <div className="flex justify-end">
                <button onClick={() => setIsTemplateOpen(false)} className="px-3 py-1.5 text-xs border border-zinc-700 rounded">Close</button>
              </div>
            </div>
          </div>
        )
      }

      {
        isLyricsImportOpen && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <h3 className="text-sm font-bold text-zinc-200 mb-1">Import Lyrics</h3>
              <p className="text-xs text-zinc-500 mb-4">Paste lyrics with blank lines or import a PowerPoint/PDF deck as visual slides.</p>
              <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="w-full mb-3 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm" placeholder="Song title" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                  <span className="font-semibold">Retain Exact Layout (.pptx/.pdf Visual)</span>
                  <input type="file" accept=".pptx,.ppt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointVisualAsItem} disabled={isImportingDeck} />
                  <div className="text-[10px] text-zinc-500 mt-1">Keeps original design/background exactly. PDF is a strong fallback when PPTX fonts mismatch.</div>
                </label>
                <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                  <span className="font-semibold">Use Lumina Theme (.pptx Text)</span>
                  <input type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointTextAsItem} disabled={isImportingDeck} />
                  <div className="text-[10px] text-zinc-500 mt-1">Imports text/notes so you can style with Lumina backgrounds.</div>
                </label>
              </div>
              {importDeckStatus && <div className="mb-2 text-[11px] text-cyan-300 border border-cyan-900/60 bg-cyan-950/20 rounded px-3 py-2">{importDeckStatus}</div>}
              <textarea value={importLyrics} onChange={(e) => setImportLyrics(e.target.value)} className="w-full h-56 bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono" placeholder={'Verse 1 line 1\nVerse 1 line 2\n\nChorus line 1\nChorus line 2'} />
              {importModalError && <div className="mt-2 text-xs text-red-400 border border-red-900/60 bg-red-950/30 rounded px-3 py-2">{importModalError}</div>}
              <div className="flex justify-between mt-4">
                <button onClick={() => { setIsLyricsImportOpen(false); setImportModalError(null); setImportDeckStatus(''); }} className="px-3 py-1.5 text-xs border border-zinc-700 rounded" disabled={isImportingDeck}>Cancel</button>
                <button onClick={importLyricsAsItem} className="px-4 py-1.5 text-xs font-bold bg-blue-600 rounded" disabled={isImportingDeck}>Import Lyrics</button>
              </div>
            </div>
          </div>
        )
      }

      {isPresetModalOpen && (
        <div className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200">Speaker Timer Presets</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={openCreatePresetModal}
                  className="px-2 py-1 text-[10px] font-bold border border-zinc-700 rounded bg-zinc-800 text-zinc-200"
                >
                  New
                </button>
                <button
                  onClick={() => setIsPresetModalOpen(false)}
                  className="px-2 py-1 text-[10px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <div className="border-r border-zinc-800 p-3 max-h-[65vh] overflow-y-auto custom-scrollbar space-y-2">
                {(workspaceSettings.speakerTimerPresets || []).map((preset) => (
                  <div key={preset.id} className="p-2 border border-zinc-800 rounded bg-zinc-950/60">
                    <div className="text-xs font-bold text-zinc-200">{preset.name}</div>
                    <div className="text-[10px] text-zinc-500">
                      {Math.max(1, Math.round(preset.durationSec / 60))}m • Amber {preset.amberPercent}% • Red {preset.redPercent}%
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <button onClick={() => openEditPresetModal(preset)} className="px-2 py-1 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Edit</button>
                      <button onClick={() => deleteSpeakerPreset(preset.id)} className="px-2 py-1 text-[9px] font-bold border border-rose-900/70 rounded bg-rose-950/20 text-rose-300">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 space-y-2">
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
                  {editingPresetId ? 'Edit Preset' : 'Create Preset'}
                </div>
                <input
                  value={presetDraft.name}
                  onChange={(e) => setPresetDraft((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Preset name"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                />
                <input
                  value={presetDraft.speakerName || ''}
                  onChange={(e) => setPresetDraft((prev) => ({ ...prev, speakerName: e.target.value }))}
                  placeholder="Default speaker name"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={10}
                    max={7200}
                    value={presetDraft.durationSec}
                    onChange={(e) => setPresetDraft((prev) => ({ ...prev, durationSec: Math.max(10, Math.min(7200, Number(e.target.value) || 10)) }))}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                    title="Duration (sec)"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={presetDraft.amberPercent}
                    onChange={(e) => setPresetDraft((prev) => ({ ...prev, amberPercent: clamp(Number(e.target.value) || 25, 1, 99) }))}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                    title="Amber %"
                  />
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={presetDraft.redPercent}
                    onChange={(e) => setPresetDraft((prev) => ({ ...prev, redPercent: clamp(Number(e.target.value) || 10, 1, 99) }))}
                    className="bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-[11px] text-zinc-200"
                    title="Red %"
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                  <input
                    type="checkbox"
                    checked={!!presetDraft.autoStartNextDefault}
                    onChange={(e) => setPresetDraft((prev) => ({ ...prev, autoStartNextDefault: e.target.checked }))}
                    className="accent-blue-600"
                  />
                  Auto-start next cue by default
                </label>
                <div className="pt-1 flex items-center justify-end gap-2">
                  <button onClick={savePresetDraft} className="px-3 py-1.5 text-[10px] font-bold rounded border border-blue-600 bg-blue-600/30 text-blue-200">
                    Save Preset
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      {isPresenterControlsHelpOpen && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100">Presenter Control Slider Help</h3>
              <button
                onClick={() => {
                  setIsPresenterControlsHelpOpen(false);
                  markPresenterControlsHintSeen();
                }}
                className="px-2 py-1 rounded border border-zinc-700 bg-zinc-900 text-zinc-300 text-[11px] font-bold"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3 text-[12px] leading-relaxed text-zinc-300">
              <p>
                The bottom presenter row is horizontally scrollable. Some actions are to the far right, including
                <span className="font-bold text-zinc-100"> COPY OBS URL</span>, <span className="font-bold text-zinc-100">COPY STAGE URL</span>, and <span className="font-bold text-zinc-100">BLACKOUT</span>.
              </p>
              <p>Use any of these methods:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Click the left/right arrow buttons beside the toolbar.</li>
                <li>Drag the Controls slider under the toolbar.</li>
                <li>On trackpad/mouse, scroll horizontally (Shift + mouse wheel also works).</li>
              </ul>
            </div>
            <div className="px-4 py-3 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => {
                  setIsPresenterControlsHelpOpen(false);
                  markPresenterControlsHintSeen();
                }}
                className="px-3 py-1.5 rounded border border-blue-700 bg-blue-900/40 text-blue-100 text-[11px] font-bold"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
      <ConnectModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        initialPanel={connectPanel}
        audienceUrl={audienceUrl}
        obsOutputUrl={obsOutputUrl}
        stageDisplayUrl={stageDisplayUrl}
        remoteControlUrl={remoteControlUrl}
        isProjected={audienceQrProjection.visible}
        onSetProjected={setAudienceQrProjectionVisible}
        projectionScale={audienceQrProjection.scale}
        onSetProjectionScale={setAudienceQrProjectionScale}
        aetherBridgeEnabled={workspaceSettings.aetherBridgeEnabled}
        onSetAetherBridgeEnabled={(enabled) => setWorkspaceSettings((prev) => ({ ...prev, aetherBridgeEnabled: enabled }))}
        aetherBridgeAutoSync={workspaceSettings.aetherBridgeAutoSync}
        onSetAetherBridgeAutoSync={(enabled) => setWorkspaceSettings((prev) => ({ ...prev, aetherBridgeAutoSync: enabled }))}
        aetherBridgeUrl={workspaceSettings.aetherBridgeUrl}
        onSetAetherBridgeUrl={(url) => setWorkspaceSettings((prev) => ({ ...prev, aetherBridgeUrl: url }))}
        aetherBridgeToken={aetherBridgeToken}
        onSetAetherBridgeToken={setAetherBridgeToken}
        aetherSceneProgram={workspaceSettings.aetherSceneProgram}
        onSetAetherSceneProgram={(value) => setWorkspaceSettings((prev) => ({ ...prev, aetherSceneProgram: value }))}
        aetherSceneBlackout={workspaceSettings.aetherSceneBlackout}
        onSetAetherSceneBlackout={(value) => setWorkspaceSettings((prev) => ({ ...prev, aetherSceneBlackout: value }))}
        aetherSceneLobby={workspaceSettings.aetherSceneLobby}
        onSetAetherSceneLobby={(value) => setWorkspaceSettings((prev) => ({ ...prev, aetherSceneLobby: value }))}
        onAetherBridgePing={handleAetherBridgeTest}
        onAetherBridgeSyncNow={handleAetherBridgeSyncNow}
        onAetherSceneSwitch={handleAetherSceneSwitch}
        aetherBridgeStatusTone={aetherBridgeStatus.tone}
        aetherBridgeStatusText={aetherBridgeStatus.text}
      />
      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIItemGenerated} />
      {isProfileOpen && <ProfileSettings onClose={() => setIsProfileOpen(false)} onSave={(settings) => setWorkspaceSettings((prev) => ({ ...prev, ...settings }))} onLogout={handleLogout} currentSettings={workspaceSettings} currentUser={user} />}
      {
        isMotionLibOpen && (
          <MotionLibrary
            onClose={() => setIsMotionLibOpen(false)}
            onSelect={(url, mediaType = 'video') => {
              if (selectedItem) {
                updateItem({ ...selectedItem, theme: { ...selectedItem.theme, backgroundUrl: url, mediaType } });
                logActivity(user?.uid, 'UPDATE_THEME', { type: 'MOTION_BG', itemId: selectedItem.id, mediaType });
              }
              setIsMotionLibOpen(false);
            }}
          />
        )
      }
      <SlideEditorModal
        isOpen={isSlideEditorOpen}
        onClose={() => setIsSlideEditorOpen(false)}
        slide={editingSlide}
        onSave={handleSaveSlideFromEditor}
        onImportPowerPointVisual={importPowerPointVisualSlidesForSlideEditor}
        onImportPowerPointText={importPowerPointTextSlidesForSlideEditor}
        onInsertSlides={handleInsertSlidesFromEditor}
      />
    </div >
  );
}

export default App;
