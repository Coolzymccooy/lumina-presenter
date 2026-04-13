import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_SCHEDULE, MOCK_SONGS, DEFAULT_BACKGROUNDS, VIDEO_BACKGROUNDS, GOSPEL_TRACKS, GospelTrack } from './constants';
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
  StageTimerFlashColor,
  StageTimerFlashState,
  ConnectionRole,
  StageMessage,
  StageMessageCategory,
  StageMessageCenterState,
  SpeakerTimerPreset,
  StageFlowLayout,
  ServiceItemBackgroundSource,
} from './types';
import { SlideRenderer } from './components/SlideRenderer';
import { AIModal } from './components/AIModal';
import { ItemEditorPanel, type QuickBackgroundSelection } from './components/ItemEditorPanel';
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
import { DisplaySetupModal, type DesktopDisplayCard } from './components/DisplaySetupModal';
import { OutputRoute } from './components/OutputRoute';
import { StageRoute } from './components/StageRoute';
import { HymnLibrary } from './components/HymnLibrary';
import { StageDisplay } from './components/StageDisplay';
import { RemoteControl } from './components/RemoteControl';
import { SmartSlideEditor } from './components/slide-layout/editor/SmartSlideEditor';
import { ContextMenu, type ContextMenuAction } from './components/presenter/ContextMenu';
import { HoldScreen } from './components/presenter/HoldScreen';
import { LibraryTray } from './components/presenter/LibraryTray';
import { LivePane } from './components/presenter/LivePane';
import { PresenterOpsBar } from './components/presenter/PresenterOpsBar';
import { PresenterShell } from './components/presenter/PresenterShell';
import { PreviewPane } from './components/presenter/PreviewPane';
import { SchedulePane } from './components/presenter/SchedulePane';
import type { HoldScreenMode, PresenterExperience, PresenterFocusArea, PresenterLayoutPrefs, PresenterLibraryTab } from './components/presenter/types';
import { logActivity, analyzeSentimentContext } from './services/analytics';
import { auth, isFirebaseConfigured, subscribeToState, subscribeToTeamPlaylists, updateLiveState, upsertTeamPlaylist } from './services/firebase';
import { onAuthStateChanged } from "firebase/auth";
import { clearMediaCache, findSavedBackgroundBySourceUrl, getMediaBinary, markSavedBackgroundUsed, registerSavedBackground, saveBackgroundAsset, saveMedia } from './services/localMedia';
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
  saveWorkspaceSnapshot,
  submitAudienceMessage,
  uploadWorkspaceMedia,
} from './services/serverApi';
import { parsePptxFile } from './services/pptxImport';
import { parseEasyWorshipFile } from './services/easyWorshipImport';
import { parseProPresenterFile } from './services/proPresenterImport';
import { parseOpenSongFile } from './services/openSongImport';
import { parseOpenLyricsFile } from './services/openLyricsImport';
import { generateSlidesFromHymn } from './services/hymnGenerator';
import { storeCcliCredentials, getCcliCredentials, setCcliActor } from './services/ccliService';
import { initCcliProvider } from './services/ccliCatalogProvider';
import { copyTextToClipboard } from './services/clipboardService';
import { dispatchAetherBridgeEvent, type AetherBridgeEvent } from './services/aetherBridge';
import { isMotionUrl } from './services/motionEngine';
import { setUserDefaultBackground, getUserDefaultBackgroundSnapshot, getDefaultBgTheme } from './services/userBackgroundPreference';
import { MacroPanel } from './components/MacroPanel';
import { BuilderPreviewPanel } from './components/builder/BuilderPreviewPanel';
import { StageWorkspace } from './components/builder/StageWorkspace';
import { SermonRecorderPanel } from './components/SermonRecorderPanel';
import type { SermonSummary } from './services/sermonSummaryService';
import { FilesPanel } from './components/builder/FilesPanel';
import { subscribeMacros, seedStarterMacrosIfEmpty } from './services/macroRegistry';
import { archiveSermon, getArchivedSermons, deleteArchivedSermon, type ArchivedSermon } from './services/sermonArchive';
import type { MacroDefinition, MacroAuditEntry } from './types/macros';
import { matchTriggers, type MacroExecutionContext } from './services/macroEngine';
import { timerChimeService } from './services/timerChimeService';
import { nanoid } from 'nanoid';
import { STARTER_MACROS } from './seed/starterMacros';
import {
  type BackgroundSnapshot,
  clearItemBackgroundFallback,
  getBackgroundSnapshotFromItem,
  inheritPrevailingBackground,
  stampItemBackgroundSource,
} from './services/backgroundPersistence';
import {
  areBibleGeneratedItemsVisuallyEqual,
  isBibleGeneratedItem,
  mergeBibleGeneratedItem,
} from './services/bibleItemStability';
import { isProjectionSafeBackgroundUrl } from './services/mediaUrlStability';
import type { RunSheetInsertionResult } from './services/runSheetInsertion';
import { PlayIcon, PauseIcon, RewindIcon, ForwardIcon, PlusIcon, MonitorIcon, SparklesIcon, EditIcon, TrashIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, ArrowDownIcon, HelpIcon, VolumeXIcon, Volume2Icon, MusicIcon, BibleIcon, Settings, ChatIcon, QrCodeIcon, CopyIcon, CheckIcon, XIcon, PinIcon, MinimizeIcon, MaximizeIcon } from './components/Icons'; // Added ChatIcon, QrCodeIcon, CopyIcon, RewindIcon, ForwardIcon, PauseIcon
import { AppHeader } from './components/layout/AppHeader';
import { RightDock } from './components/layout/RightDock';

// --- CONSTANTS ---
const STORAGE_KEY = 'lumina_session_v1';
const SETTINGS_KEY = 'lumina_workspace_settings_v1';
const SETTINGS_UPDATED_AT_KEY = 'lumina_workspace_settings_updated_at_v1';
const SETTINGS_INTENT_KEY = 'lumina_workspace_settings_intent_v1';
const LIVE_STATE_QUEUE_KEY = 'lumina_live_state_queue_v1';
const SYNC_GUIDANCE_DISMISSALS_KEY = 'lumina_sync_guidance_dismissals_v1';
const PRESENTER_LAYOUT_KEY_PREFIX = 'lumina_presenter_layout_v1';
const RUNSHEET_FILES_LOCAL_KEY_PREFIX = 'lumina_runsheet_files_local_v1';
const AETHER_TOKEN_KEY_PREFIX = 'lumina_aether_bridge_token_v1';
const DISPLAY_MAPPING_KEY = 'lumina_display_mapping_v1';
const CLOUD_PLAYLIST_SUFFIX = 'default-playlist-v2';
const SYNC_BACKOFF_BASE_MS = 5000;
const SYNC_BACKOFF_MAX_MS = 60000;
const MAX_LIVE_QUEUE_SIZE = 40;
const SILENT_AUDIO_B64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASCCOkiJAAAAAAAAAAAAAAAAAAAAAAA=";
const PUBLIC_WEB_APP_ORIGIN = 'https://luminalive.co.uk';
const getWorkspaceSettingsKey = (workspace: string) => `${SETTINGS_KEY}:${workspace || 'default-workspace'}`;
const getWorkspaceSettingsUpdatedAtKey = (workspace: string) => `${SETTINGS_UPDATED_AT_KEY}:${workspace || 'default-workspace'}`;
const getWorkspaceSettingsIntentKey = (workspace: string) => `${SETTINGS_INTENT_KEY}:${workspace || 'default-workspace'}`;
const getAetherTokenKey = (workspace: string) => `${AETHER_TOKEN_KEY_PREFIX}:${workspace || 'default-workspace'}`;

type SyncGuidanceDismissals = Record<string, number>;
type DisplayRole = 'control' | 'audience' | 'stage' | 'none';
type DesktopServiceState = {
  controlDisplayId: number | null;
  audienceDisplayId: number | null;
  stageDisplayId: number | null;
  outputOpen: boolean;
  stageOpen: boolean;
};
type DesktopDisplayInfo = {
  id: number;
  key: string;
  name: string;
  isPrimary: boolean;
  isInternal: boolean;
  scaleFactor: number;
  rotation: number;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
};
type DesktopDisplayMappingEntry = {
  role: DisplayRole;
  displayId: number | null;
  displayKey: string;
};
type DesktopDisplayMapping = {
  assignments: DesktopDisplayMappingEntry[];
  updatedAt: number;
};

const DEFAULT_DESKTOP_SERVICE_STATE: DesktopServiceState = {
  controlDisplayId: null,
  audienceDisplayId: null,
  stageDisplayId: null,
  outputOpen: false,
  stageOpen: false,
};

const readDesktopDisplayMapping = (): DesktopDisplayMapping => {
  if (typeof window === 'undefined') {
    return { assignments: [], updatedAt: 0 };
  }
  try {
    const raw = window.localStorage.getItem(DISPLAY_MAPPING_KEY);
    if (!raw) return { assignments: [], updatedAt: 0 };
    const parsed = JSON.parse(raw) as DesktopDisplayMapping;
    const assignments = Array.isArray(parsed?.assignments)
      ? parsed.assignments
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const role = String((entry as DesktopDisplayMappingEntry).role || '').trim().toLowerCase();
          if (role !== 'control' && role !== 'audience' && role !== 'stage' && role !== 'none') return null;
          const displayId = Number((entry as DesktopDisplayMappingEntry).displayId || 0);
          return {
            role: role as DisplayRole,
            displayId: Number.isFinite(displayId) && displayId > 0 ? displayId : null,
            displayKey: String((entry as DesktopDisplayMappingEntry).displayKey || '').trim(),
          };
        })
        .filter((entry): entry is DesktopDisplayMappingEntry => !!entry)
      : [];
    return {
      assignments,
      updatedAt: typeof parsed?.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
    };
  } catch {
    return { assignments: [], updatedAt: 0 };
  }
};

const writeDesktopDisplayMapping = (mapping: DesktopDisplayMapping) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISPLAY_MAPPING_KEY, JSON.stringify(mapping));
  } catch {
    // ignore local storage write failures
  }
};

const readSyncGuidanceDismissals = (): SyncGuidanceDismissals => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SYNC_GUIDANCE_DISMISSALS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SyncGuidanceDismissals;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeSyncGuidanceDismissals = (value: SyncGuidanceDismissals) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYNC_GUIDANCE_DISMISSALS_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage persistence failures.
  }
};

const buildSyncGuidanceStorageKey = (workspace: string | null | undefined, userId: string | null | undefined, issueId: string) => {
  return `${workspace || 'default-workspace'}::${userId || 'anonymous'}::${issueId}`;
};

const normalizeSyncIssueId = (issue: string) => {
  return issue
    .trim()
    .toLowerCase()
    .replace(/retry in \d+s/g, 'retry-in-seconds')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'generic-sync-issue';
};

type WorkspaceSettings = {
  churchName: string;
  ccli: string;
  defaultVersion: string;
  visionarySpeechLocaleMode: 'auto' | 'en-GB' | 'en-US';
  theme: 'dark' | 'light' | 'midnight';
  presenterExperience: PresenterExperience;
  remoteAdminEmails: string;
  sessionId: string;
  stageProfile: 'classic' | 'compact' | 'high_contrast';
  stageFlowLayout: StageFlowLayout;
  machineMode: boolean;
  stageTimerLayout: StageTimerLayout;
  stageAlertLayout: StageAlertLayout;
  connectionTargetRoles: ConnectionRole[];
  speakerTimerPresets: SpeakerTimerPreset[];
  timerChimesEnabled: boolean;
  aetherBridgeEnabled: boolean;
  aetherBridgeAutoSync: boolean;
  aetherBridgeUrl: string;
  aetherRoomId: string;
  aetherSceneProgram: string;
  aetherSceneBlackout: string;
  aetherSceneLobby: string;
  slideBrandingEnabled: boolean;
  slideBrandingSeriesLabel: string;
  slideBrandingStyle: 'minimal' | 'bold' | 'frosted';
  slideBrandingOpacity: number;
  ndiSources: NdiSourceConfig[];
};

type NdiSourceConfig = {
  id: string;
  name: string;
  sceneId: string;
};

type ProtectedWorkspaceFieldKey = 'remoteAdminEmails' | 'sessionId';
type WorkspaceSettingsIntentMetadata = Partial<Record<ProtectedWorkspaceFieldKey, {
  value: string;
  updatedAt: number;
}>>;

type AetherBridgeStatusTone = 'neutral' | 'ok' | 'error';
type DesktopUpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';

type DesktopUpdateStatus = {
  state: DesktopUpdateState;
  version?: string | null;
  progress?: number;
  message?: string;
  releaseName?: string | null;
};

type PresenterContextMenuState =
  | {
      type: 'schedule';
      x: number;
      y: number;
      itemId: string;
    }
  | {
      type: 'preview-slide' | 'live-slide';
      x: number;
      y: number;
      itemId: string;
      slideIndex: number;
    }
  | null;

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
  holdScreenMode?: HoldScreenMode;
  stageAlert?: StageAlertState;
  stageMessageCenter?: StageMessageCenterState;
  audienceQrProjection?: AudienceQrProjectionState;
  stageTimerFlash?: StageTimerFlashState;
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

type HydrationStudioState = {
  schedule: ServiceItem[];
  selectedItemId: string;
  activeItemId: string | null;
  activeSlideIndex: number;
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
const VALID_STAGE_TIMER_FLASH_COLORS: StageTimerFlashColor[] = ['white', 'amber', 'red', 'cyan'];
const DEFAULT_PRESENTER_LAYOUT_PREFS: PresenterLayoutPrefs = {
  leftPaneWidth: 340,
  rightPaneWidth: 356,
  bottomTrayHeight: 252,
};

const sanitizePresenterExperience = (_value: unknown): PresenterExperience => (
  'classic'
);

const sanitizeHoldScreenMode = (value: unknown): HoldScreenMode => (
  value === 'clear' || value === 'logo' ? value : 'none'
);

const getPresenterLayoutStorageKey = (workspace: string, desktop: boolean) => (
  `${PRESENTER_LAYOUT_KEY_PREFIX}:${workspace || 'default-workspace'}:${desktop ? 'desktop' : 'web'}`
);

const clampPresenterLayoutPrefs = (value: Partial<PresenterLayoutPrefs> | null | undefined): PresenterLayoutPrefs => ({
  leftPaneWidth: clamp(Number(value?.leftPaneWidth || DEFAULT_PRESENTER_LAYOUT_PREFS.leftPaneWidth), 248, 460),
  rightPaneWidth: clamp(Number(value?.rightPaneWidth || DEFAULT_PRESENTER_LAYOUT_PREFS.rightPaneWidth), 280, 460),
  bottomTrayHeight: clamp(Number(value?.bottomTrayHeight || DEFAULT_PRESENTER_LAYOUT_PREFS.bottomTrayHeight), 180, 360),
});

const readPresenterLayoutPrefs = (workspace: string, desktop: boolean): PresenterLayoutPrefs => {
  if (typeof window === 'undefined') return DEFAULT_PRESENTER_LAYOUT_PREFS;
  try {
    const raw = window.localStorage.getItem(getPresenterLayoutStorageKey(workspace, desktop));
    if (!raw) return DEFAULT_PRESENTER_LAYOUT_PREFS;
    return clampPresenterLayoutPrefs(JSON.parse(raw) as PresenterLayoutPrefs);
  } catch {
    return DEFAULT_PRESENTER_LAYOUT_PREFS;
  }
};

const areServiceItemCollectionsEqual = (
  left: ServiceItem[] | null | undefined,
  right: ServiceItem[] | null | undefined
) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

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
    || normalized.includes('/video/');
};

const isRemoteMediaUrl = (url: string): boolean => /^https?:\/\//i.test(String(url || '').trim());
const isBlobMediaUrl = (url: string): boolean => /^blob:/i.test(String(url || '').trim());
const isDataMediaUrl = (url: string): boolean => /^data:/i.test(String(url || '').trim());

const extensionFromMimeType = (mimeType: string, mediaType: 'image' | 'video'): string => {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('mp4')) return 'mp4';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('quicktime') || normalized.includes('mov')) return 'mov';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('webp')) return 'webp';
  return mediaType === 'video' ? 'mp4' : 'jpg';
};

const inferRemoteMediaFileName = (sourceUrl: string, mediaType: 'image' | 'video', mimeType = ''): string => {
  try {
    const parsed = new URL(sourceUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const cleanSegment = lastSegment.replace(/[^a-z0-9._-]/gi, '').trim();
    if (cleanSegment && /\.[a-z0-9]{2,5}$/i.test(cleanSegment)) return cleanSegment;
    if (cleanSegment) return `${cleanSegment}.${extensionFromMimeType(mimeType, mediaType)}`;
  } catch {
    // fall through to generated name
  }
  return `remote-${mediaType}-${Date.now()}.${extensionFromMimeType(mimeType, mediaType)}`;
};

const BUILT_IN_BACKGROUND_URLS = new Set([...DEFAULT_BACKGROUNDS, ...VIDEO_BACKGROUNDS]);
const QUICK_BG_CATEGORY_LABELS = ['Worship', 'Church', 'Celebration', 'Cross', 'Nature', 'Abstract', 'Fire', 'Water', 'Stars', 'Sunrise'] as const;

const normalizeBackgroundCategory = (value: string): string => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return 'Used';
  const directMatch = QUICK_BG_CATEGORY_LABELS.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
  if (directMatch) return directMatch;
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1).toLowerCase())
    .join(' ') || 'Used';
};

const isBuiltInBackgroundUrl = (url: string): boolean => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  return BUILT_IN_BACKGROUND_URLS.has(trimmed) || trimmed.startsWith('/assets/');
};

const inferSavedBackgroundProvider = (
  sourceUrl: string,
  backgroundUrl: string,
  explicitProvider = '',
): string => {
  const provided = String(explicitProvider || '').trim();
  if (provided) return provided;
  const candidates = `${sourceUrl} ${backgroundUrl}`.toLowerCase();
  if (candidates.includes('pexels')) return 'pexels';
  if (candidates.includes('pixabay')) return 'pixabay';
  if (candidates.includes('local://')) return 'inherited-live';
  if (candidates.includes('/uploads/') || candidates.includes('/media/')) return 'workspace-upload';
  if (candidates.includes('mixkit') || candidates.includes('vimeo')) return 'imported';
  return 'used';
};

const inferSavedBackgroundCategory = (
  sourceUrl: string,
  backgroundUrl: string,
  explicitCategory = '',
  provider = '',
): string => {
  const provided = normalizeBackgroundCategory(explicitCategory);
  if (explicitCategory.trim()) return provided;
  const haystack = `${sourceUrl} ${backgroundUrl}`.toLowerCase();
  if (haystack.includes('worship')) return 'Worship';
  if (haystack.includes('church')) return 'Church';
  if (haystack.includes('celebration') || haystack.includes('confetti')) return 'Celebration';
  if (haystack.includes('cross')) return 'Cross';
  if (haystack.includes('nature') || haystack.includes('forest') || haystack.includes('mountain') || haystack.includes('meadow') || haystack.includes('sky')) return 'Nature';
  if (haystack.includes('abstract') || haystack.includes('bokeh') || haystack.includes('gradient') || haystack.includes('mesh')) return 'Abstract';
  if (haystack.includes('fire') || haystack.includes('flame')) return 'Fire';
  if (haystack.includes('water') || haystack.includes('wave') || haystack.includes('ocean') || haystack.includes('river') || haystack.includes('sea')) return 'Water';
  if (haystack.includes('stars') || haystack.includes('galaxy') || haystack.includes('space') || haystack.includes('nebula')) return 'Stars';
  if (haystack.includes('sunrise') || haystack.includes('sunset') || haystack.includes('golden')) return 'Sunrise';
  if (provider === 'workspace-upload') return 'Imported';
  return 'Used';
};

const inferSavedBackgroundTitle = (
  sourceUrl: string,
  backgroundUrl: string,
  explicitTitle = '',
  category = 'Used',
): string => {
  const provided = String(explicitTitle || '').trim();
  if (provided) return provided;
  const candidateUrl = String(sourceUrl || backgroundUrl || '').trim();
  if (!candidateUrl) return `${category} Background`;
  try {
    const parsed = new URL(candidateUrl);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const cleaned = decodeURIComponent(lastSegment).replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim();
    if (cleaned) {
      return cleaned.split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    }
  } catch {
    // ignore url parse failures
  }
  return `${category} Background`;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeSessionIdSetting = (value: unknown) => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || 'live';
};

const normalizeRemoteAdminEmailsSetting = (value: unknown) => (
  typeof value === 'string' ? value : ''
);

const isFallbackSessionId = (value: string) => normalizeSessionIdSetting(value).toLowerCase() === 'live';

const normalizeSpeakerTimerThresholds = (amberPercent: number, redPercent: number) => {
  const safeAmber = clamp(Number.isFinite(amberPercent) ? Math.round(amberPercent) : 25, 1, 99);
  const safeRed = clamp(Number.isFinite(redPercent) ? Math.round(redPercent) : 10, 1, safeAmber);
  return {
    amberPercent: safeAmber,
    redPercent: safeRed,
  };
};

const replaceMediaUrlAcrossSchedule = (
  entries: ServiceItem[],
  sourceUrl: string,
  nextUrl: string,
  metadataUpdates?: Partial<NonNullable<ServiceItem['metadata']>>,
) => {
  let changed = false;
  const nextSchedule = entries.map((entry) => {
    const themeChanged = entry.theme.backgroundUrl === sourceUrl;
    const nextTheme = themeChanged
      ? { ...entry.theme, backgroundUrl: nextUrl, mediaType: entry.theme.mediaType || 'image' }
      : entry.theme;
    let slideChanged = false;
    const nextSlides = entry.slides.map((slide) => {
      if (slide.backgroundUrl !== sourceUrl) return slide;
      slideChanged = true;
      return {
        ...slide,
        backgroundUrl: nextUrl,
        mediaType: slide.mediaType || 'image',
      };
    });
    let nextMetadataBase = entry.metadata ? { ...entry.metadata } : undefined;
    let metadataChanged = false;
    if (nextMetadataBase?.backgroundFallbackUrl === sourceUrl) {
      nextMetadataBase.backgroundFallbackUrl = nextUrl;
      metadataChanged = true;
    }
    if (nextMetadataBase?.backgroundSourceUrl === sourceUrl && !metadataUpdates?.backgroundSourceUrl) {
      nextMetadataBase.backgroundSourceUrl = nextUrl;
      metadataChanged = true;
    }
    if ((themeChanged || slideChanged || metadataChanged) && metadataUpdates) {
      const writableMetadata = nextMetadataBase ? { ...nextMetadataBase } : {};
      Object.entries(metadataUpdates).forEach(([key, value]) => {
        if (value === undefined) return;
        (writableMetadata as NonNullable<ServiceItem['metadata']>)[key as keyof NonNullable<ServiceItem['metadata']>] = value as never;
      });
      nextMetadataBase = writableMetadata;
      metadataChanged = true;
    }
    if (!themeChanged && !slideChanged && !metadataChanged) return entry;
    changed = true;
    return {
      ...entry,
      theme: nextTheme,
      slides: nextSlides,
      metadata: nextMetadataBase && Object.keys(nextMetadataBase).length > 0 ? nextMetadataBase : undefined,
    };
  });
  return changed ? nextSchedule : entries;
};

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

const stageTimerLayoutsEqual = (left: StageTimerLayout, right: StageTimerLayout) => (
  left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && left.fontScale === right.fontScale
  && left.variant === right.variant
  && left.locked === right.locked
);

const stageAlertLayoutsEqual = (left: StageAlertLayout, right: StageAlertLayout) => (
  left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height
  && left.fontScale === right.fontScale
  && left.locked === right.locked
);

const readStoredStageWorkspaceSettings = (): Partial<WorkspaceSettings> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as { workspaceSettings?: Partial<WorkspaceSettings> };
    const settings = parsed?.workspaceSettings;
    if (!settings || typeof settings !== 'object') return {};
    return {
      stageTimerLayout: normalizeStageTimerLayout(settings.stageTimerLayout),
      stageAlertLayout: normalizeStageAlertLayout(settings.stageAlertLayout),
      stageFlowLayout: typeof settings.stageFlowLayout === 'string' && VALID_STAGE_FLOW_LAYOUTS.includes(settings.stageFlowLayout as StageFlowLayout)
        ? settings.stageFlowLayout as StageFlowLayout
        : undefined,
    };
  } catch {
    return {};
  }
};

const writeStoredStageWorkspaceSettings = (updates: Partial<WorkspaceSettings>) => {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, unknown> : {};
    const nextWorkspaceSettings = {
      ...((parsed.workspaceSettings && typeof parsed.workspaceSettings === 'object') ? parsed.workspaceSettings as Record<string, unknown> : {}),
      ...updates,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...parsed,
      workspaceSettings: nextWorkspaceSettings,
      updatedAt: Date.now(),
    }));
  } catch {
    // ignore local storage write failures
  }
};

const mergeStoredStageLayoutsIntoWorkspaceSettings = (settings: WorkspaceSettings): WorkspaceSettings => {
  const stored = readStoredStageWorkspaceSettings();
  return {
    ...settings,
    stageTimerLayout: stored.stageTimerLayout ? normalizeStageTimerLayout(stored.stageTimerLayout) : settings.stageTimerLayout,
    stageAlertLayout: stored.stageAlertLayout ? normalizeStageAlertLayout(stored.stageAlertLayout) : settings.stageAlertLayout,
    stageFlowLayout: stored.stageFlowLayout || settings.stageFlowLayout,
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
  const { amberPercent, redPercent } = normalizeSpeakerTimerThresholds(
    typeof raw.amberPercent === 'number' && Number.isFinite(raw.amberPercent) ? raw.amberPercent : 25,
    typeof raw.redPercent === 'number' && Number.isFinite(raw.redPercent) ? raw.redPercent : 10,
  );
  const speakerName = typeof raw.speakerName === 'string' ? raw.speakerName.trim() : '';
  return {
    id,
    name,
    durationSec,
    amberPercent,
    redPercent,
    autoStartNextDefault: !!raw.autoStartNextDefault,
    speakerName: speakerName || undefined,
    chimeOnAmber: typeof raw.chimeOnAmber === 'boolean' ? raw.chimeOnAmber : undefined,
    chimeOnRed: typeof raw.chimeOnRed === 'boolean' ? raw.chimeOnRed : undefined,
    chimeOnMilestones: typeof raw.chimeOnMilestones === 'boolean' ? raw.chimeOnMilestones : undefined,
    overtimeBehavior: raw.overtimeBehavior === 'stop' || raw.overtimeBehavior === 'flash-and-stop' ? raw.overtimeBehavior : undefined,
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
  if (Object.prototype.hasOwnProperty.call(raw, 'presenterExperience')) {
    safe.presenterExperience = sanitizePresenterExperience(raw.presenterExperience);
  }
  if (typeof raw.remoteAdminEmails === 'string') safe.remoteAdminEmails = normalizeRemoteAdminEmailsSetting(raw.remoteAdminEmails);
  if (typeof raw.sessionId === 'string') safe.sessionId = normalizeSessionIdSetting(raw.sessionId);
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
  if (typeof raw.timerChimesEnabled === 'boolean') safe.timerChimesEnabled = raw.timerChimesEnabled;
  if (typeof raw.aetherBridgeEnabled === 'boolean') safe.aetherBridgeEnabled = raw.aetherBridgeEnabled;
  if (typeof raw.aetherBridgeAutoSync === 'boolean') safe.aetherBridgeAutoSync = raw.aetherBridgeAutoSync;
  if (typeof raw.aetherBridgeUrl === 'string') safe.aetherBridgeUrl = raw.aetherBridgeUrl.slice(0, 500);
  if (typeof raw.aetherRoomId === 'string') safe.aetherRoomId = raw.aetherRoomId.slice(0, 64);
  if (typeof raw.aetherSceneProgram === 'string') safe.aetherSceneProgram = raw.aetherSceneProgram.slice(0, 120);
  if (typeof raw.aetherSceneBlackout === 'string') safe.aetherSceneBlackout = raw.aetherSceneBlackout.slice(0, 120);
  if (typeof raw.aetherSceneLobby === 'string') safe.aetherSceneLobby = raw.aetherSceneLobby.slice(0, 120);
  if (typeof raw.slideBrandingEnabled === 'boolean') safe.slideBrandingEnabled = raw.slideBrandingEnabled;
  if (typeof raw.slideBrandingSeriesLabel === 'string') safe.slideBrandingSeriesLabel = raw.slideBrandingSeriesLabel.slice(0, 80);
  if (raw.slideBrandingStyle === 'minimal' || raw.slideBrandingStyle === 'bold' || raw.slideBrandingStyle === 'frosted') safe.slideBrandingStyle = raw.slideBrandingStyle;
  if (typeof raw.slideBrandingOpacity === 'number' && raw.slideBrandingOpacity >= 0 && raw.slideBrandingOpacity <= 1) safe.slideBrandingOpacity = raw.slideBrandingOpacity;
  if (Array.isArray(raw.ndiSources)) {
    safe.ndiSources = (raw.ndiSources as unknown[])
      .filter((s): s is NdiSourceConfig => {
        if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
        const e = s as Record<string, unknown>;
        return typeof e.id === 'string' && typeof e.name === 'string' && typeof e.sceneId === 'string';
      })
      .slice(0, 32)
      .map((s) => ({ id: s.id.trim().slice(0, 64), name: s.name.trim().slice(0, 120), sceneId: s.sceneId.trim().slice(0, 120) }));
  }
  return safe;
};

const sanitizeWorkspaceSettingsIntent = (value: unknown): WorkspaceSettingsIntentMetadata => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const safe: WorkspaceSettingsIntentMetadata = {};
  (['remoteAdminEmails', 'sessionId'] as ProtectedWorkspaceFieldKey[]).forEach((field) => {
    const entry = raw[field];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const payload = entry as Record<string, unknown>;
    if (typeof payload.value !== 'string') return;
    const updatedAt = Number(payload.updatedAt || 0);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) return;
    safe[field] = {
      value: field === 'sessionId'
        ? normalizeSessionIdSetting(payload.value)
        : normalizeRemoteAdminEmailsSetting(payload.value),
      updatedAt,
    };
  });
  return safe;
};

const buildWorkspaceSettingsIntentPatch = (
  settings: Partial<WorkspaceSettings>,
  updatedAt: number
): WorkspaceSettingsIntentMetadata => {
  const patch: WorkspaceSettingsIntentMetadata = {};
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return patch;
  if (Object.prototype.hasOwnProperty.call(settings, 'remoteAdminEmails')) {
    patch.remoteAdminEmails = {
      value: normalizeRemoteAdminEmailsSetting(settings.remoteAdminEmails),
      updatedAt,
    };
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'sessionId')) {
    patch.sessionId = {
      value: normalizeSessionIdSetting(settings.sessionId),
      updatedAt,
    };
  }
  return patch;
};

const mergeWorkspaceSettingsIntent = (
  current: WorkspaceSettingsIntentMetadata,
  incoming: WorkspaceSettingsIntentMetadata
): WorkspaceSettingsIntentMetadata => {
  const next: WorkspaceSettingsIntentMetadata = { ...current };
  (['remoteAdminEmails', 'sessionId'] as ProtectedWorkspaceFieldKey[]).forEach((field) => {
    const candidate = incoming[field];
    if (!candidate) return;
    const existing = next[field];
    if (!existing || candidate.updatedAt >= existing.updatedAt) {
      next[field] = candidate;
    }
  });
  return next;
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

const DEFAULT_STAGE_TIMER_FLASH: StageTimerFlashState = {
  active: false,
  color: 'white',
  updatedAt: 0,
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

const sanitizeStageTimerFlashState = (value: unknown): StageTimerFlashState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_STAGE_TIMER_FLASH;
  }
  const raw = value as Record<string, unknown>;
  const color = typeof raw.color === 'string' && VALID_STAGE_TIMER_FLASH_COLORS.includes(raw.color as StageTimerFlashColor)
    ? raw.color as StageTimerFlashColor
    : DEFAULT_STAGE_TIMER_FLASH.color;
  return {
    active: !!raw.active,
    color,
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : 0,
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

function App() {
  // @ts-ignore
  const isElectronShell = !!window.electron?.isElectron;
  const canUseFirebaseSync = isFirebaseConfigured() && !isElectronShell;
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  // True when running inside the NDI capture window (ndi=1 URL param).
  // In this mode, audience-facing overlays (QR projection) are suppressed.
  const isNdiCapture = useMemo(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    return params.get('ndi') === '1';
  }, []);
  const managedRouteParams = useMemo(() => {
    const searchParams = new URLSearchParams(window.location.search || '');
    const hash = window.location.hash || '';
    const queryStart = hash.indexOf('?');
    const hashParams = new URLSearchParams(queryStart >= 0 ? hash.slice(queryStart + 1) : '');
    const readParam = (key: string) => (
      (searchParams.get(key) || '').trim()
      || (hashParams.get(key) || '').trim()
    );
    const sessionId = readParam('session');
    const workspaceId = readParam('workspace');
    const fullscreen = readParam('fullscreen');
    const clean = readParam('clean');
    const ndi = readParam('ndi');
    return {
      sessionId,
      workspaceId,
      fullscreen,
      clean,
      ndi,
      hasManagedOutputRoute: !!(sessionId || workspaceId || fullscreen === '1' || clean === '1' || ndi === '1'),
      hasManagedStageRoute: !!(sessionId || workspaceId),
    };
  }, []);
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
  const [splitPanelConflictDismissed, setSplitPanelConflictDismissed] = useState(false);
  const [syncIssue, setSyncIssue] = useState<string | null>(null);
  const [dismissedSyncGuidance, setDismissedSyncGuidance] = useState<SyncGuidanceDismissals>(() => readSyncGuidanceDismissals());
  const [desktopUpdateStatus, setDesktopUpdateStatus] = useState<DesktopUpdateStatus>({
    state: 'idle',
    progress: 0,
    message: 'Idle',
  });
  const [dismissedUpdateKey, setDismissedUpdateKey] = useState<string | null>(null);
  const [isDisplaySetupOpen, setIsDisplaySetupOpen] = useState(false);
  const [desktopDisplays, setDesktopDisplays] = useState<DesktopDisplayInfo[]>([]);
  const [desktopDisplayMapping, setDesktopDisplayMapping] = useState<DesktopDisplayMapping>(() => readDesktopDisplayMapping());
  const [desktopServiceState, setDesktopServiceState] = useState<DesktopServiceState>(DEFAULT_DESKTOP_SERVICE_STATE);
  const [desktopDisplayStatusText, setDesktopDisplayStatusText] = useState('');

  // ✅ Projector popout window handle (opened in click handler to avoid popup blockers)
  const [outputWin, setOutputWin] = useState<Window | null>(null);
  const [timerPopoutWin, setTimerPopoutWin] = useState<Window | null>(null);
  const timerBroadcastRef = useRef<BroadcastChannel | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Only show onboarding in the studio view for new users
    const hasSeen = localStorage.getItem('lumina_onboarding_v2.2.0');
    return !hasSeen;
  });
  const [activeSidebarTab, setActiveSidebarTab] = useState<'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS'>('SCHEDULE');
  const [macros, setMacros] = useState<MacroDefinition[]>([]);
  const [macroAuditLog, setMacroAuditLog] = useState<MacroAuditEntry[]>([]);
  const appendMacroAudit = useCallback((entry: MacroAuditEntry) => {
    setMacroAuditLog(prev => [entry, ...prev].slice(0, 20));
  }, []);
  const appendMacroAuditRef = useRef(appendMacroAudit);
  appendMacroAuditRef.current = appendMacroAudit;
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  const isSettingsHydratedRef = useRef(false);
  const studioShellRef = useRef<HTMLDivElement | null>(null);
  const stagePreviewFrameRef = useRef<HTMLDivElement | null>(null);
  const stageEditorFrameRef = useRef<HTMLDivElement | null>(null);
  const workspaceSettingsIntentRef = useRef<WorkspaceSettingsIntentMetadata>({});
  const pendingProtectedSettingsSaveRef = useRef<WorkspaceSettingsIntentMetadata>({});
  const [stagePreviewViewport, setStagePreviewViewport] = useState({ width: 320, height: 180 });
  const [stageEditorViewport, setStageEditorViewport] = useState({ width: 1280, height: 720 });

  useEffect(() => {
    if (!window.electron?.updates) return undefined;
    let mounted = true;
    void window.electron.updates.getStatus?.().then((status) => {
      if (!mounted || !status) return;
      setDesktopUpdateStatus(status);
    });
    const unsubscribe = window.electron.updates.onStatus?.((status) => {
      if (!mounted || !status) return;
      setDesktopUpdateStatus(status);
      if (status.state === 'downloaded' && status.version) {
        setDismissedUpdateKey((prev) => (prev === status.version ? prev : null));
      }
    });
    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    writeSyncGuidanceDismissals(dismissedSyncGuidance);
  }, [dismissedSyncGuidance]);

  const handleDesktopUpdateCheckNow = useCallback(async () => {
    const status = await window.electron?.updates?.checkNow?.();
    if (status) {
      setDesktopUpdateStatus(status);
      setDismissedUpdateKey(null);
    }
  }, []);

  const handleDesktopUpdateInstallNow = useCallback(async () => {
    await window.electron?.updates?.installNow?.();
  }, []);

  const handleDesktopUpdateOpenReleases = useCallback(async () => {
    await window.electron?.updates?.openReleases?.();
  }, []);

  const currentUpdateKey = useMemo(
    () => desktopUpdateStatus.version || desktopUpdateStatus.releaseName || desktopUpdateStatus.state,
    [desktopUpdateStatus.releaseName, desktopUpdateStatus.state, desktopUpdateStatus.version]
  );

  const showDesktopUpdateBanner = isElectronShell
    && ['available', 'downloading', 'downloaded', 'error'].includes(desktopUpdateStatus.state)
    && dismissedUpdateKey !== currentUpdateKey;

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
  const scheduleRef = useRef<ServiceItem[]>(schedule);
  useEffect(() => {
    scheduleRef.current = schedule;
  }, [schedule]);

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    const saved = initialSavedState;
    const savedSchedule = saved?.schedule || INITIAL_SCHEDULE;
    return saved?.selectedItemId || savedSchedule[0]?.id || '';
  });

  const [viewMode, setViewMode] = useState<'BUILDER' | 'PRESENTER' | 'STAGE'>(() => {
    const saved = initialSavedState;
    return saved?.viewMode || 'BUILDER';
  });
  const [showSermonRecorder, setShowSermonRecorder] = useState(false);
  const [isRightDockOpen, setIsRightDockOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState<boolean>(() => {
    const saved = initialSavedState;
    return !!saved?.sidebarPinned;
  });
  const [isSidebarHovering, setIsSidebarHovering] = useState(false);
  const [presenterSidebarDrawerOpen, setPresenterSidebarDrawerOpen] = useState(false);

  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSlideEditorOpen, setIsSlideEditorOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false); // NEW
  const [ccliConnected, setCcliConnected] = useState(false);
  const [isStagePreviewEditorOpen, setIsStagePreviewEditorOpen] = useState(false);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    churchName: 'My Church',
    ccli: '',
    defaultVersion: 'kjv',
    visionarySpeechLocaleMode: 'auto',
    theme: 'dark',
    presenterExperience: 'classic',
    remoteAdminEmails: '',
    sessionId: 'live',
    stageProfile: 'classic',
    stageFlowLayout: 'balanced',
    machineMode: false,
    stageTimerLayout: DEFAULT_STAGE_TIMER_LAYOUT,
    stageAlertLayout: DEFAULT_STAGE_ALERT_LAYOUT,
    connectionTargetRoles: DEFAULT_CONNECTION_TARGET_ROLES,
    speakerTimerPresets: DEFAULT_SPEAKER_TIMER_PRESETS,
    timerChimesEnabled: true,
    aetherBridgeEnabled: false,
    aetherBridgeAutoSync: true,
    aetherBridgeUrl: '',
    aetherRoomId: '',
    aetherSceneProgram: 'Program',
    aetherSceneBlackout: 'Blackout',
    aetherSceneLobby: 'Lobby',
    slideBrandingEnabled: false,
    slideBrandingSeriesLabel: '',
    slideBrandingStyle: 'minimal',
    slideBrandingOpacity: 0.82,
    ndiSources: [],
  });
  const [presenterLayoutPrefs, setPresenterLayoutPrefs] = useState<PresenterLayoutPrefs>(() => (
    readPresenterLayoutPrefs('default-workspace', !!window.electron?.isElectron)
  ));
  const [presenterLibraryTab, setPresenterLibraryTab] = useState<PresenterLibraryTab>('songs');
  const [presenterFocusArea, setPresenterFocusArea] = useState<PresenterFocusArea>('schedule');
  const [presenterPreviewSelection, setPresenterPreviewSelection] = useState<{ itemId: string | null; slideIndex: number }>({
    itemId: null,
    slideIndex: 0,
  });
  const [presenterContextMenu, setPresenterContextMenu] = useState<PresenterContextMenuState>(null);
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
    return normalizeSessionIdSetting(workspaceSettings.sessionId);
  }, [workspaceSettings.sessionId, viewState]);

  const workspaceId = useMemo(() => {
    const params = new URLSearchParams(window.location.search || window.location.hash.split('?')[1] || '');
    const urlWorkspace = params.get('workspace');
    if (urlWorkspace && viewState === 'audience') return urlWorkspace.trim();
    return resolveWorkspaceId(user);
  }, [user?.uid, viewState]);
  const presenterLayoutStorageDesktop = !!(typeof window !== 'undefined' && window.electron?.isElectron);

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
  useEffect(() => {
    setPresenterLayoutPrefs(readPresenterLayoutPrefs(workspaceId, presenterLayoutStorageDesktop));
  }, [workspaceId, presenterLayoutStorageDesktop]);

  useEffect(() => {
    try {
      localStorage.setItem(
        getPresenterLayoutStorageKey(workspaceId, presenterLayoutStorageDesktop),
        JSON.stringify(clampPresenterLayoutPrefs(presenterLayoutPrefs))
      );
    } catch {
      // Ignore local layout persistence failures.
    }
  }, [workspaceId, presenterLayoutPrefs, presenterLayoutStorageDesktop]);
  const persistWorkspaceSettingsCache = useCallback((
    settings: WorkspaceSettings,
    updatedAt: number,
    intent: WorkspaceSettingsIntentMetadata = workspaceSettingsIntentRef.current
  ) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      localStorage.setItem(SETTINGS_UPDATED_AT_KEY, String(updatedAt));
      localStorage.setItem(SETTINGS_INTENT_KEY, JSON.stringify(intent));
      localStorage.setItem(getWorkspaceSettingsKey(workspaceId), JSON.stringify(settings));
      localStorage.setItem(getWorkspaceSettingsUpdatedAtKey(workspaceId), String(updatedAt));
      localStorage.setItem(getWorkspaceSettingsIntentKey(workspaceId), JSON.stringify(intent));
      setSaveError(false);
    } catch (error: any) {
      if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        setSaveError(true);
      }
    }
  }, [workspaceId]);
  const mergeIncomingWorkspaceSettings = useCallback((
    previous: WorkspaceSettings,
    incoming: Partial<WorkspaceSettings>,
    incomingUpdatedAt = 0
  ): WorkspaceSettings => {
    const next: WorkspaceSettings = {
      ...previous,
      ...incoming,
    };

    if (Object.prototype.hasOwnProperty.call(incoming, 'sessionId')) {
      next.sessionId = normalizeSessionIdSetting(incoming.sessionId);
    }

    if (Object.prototype.hasOwnProperty.call(incoming, 'remoteAdminEmails')) {
      next.remoteAdminEmails = normalizeRemoteAdminEmailsSetting(incoming.remoteAdminEmails);
    }

    (['remoteAdminEmails', 'sessionId'] as ProtectedWorkspaceFieldKey[]).forEach((field) => {
      if (!Object.prototype.hasOwnProperty.call(incoming, field)) return;
      const incomingValue = field === 'sessionId'
        ? normalizeSessionIdSetting(incoming.sessionId)
        : normalizeRemoteAdminEmailsSetting(incoming.remoteAdminEmails);
      const currentValue = field === 'sessionId'
        ? normalizeSessionIdSetting(previous.sessionId)
        : normalizeRemoteAdminEmailsSetting(previous.remoteAdminEmails);
      const intent = workspaceSettingsIntentRef.current[field];
      const currentIsProtected = field === 'sessionId'
        ? !isFallbackSessionId(currentValue)
        : !!currentValue.trim();
      const incomingIsFallback = field === 'sessionId'
        ? isFallbackSessionId(incomingValue)
        : !incomingValue.trim();
      const intentValue = intent
        ? (field === 'sessionId' ? normalizeSessionIdSetting(intent.value) : normalizeRemoteAdminEmailsSetting(intent.value))
        : '';
      const intentIsProtected = field === 'sessionId'
        ? !isFallbackSessionId(intentValue)
        : !!intentValue.trim();
      if (incomingIsFallback && currentIsProtected && intentIsProtected && (intent?.updatedAt || 0) >= incomingUpdatedAt) {
        next[field] = previous[field] as any;
      }
    });

    return next;
  }, []);
  const handleWorkspaceSettingsSave = useCallback((patch: Partial<WorkspaceSettings>) => {
    const updatedAt = Date.now();
    const normalizedPatch: Partial<WorkspaceSettings> = {
      ...patch,
    };
    if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'sessionId')) {
      normalizedPatch.sessionId = normalizeSessionIdSetting(normalizedPatch.sessionId);
    }
    if (Object.prototype.hasOwnProperty.call(normalizedPatch, 'remoteAdminEmails')) {
      normalizedPatch.remoteAdminEmails = normalizeRemoteAdminEmailsSetting(normalizedPatch.remoteAdminEmails);
    }

    const intentPatch = buildWorkspaceSettingsIntentPatch(normalizedPatch, updatedAt);
    if (Object.keys(intentPatch).length > 0) {
      workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(workspaceSettingsIntentRef.current, intentPatch);
      pendingProtectedSettingsSaveRef.current = intentPatch;
    }

    const nextSettings = mergeIncomingWorkspaceSettings(workspaceSettings, normalizedPatch, updatedAt);
    persistWorkspaceSettingsCache(nextSettings, updatedAt);
    setWorkspaceSettings(nextSettings);
  }, [mergeIncomingWorkspaceSettings, persistWorkspaceSettingsCache, workspaceSettings]);
  const [isMotionLibOpen, setIsMotionLibOpen] = useState(false); // NEW
  const [motionLibraryMode, setMotionLibraryMode] = useState<'selected-item' | 'new-item'>('selected-item');
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
  const [inlineSlideRename, setInlineSlideRename] = useState<{ itemId: string; slideId: string; value: string; source: 'runsheet' | 'thumbnail' } | null>(null);
  const inlineSlideRenameInputRef = useRef<HTMLInputElement | null>(null);
  const presenterMediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [isOutputLive, setIsOutputLive] = useState(false);
  const [isStageDisplayLive, setIsStageDisplayLive] = useState(false);
  const [ndiActive, setNdiActive] = useState(false);
  const [ndiError, setNdiError] = useState<string | null>(null);
  const [lowerThirdsEnabled, setLowerThirdsEnabled] = useState(false);
  const [routingMode, setRoutingMode] = useState<'PROJECTOR' | 'STREAM' | 'LOBBY'>('PROJECTOR');
  const [teamPlaylists, setTeamPlaylists] = useState<CloudPlaylistRecord[]>([]);
  const [cloudBootstrapComplete, setCloudBootstrapComplete] = useState(!canUseFirebaseSync);
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
  const pendingSharedMediaUploadsRef = useRef<Set<string>>(new Set());
  const prevailingGeneratedBackgroundRef = useRef<BackgroundSnapshot | null>(null);
  const prevailingGeneratedBackgroundSafeRef = useRef<BackgroundSnapshot | null>(null);
  const prevailingGeneratedBackgroundKeyRef = useRef<string>('');

  const [audienceDisplay, setAudienceDisplay] = useState<AudienceDisplayState>(() => {
    const saved = initialSavedState;
    return sanitizeAudienceDisplayState(saved?.audienceDisplay);
  });
  const [audienceQrProjection, setAudienceQrProjection] = useState<AudienceQrProjectionState>(() => {
    const saved = initialSavedState;
    const state = sanitizeAudienceQrProjectionState(saved?.audienceQrProjection);
    // Always start hidden — QR must be explicitly shown each session.
    // The URL is preserved so the user doesn't need to re-enter it.
    return { ...state, visible: false };
  });
  const [stageTimerFlash, setStageTimerFlash] = useState<StageTimerFlashState>(() => {
    const saved = initialSavedState;
    return sanitizeStageTimerFlashState(saved?.stageTimerFlash);
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
  const [archivedSermons, setArchivedSermons] = useState<ArchivedSermon[]>([]);
  const [archivedSermonsLoading, setArchivedSermonsLoading] = useState(false);
  const [videoUrlDraft, setVideoUrlDraft] = useState('');
  const [draggedScheduleItemId, setDraggedScheduleItemId] = useState<string | null>(null);
  const [scheduleDropIndicator, setScheduleDropIndicator] = useState<{ itemId: string; after: boolean } | null>(null);
  const [draggedRunSheetSlide, setDraggedRunSheetSlide] = useState<{ itemId: string; slideId: string } | null>(null);
  const [runSheetSlideDropIndicator, setRunSheetSlideDropIndicator] = useState<{ itemId: string; slideId: string; after: boolean } | null>(null);
  const [draggedSelectedSlideId, setDraggedSelectedSlideId] = useState<string | null>(null);
  const [selectedSlideDropIndicator, setSelectedSlideDropIndicator] = useState<{ slideId: string; after: boolean } | null>(null);
  const [selectedSpeakerPresetId, setSelectedSpeakerPresetId] = useState('');
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetDraft, setPresetDraft] = useState<SpeakerTimerPreset>(() => createSpeakerPresetDraft());
  const presetStudioCardRef = useRef<HTMLDivElement | null>(null);
  const presetStudioDragOffsetRef = useRef({ x: 0, y: 0 });
  const [presetStudioDragging, setPresetStudioDragging] = useState(false);
  const [presetStudioPosition, setPresetStudioPosition] = useState<{ x: number; y: number } | null>(null);
  const [presetStudioSaveState, setPresetStudioSaveState] = useState<{ at: number; mode: 'saved' | 'updated' } | null>(null);
  const [presetStudioWidthMode, setPresetStudioWidthMode] = useState<'standard' | 'wide'>('standard');
  const [presetStudioMinimized, setPresetStudioMinimized] = useState(false);
  const [presetPreviewProgress, setPresetPreviewProgress] = useState<number | null>(null);
  const presetPreviewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPresetPreview = useCallback(() => {
    if (presetPreviewIntervalRef.current) clearInterval(presetPreviewIntervalRef.current);
    setPresetPreviewProgress(1);
    let step = 1;
    const total = 40;
    presetPreviewIntervalRef.current = setInterval(() => {
      step += 1;
      if (step > total) {
        if (presetPreviewIntervalRef.current) clearInterval(presetPreviewIntervalRef.current);
        presetPreviewIntervalRef.current = null;
        setPresetPreviewProgress(null);
        return;
      }
      setPresetPreviewProgress(1 - step / total);
    }, 250);
  }, []);
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
  const updateStageTimerFlash = useCallback((patch: Partial<StageTimerFlashState>) => {
    setStageTimerFlash((prev) => sanitizeStageTimerFlashState({
      ...prev,
      ...patch,
      updatedAt: typeof patch.updatedAt === 'number' ? patch.updatedAt : Date.now(),
    }));
  }, []);
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
  const closeSpeakerPresetStudio = useCallback(() => {
    setIsPresetModalOpen(false);
    setPresetStudioDragging(false);
    setPresetStudioPosition(null);
    if (presetPreviewIntervalRef.current) { clearInterval(presetPreviewIntervalRef.current); presetPreviewIntervalRef.current = null; }
    setPresetPreviewProgress(null);
  }, []);
  const clampPresetStudioToViewport = useCallback(() => {
    const card = presetStudioCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const margin = 12;
    const maxX = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxY = Math.max(margin, window.innerHeight - rect.height - margin);
    setPresetStudioPosition((prev) => {
      if (!prev) return prev;
      return {
        x: clamp(prev.x, margin, maxX),
        y: clamp(prev.y, margin, maxY),
      };
    });
  }, []);
  const beginPresetStudioDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-no-preset-drag]')) return;
    const card = presetStudioCardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    presetStudioDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setPresetStudioPosition({ x: rect.left, y: rect.top });
    setPresetStudioDragging(true);
    event.preventDefault();
  };
  useEffect(() => {
    if (!presetStudioDragging) return;
    const onPointerMove = (event: PointerEvent) => {
      const card = presetStudioCardRef.current;
      if (!card) return;
      const minVisible = 48;
      const rawX = event.clientX - presetStudioDragOffsetRef.current.x;
      const rawY = event.clientY - presetStudioDragOffsetRef.current.y;
      setPresetStudioPosition({
        x: clamp(rawX, -(card.offsetWidth - minVisible), window.innerWidth - minVisible),
        y: clamp(rawY, 0, window.innerHeight - minVisible),
      });
    };
    const onPointerUp = () => setPresetStudioDragging(false);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [presetStudioDragging]);
  useEffect(() => {
    if (!isPresetModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSpeakerPresetStudio();
    };
    const onResize = () => clampPresetStudioToViewport();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    window.setTimeout(clampPresetStudioToViewport, 0);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [isPresetModalOpen, closeSpeakerPresetStudio, clampPresetStudioToViewport]);
  useEffect(() => {
    if (!isPresetModalOpen) return;
    window.setTimeout(clampPresetStudioToViewport, 0);
  }, [isPresetModalOpen, presetStudioWidthMode, clampPresetStudioToViewport]);
  useEffect(() => {
    if (isPresetModalOpen) return;
    setPresetStudioDragging(false);
    setPresetStudioPosition(null);
    setPresetStudioMinimized(false);
  }, [isPresetModalOpen]);

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

  // ── CCLI credentials — load at startup ──────────────────────────────────────
  // The actual client_secret lives only on the server. The renderer only learns
  // whether the workspace is connected. We pass a getIdToken closure so the
  // server can verify the user with firebase-admin.
  useEffect(() => {
    if (!workspaceId) return;
    const getIdToken = user && typeof (user as any).getIdToken === 'function'
      ? () => (user as any).getIdToken().catch(() => null)
      : undefined;
    setCcliActor(user?.uid ?? workspaceId, user?.email ?? null, getIdToken);
    getCcliCredentials(workspaceId).then((creds) => {
      initCcliProvider(creds, workspaceId);
      setCcliConnected(!!creds);
    }).catch(() => {
      initCcliProvider(null, workspaceId);
    });
  }, [workspaceId, user?.uid, user?.email]);

  // ── Server-side session validation — startup + periodic re-check ────────────
  // Validates the user's session against the server. Honours the free plan
  // (free users are valid). If the server marks the account as revoked, or the
  // server is permanently unreachable on a hard reject, the client logs out.
  useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const validate = async () => {
      try {
        const headers: Record<string, string> = {
          'x-user-uid': user.uid,
          'x-user-email': user.email ?? '',
        };
        if (typeof (user as any).getIdToken === 'function') {
          try {
            const token = await (user as any).getIdToken();
            if (token) headers.Authorization = `Bearer ${token}`;
          } catch { /* noop */ }
        }
        const resp = await fetch('/api/session/validate', { headers });
        if (cancelled) return;
        if (resp.status === 403) {
          // Hard revocation — force logout
          handleLogout();
          return;
        }
        if (resp.ok) {
          const data = await resp.json();
          if (data?.valid && data?.plan) {
            setUserPlan(data.plan);
          }
        }
        // Soft failures (network down, 5xx) are tolerated — the user keeps working
      } catch {
        // Network down — fail open. Free plan users still have a working app.
      }
    };
    void validate();
    const intervalId = window.setInterval(() => { void validate(); }, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Macro subscription ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return undefined;
    seedStarterMacrosIfEmpty(workspaceId, STARTER_MACROS).catch(() => {});
    const unsub = subscribeMacros(workspaceId, setMacros);
    return () => unsub();
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
  const studioHydrationStateRef = useRef<HydrationStudioState>({
    schedule: initialSavedState?.schedule || INITIAL_SCHEDULE,
    selectedItemId: initialSavedState?.selectedItemId || (initialSavedState?.schedule || INITIAL_SCHEDULE)[0]?.id || '',
    activeItemId: typeof initialSavedState?.activeItemId === 'string' ? initialSavedState.activeItemId : null,
    activeSlideIndex: initialSavedState?.activeSlideIndex ?? -1,
  });

  const [blackout, setBlackout] = useState(() => {
    const saved = initialSavedState;
    return !!saved?.blackout;
  });
  const [holdScreenMode, setHoldScreenMode] = useState<HoldScreenMode>(() => {
    const saved = initialSavedState;
    return sanitizeHoldScreenMode(saved?.holdScreenMode);
  });
  const [isPlaying, setIsPlaying] = useState<boolean>(() => {
    const saved = initialSavedState;
    return typeof saved?.isPlaying === 'boolean' ? saved.isPlaying : true;
  });

  // ── Macro execution context ─────────────────────────────────────────────────
  const macroCtx: MacroExecutionContext = useMemo(() => ({
    workspaceId,
    sessionId: liveSessionId,
    schedule,
    selectedItemId,
    activeItemId,
    activeSlideIndex,
    aetherBridgeUrl: workspaceSettings.aetherBridgeUrl || '',
    aetherBridgeToken,
    setSelectedItemId,
    setActiveItemId,
    setActiveSlideIndex,
    showStageMessage: (text: string, durationMs?: number) => {
      handleSendStageMessageNow({ text, category: 'logistics' });
      if (durationMs && durationMs > 0) {
        window.setTimeout(handleClearStageAlert, durationMs);
      }
    },
    hideStageMessage: handleClearStageAlert,
    clearOutput: () => {
      setActiveItemId(null);
      setActiveSlideIndex(-1);
    },
    startTimer: (_presetId?: string, durationSec?: number) => {
      if (durationSec !== undefined) {
        setTimerDurationMin(Math.max(1, Math.ceil(durationSec / 60)));
        setTimerSeconds(durationSec);
      }
      setTimerRunning(true);
    },
    stopTimer: () => setTimerRunning(false),
  }), [workspaceId, liveSessionId, schedule, selectedItemId, activeItemId, activeSlideIndex, workspaceSettings.aetherBridgeUrl, aetherBridgeToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Macro slide_enter trigger ───────────────────────────────────────────────
  const macroCtxRef = useRef(macroCtx);
  macroCtxRef.current = macroCtx;
  const macrosRef = useRef(macros);
  macrosRef.current = macros;
  useEffect(() => {
    if (activeItemId === null || activeSlideIndex < 0) return;
    const triggered = matchTriggers(
      { type: 'slide_enter', itemId: activeItemId, slideIndex: activeSlideIndex },
      macrosRef.current,
    );
    triggered.forEach((macro) => {
      import('./services/macroEngine').then(({ executeMacro }) => {
        executeMacro(macro, macroCtxRef.current).then((result) => {
          appendMacroAuditRef.current({ id: nanoid(), macroId: macro.id, macroName: macro.name, triggeredBy: 'slide_enter', result, workspaceId: workspaceId ?? '', firedAt: new Date().toISOString() });
        }).catch(() => {});
      }).catch(() => {});
    });
  }, [activeItemId, activeSlideIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Macro webhook trigger polling ────────────────────────────────────────────
  const lastWebhookPollTsRef = useRef<number>(Date.now());
  useEffect(() => {
    if (!workspaceId) return;
    const poll = async () => {
      const since = lastWebhookPollTsRef.current;
      try {
        const res = await fetch(
          `${getServerApiBaseUrl()}/api/workspaces/${encodeURIComponent(workspaceId)}/macro-triggers/pending?since=${since}`,
          { headers: { 'Content-Type': 'application/json' } },
        );
        if (!res.ok) return;
        const data = await res.json() as { ok: boolean; triggers?: Array<{ key: string; triggered_at: number }> };
        if (!data.ok || !data.triggers?.length) return;
        lastWebhookPollTsRef.current = Math.max(...data.triggers.map((t) => t.triggered_at)) + 1;
        for (const trigger of data.triggers) {
          const matched = matchTriggers({ type: 'webhook', webhookKey: trigger.key }, macrosRef.current);
          matched.forEach((macro) => {
            import('./services/macroEngine').then(({ executeMacro }) => {
              executeMacro(macro, macroCtxRef.current).then((result) => {
                appendMacroAuditRef.current({ id: nanoid(), macroId: macro.id, macroName: macro.name, triggeredBy: 'webhook', result, workspaceId: workspaceId ?? '', firedAt: new Date().toISOString() });
              }).catch(() => {});
            }).catch(() => {});
          });
        }
      } catch {
        // polling errors are non-fatal
      }
    };
    const interval = window.setInterval(poll, 3000);
    return () => window.clearInterval(interval);
  }, [workspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Macro service_mode_change trigger ────────────────────────────────────────
  useEffect(() => {
    const serviceMode = isPlaying ? 'live' : 'paused';
    const triggered = matchTriggers({ type: 'service_mode_change', serviceMode }, macrosRef.current);
    triggered.forEach((macro) => {
      import('./services/macroEngine').then(({ executeMacro }) => {
        executeMacro(macro, macroCtxRef.current).then((result) => {
          appendMacroAuditRef.current({ id: nanoid(), macroId: macro.id, macroName: macro.name, triggeredBy: 'service_mode_change', result, workspaceId: workspaceId ?? '', firedAt: new Date().toISOString() });
        }).catch(() => {});
      }).catch(() => {});
    });
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Absolute seek target (seconds) — used instead of relative seekAmount for YouTube sync
  const [seekTarget, setSeekTarget] = useState<number | null>(null);
  // Wall-clock ms when video play started (reset on goLive + on play toggle)
  const videoPlayStartEpochRef = useRef<number | null>(null);
  // Accumulated play seconds before the last pause
  const videoPausedOffsetRef = useRef<number>(0);
  // Shared epoch broadcast to all renderers for sync-on-load
  const [videoSyncEpoch, setVideoSyncEpoch] = useState<{ epochMs: number; offsetSec: number } | null>(null);

  // --- AUDIO SOUNDTRACK STATE ---
  const [currentTrack, setCurrentTrack] = useState<GospelTrack | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioVolume, setAudioVolume] = useState(0.5);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeSlideRef = useRef<HTMLButtonElement>(null);
  const antiSleepAudioRef = useRef<HTMLAudioElement>(null);
  const hasInitializedRemoteSnapshotRef = useRef(false);
  const hasHydratedCloudStateRef = useRef(false);
  const hasHydratedServerSnapshotRef = useRef(false);
  const workspaceSettingsUpdatedAtRef = useRef<number>(0);
  const hasLoadedInitialSettingsRef = useRef(false);
  const lastRemoteCommandAtRef = useRef<number | null>(null);
  const lastServerRemoteCommandAtRef = useRef<number | null>(null);
  const lastServerScheduleSnapshotAtRef = useRef<number | null>(null);
  const lastServerSermonFlashAtRef = useRef<number | null>(null);
  const lastCueAutoAdvanceKeyRef = useRef<string>('');
  const lastChimeFiredRef = useRef<{ cueId: string; boundary: string }>({ cueId: '', boundary: '' });
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
  useEffect(() => {
    studioHydrationStateRef.current = {
      schedule,
      selectedItemId,
      activeItemId,
      activeSlideIndex,
    };
  }, [schedule, selectedItemId, activeItemId, activeSlideIndex]);
  const applyHydratedStudioState = useCallback((incoming: Partial<HydrationStudioState>) => {
    const current = studioHydrationStateRef.current;
    if (Array.isArray(incoming.schedule) && incoming.schedule.length > 0 && !areServiceItemCollectionsEqual(incoming.schedule, current.schedule)) {
      setSchedule(incoming.schedule);
    }
    if (typeof incoming.selectedItemId === 'string' && incoming.selectedItemId !== current.selectedItemId) {
      setSelectedItemId(incoming.selectedItemId);
    }
    if (typeof incoming.activeItemId === 'string') {
      if (incoming.activeItemId !== current.activeItemId) {
        setActiveItemId(incoming.activeItemId);
      }
    } else if (incoming.activeItemId === null && current.activeItemId !== null) {
      setActiveItemId(null);
    }
    if (typeof incoming.activeSlideIndex === 'number' && incoming.activeSlideIndex !== current.activeSlideIndex) {
      setActiveSlideIndex(incoming.activeSlideIndex);
    }
  }, []);

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
    return `Cloud sync will retry in ${seconds}s. Lumina is still presenting locally on this machine.`;
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
          canUseFirebaseSync
            ? updateLiveState(entry.payload, entry.sessionId || liveSessionId)
            : Promise.resolve(false),
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
  }, [liveSessionId, workspaceId, user, reportSyncFailure, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage, canUseFirebaseSync]);

  // Strip inline data: URLs (e.g. SVG backgrounds on Bible slides) before syncing to server.
  // These can be hundreds of KB each and cause PayloadTooLargeError.
  // Flatten a rich-text array (per-word objects) to a plain string so the sync
  // payload stays compact. Remote output always re-loads full slide data from
  // the saved runsheet; the live-state snapshot only needs plain text for
  // fallback display and hydration metadata.
  const flattenRichText = (value: unknown): unknown => {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'text' in value[0]) {
      return (value as Array<{ text?: string }>).map(w => w.text ?? '').join('');
    }
    return value;
  };

  const stripDataUrl = (v: unknown): unknown =>
    typeof v === 'string' && v.startsWith('data:') ? '' : v;

  const stripScheduleDataUrls = useCallback((items: any[]): any[] =>
    items.map(item => ({
      ...item,
      // Strip item-level data URL backgrounds (PPTX imports store each slide
      // background as a base64 data URL here — a single image is 1–5 MB).
      theme: item.theme
        ? {
            ...item.theme,
            backgroundUrl: stripDataUrl(item.theme.backgroundUrl),
          }
        : item.theme,
      slides: Array.isArray(item.slides)
        ? item.slides.map((slide: any) => ({
            ...slide,
            backgroundUrl: stripDataUrl(slide.backgroundUrl),
            mediaUrl: stripDataUrl(slide.mediaUrl),
            // Flatten per-word rich-text to plain strings to keep payload small
            content: flattenRichText(slide.content),
            speakerNotes: flattenRichText(slide.speakerNotes),
          }))
        : item.slides,
    }))
  , []);

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
      canUseFirebaseSync ? updateLiveState(payload, liveSessionId) : Promise.resolve(false),
      saveServerSessionState(workspaceId, liveSessionId, user, payload).then((response) => !!response?.ok),
    ]);
    if (!firebaseOk && !serverOk) {
      applySyncBackoff('live-update');
      enqueueLiveState(payload);
    } else {
      resetSyncBackoff();
      if (canUseFirebaseSync && !firebaseOk && serverOk) {
        setSyncIssue('Cloud sharing needs permission. This booth is still live through the local Lumina server.');
      } else {
        setSyncIssue(null);
      }
    }
  }, [user?.uid, user, workspaceId, liveSessionId, enqueueLiveState, applySyncBackoff, resetSyncBackoff, buildSyncPausedMessage, canUseFirebaseSync]);

  const refreshRunSheetFiles = useCallback(async () => {
    // Wait for Firebase auth and workspace ID to resolve — workspaceId defaults to
    // 'default-workspace' before auth completes, which could hit a foreign workspace
    if (!workspaceId || !user?.uid) {
      setRunSheetFiles([]);
      return;
    }
    setRunSheetFilesLoading(true);
    setRunSheetFilesError(null);
    try {
      const response = await fetchRunSheetFiles(workspaceId, user);
      if (response?.ok && Array.isArray(response.files)) {
        const next = response.files as RunSheetFileRecord[];
        setRunSheetFiles(next);
        writeLocalRunSheetFiles(workspaceId, next);
      } else {
        const localFiles = readLocalRunSheetFiles(workspaceId);
        setRunSheetFiles(localFiles);
        if (!localFiles.length) {
          const statusHint = (response as any)?.status ? ` (HTTP ${(response as any).status})` : '';
          setRunSheetFilesError(`Archive API unavailable at ${getServerApiBaseUrl()}${statusHint}. Using local backup.`);
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

  useEffect(() => {
    if (activeSidebarTab !== 'FILES') return;
    setArchivedSermonsLoading(true);
    getArchivedSermons(workspaceId).then((items) => {
      setArchivedSermons(items);
      setArchivedSermonsLoading(false);
    });
  }, [activeSidebarTab, workspaceId]);

  // --- SESSION PERSISTENCE LOGIC ---
  useEffect(() => {
    if (isFirebaseConfigured() && auth) {
      const unsub = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setAuthLoading(false);
        if (u) {
          // Fetch the user's subscription plan from the server (with verified ID token)
          (async () => {
            const headers: Record<string, string> = {
              'x-user-uid': u.uid,
              'x-user-email': u.email ?? '',
            };
            try {
              const token = await u.getIdToken();
              if (token) headers.Authorization = `Bearer ${token}`;
            } catch { /* noop */ }
            try {
              const r = await fetch('/api/payments/subscription', { headers });
              if (r.ok) {
                const data = await r.json();
                if (data?.ok) setUserPlan(data.subscription?.plan ?? 'free');
              }
            } catch { /* keep plan as null = free */ }
          })();
        } else {
          setUserPlan(null);
        }
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
    lastServerScheduleSnapshotAtRef.current = null;
    lastServerSermonFlashAtRef.current = null;
  }, [user?.uid, liveSessionId, resetSyncBackoff]);


  useEffect(() => {
    // 1. First, try to load from local cache for instant UI
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      const savedIntent = sanitizeWorkspaceSettingsIntent(parseJson(localStorage.getItem(SETTINGS_INTENT_KEY), null));
      const savedUpdatedAt = Number(localStorage.getItem(SETTINGS_UPDATED_AT_KEY) || '0');
      const normalizedUpdatedAt = Number.isFinite(savedUpdatedAt) ? savedUpdatedAt : 0;
      workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(workspaceSettingsIntentRef.current, savedIntent);
      if (savedSettings) {
        const parsed = sanitizeWorkspaceSettings(JSON.parse(savedSettings));
        workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(
          buildWorkspaceSettingsIntentPatch(parsed, normalizedUpdatedAt),
          workspaceSettingsIntentRef.current
        );
        setWorkspaceSettings((prev) => mergeIncomingWorkspaceSettings(prev, parsed, normalizedUpdatedAt));
      }
      workspaceSettingsUpdatedAtRef.current = normalizedUpdatedAt;
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
      const scopedIntent = sanitizeWorkspaceSettingsIntent(parseJson(localStorage.getItem(getWorkspaceSettingsIntentKey(workspaceId)), null));
      workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(workspaceSettingsIntentRef.current, scopedIntent);
      const scopedSettings = localStorage.getItem(getWorkspaceSettingsKey(workspaceId));
      const scopedUpdatedAt = Number(localStorage.getItem(getWorkspaceSettingsUpdatedAtKey(workspaceId)) || '0');
      const normalizedUpdatedAt = Number.isFinite(scopedUpdatedAt) ? scopedUpdatedAt : 0;
      if (scopedSettings) {
        const parsed = sanitizeWorkspaceSettings(JSON.parse(scopedSettings));
        workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(
          buildWorkspaceSettingsIntentPatch(parsed, normalizedUpdatedAt),
          workspaceSettingsIntentRef.current
        );
        setWorkspaceSettings((prev) => mergeIncomingWorkspaceSettings(prev, parsed, normalizedUpdatedAt));
      }
      if (normalizedUpdatedAt > workspaceSettingsUpdatedAtRef.current) {
        workspaceSettingsUpdatedAtRef.current = normalizedUpdatedAt;
      }
    } catch (error) {
      console.warn('Failed to load workspace-scoped settings cache', error);
    }
  }, [mergeIncomingWorkspaceSettings, workspaceId]);

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
            const effectiveUpdatedAt = serverUpdatedAt || Date.now();
            const merged = mergeIncomingWorkspaceSettings(prev, serverSettings, effectiveUpdatedAt);
            persistWorkspaceSettingsCache(merged, effectiveUpdatedAt);
            workspaceSettingsUpdatedAtRef.current = effectiveUpdatedAt;
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
      // Guard: the persistSettings effect and the load effect run in the same React
      // batch. workspaceSettings is still at defaults (sessionId='live') while the
      // load effect has already set the intent ref to the stored custom value.
      // Writing 'live' here would clobber the stored custom session before the
      // corrective re-render fires. Skip this write; the re-render will persist
      // the correct value in the next effect invocation.
      const intentSession = workspaceSettingsIntentRef.current.sessionId;
      if (
        isFallbackSessionId(workspaceSettings.sessionId) &&
        intentSession?.value && !isFallbackSessionId(intentSession.value)
      ) return;

      // 1. Save to local first for speed
      persistWorkspaceSettingsCache(workspaceSettings, updatedAt);

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
              const pendingIntent = pendingProtectedSettingsSaveRef.current;
              if (Object.keys(pendingIntent).length > 0) {
                workspaceSettingsIntentRef.current = mergeWorkspaceSettingsIntent(workspaceSettingsIntentRef.current, {
                  remoteAdminEmails: pendingIntent.remoteAdminEmails
                    ? { ...pendingIntent.remoteAdminEmails, updatedAt: remoteUpdatedAt }
                    : undefined,
                  sessionId: pendingIntent.sessionId
                    ? { ...pendingIntent.sessionId, updatedAt: remoteUpdatedAt }
                    : undefined,
                });
                localStorage.setItem(SETTINGS_INTENT_KEY, JSON.stringify(workspaceSettingsIntentRef.current));
                localStorage.setItem(getWorkspaceSettingsIntentKey(workspaceId), JSON.stringify(workspaceSettingsIntentRef.current));
                pendingProtectedSettingsSaveRef.current = {};
              }
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
          setSyncIssue('Settings sync failed (local values preserved). Retry by clicking Save Settings.');
        }
      }
    };

    persistSettings();
  }, [persistWorkspaceSettingsCache, workspaceSettings, user, workspaceId]);

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
      applyHydratedStudioState({
        schedule: Array.isArray(payload.schedule) && payload.schedule.length > 0 ? payload.schedule : undefined,
        selectedItemId: typeof payload.selectedItemId === 'string' ? payload.selectedItemId : undefined,
        activeItemId: typeof payload.activeItemId === 'string' ? payload.activeItemId : null,
        activeSlideIndex: typeof payload.activeSlideIndex === 'number' ? payload.activeSlideIndex : undefined,
      });
      if (Object.prototype.hasOwnProperty.call(payload, 'holdScreenMode')) {
        setHoldScreenMode(sanitizeHoldScreenMode(payload.holdScreenMode));
      }
      if (payload.audienceQrProjection && typeof payload.audienceQrProjection === 'object') {
        const incomingQrProjection = sanitizeAudienceQrProjectionState(payload.audienceQrProjection);
        setAudienceQrProjection((prev) => (
          incomingQrProjection.updatedAt >= (prev.updatedAt || 0)
            ? incomingQrProjection
            : prev
        ));
      }
      if (payload.stageTimerFlash && typeof payload.stageTimerFlash === 'object') {
        const incomingFlash = sanitizeStageTimerFlashState(payload.stageTimerFlash);
        setStageTimerFlash((prev) => (
          incomingFlash.updatedAt >= (prev.updatedAt || 0)
            ? incomingFlash
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
            setWorkspaceSettings((prev) => mergeIncomingWorkspaceSettings(prev, snapshotSettings, snapshotSettingsUpdatedAt));
          }
        }
      }
    })();
  }, [workspaceId, user?.uid, user, applyHydratedStudioState]);

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

  // Removed: Auto-reset sidebar to SCHEDULE in Presenter mode

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const previewNode = stagePreviewFrameRef.current;
    const editorNode = stageEditorFrameRef.current;
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const width = Math.max(320, Math.round(entry.contentRect.width));
        const height = Math.max(180, Math.round(entry.contentRect.height));
        if (entry.target === previewNode) {
          setStagePreviewViewport((prev) => (
            prev.width === width && prev.height === height ? prev : { width, height }
          ));
        }
        if (entry.target === editorNode) {
          setStageEditorViewport((prev) => (
            prev.width === width && prev.height === height ? prev : { width, height }
          ));
        }
      });
    });
    if (previewNode) observer.observe(previewNode);
    if (editorNode) observer.observe(editorNode);
    return () => observer.disconnect();
  }, [isStagePreviewEditorOpen, viewMode]);

  useEffect(() => {
    if (!isStagePreviewEditorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsStagePreviewEditorOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStagePreviewEditorOpen]);

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
    logActivity(loggedInUser.uid, 'SESSION_START');
    setViewState('studio'); // Transition to app
  };

  const handleLogout = () => {
    if (user) logActivity(user.uid, 'SESSION_END');
    if (isFirebaseConfigured() && auth) auth.signOut();
    // Clear any cached sensitive creds so a logged-out session cannot hit CCLI
    initCcliProvider(null, null);
    setCcliActor(null, null);
    setCcliConnected(false);
    setUser(null);
    // Close modals so nothing from the authenticated UI leaks through
    setIsProfileOpen(false);
    // Always route to the login gate. In Electron this is 'studio', which the
    // auth guard below will render as <LoginScreen>. In a browser, 'landing'
    // shows the public landing page.
    setViewState(isElectronShell ? 'studio' : 'landing');
  };

  useEffect(() => {
    if (!user) return;
    const id = window.setTimeout(() => {
      const persistedWorkspaceSettings = mergeStoredStageLayoutsIntoWorkspaceSettings(workspaceSettings);
      const saveData = {
        schedule,
        selectedItemId,
        viewMode,
        sidebarPinned,
        activeItemId,
        activeSlideIndex,
        blackout,
        holdScreenMode,
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
        stageTimerFlash,
        stageAlert,
        stageMessageCenter,
        workspaceSettings: persistedWorkspaceSettings,
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
  }, [schedule, selectedItemId, viewMode, sidebarPinned, activeItemId, activeSlideIndex, blackout, holdScreenMode, isPlaying, outputMuted, seekCommand, seekAmount, lowerThirdsEnabled, routingMode, timerMode, timerDurationMin, timerSeconds, currentCueItemId, audienceDisplay, audienceQrProjection, stageTimerFlash, stageAlert, stageMessageCenter, workspaceSettings, user]);

  useEffect(() => {
    const safeWorkspaceId = String(workspaceId || '').trim();
    if (!safeWorkspaceId || !user?.uid) return;

    const localUrls = new Set<string>();
    for (const item of schedule) {
      const themeUrl = String(item.theme?.backgroundUrl || '').trim();
      if (themeUrl.startsWith('local://')) localUrls.add(themeUrl);
      for (const slide of item.slides) {
        const slideUrl = String(slide.backgroundUrl || '').trim();
        if (slideUrl.startsWith('local://')) localUrls.add(slideUrl);
      }
    }
    if (!localUrls.size) return;

    for (const localUrl of localUrls) {
      if (pendingSharedMediaUploadsRef.current.has(localUrl)) continue;
      pendingSharedMediaUploadsRef.current.add(localUrl);
      void (async () => {
        try {
          const media = await getMediaBinary(localUrl);
          if (!media?.buffer) return;
          const uploaded = await uploadWorkspaceMedia(safeWorkspaceId, user, {
            name: media.name || `${media.id}.${media.kind === 'image' ? 'png' : 'bin'}`,
            mimeType: media.mimeType || 'application/octet-stream',
            buffer: media.buffer,
          });
          const sharedUrl = String(uploaded?.url || '').trim();
          if (!uploaded?.ok || !sharedUrl) return;
          setSchedule((prev) => replaceMediaUrlAcrossSchedule(prev, localUrl, sharedUrl));
        } catch {
          // Keep the local asset when shared-media upload is unavailable.
        } finally {
          pendingSharedMediaUploadsRef.current.delete(localUrl);
        }
      })();
    }
  }, [schedule, workspaceId, user]);



  // Sync the schedule snapshot only when the schedule itself changes — NOT on
  // every slide navigation. Slide navigation is synced separately via the live
  // state effect below. This prevents re-uploading the entire (potentially
  // large) schedule JSON every time the presenter taps the next slide.
  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    const updatedAt = Date.now();
    const settingsUpdatedAt = workspaceSettingsUpdatedAtRef.current || updatedAt;
    syncLiveState({
      scheduleSnapshot: stripScheduleDataUrls(schedule),
      scheduleSnapshotAt: updatedAt,
      workspaceSettings,
      workspaceSettingsUpdatedAt: settingsUpdatedAt,
      holdScreenMode,
      audienceQrProjection,
      stageTimerFlash,
      stageMessageCenter,
      stageAlert: legacyAlertFromMessageCenter(stageMessageCenter),
      controllerOwnerUid: user.uid,
      controllerOwnerEmail: user.email || null,
      controllerAllowedEmails: allowedAdminEmails,
    });
  }, [
    schedule,
    workspaceSettings,
    holdScreenMode,
    audienceQrProjection,
    stageTimerFlash,
    stageMessageCenter,
    user?.uid,
    user?.email,
    allowedAdminEmails,
    syncLiveState,
    stripScheduleDataUrls,
    cloudBootstrapComplete,
    user,
  ]);

  // Persist the full playlist + workspace snapshot (includes navigation state).
  // This is separate from the live-state sync above so schedule re-uploads are
  // not triggered by slide navigation.
  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    const updatedAt = Date.now();
    const settingsUpdatedAt = workspaceSettingsUpdatedAtRef.current || updatedAt;
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
          holdScreenMode,
          audienceQrProjection,
          stageTimerFlash,
          stageMessageCenter,
          updatedAt,
        });
        await saveWorkspaceSnapshot(workspaceId, user, {
          schedule: stripScheduleDataUrls(schedule),
          selectedItemId,
          activeItemId,
          activeSlideIndex,
          workspaceSettings,
          workspaceSettingsUpdatedAt: settingsUpdatedAt,
          holdScreenMode,
          audienceQrProjection,
          stageTimerFlash,
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
    holdScreenMode,
    audienceQrProjection,
    stageTimerFlash,
    stageMessageCenter,
    user?.uid,
    reportSyncFailure,
    cloudBootstrapComplete,
    cloudPlaylistId,
    workspaceId,
    user,
    stripScheduleDataUrls,
  ]);

  useEffect(() => {
    if (viewMode === 'PRESENTER' && activeSlideRef.current) {
      activeSlideRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeSlideIndex, activeItemId, viewMode]);

  const hasSavedSession = (() => {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch {
      return false;
    }
  })();

  // Memoize to avoid new object references on every render (e.g. from timer ticks).
  // Without this, SmartSlideEditor's init useEffect re-runs on every App re-render
  // and resets in-progress slide edits mid-upload.
  const selectedItem = useMemo(
    () => schedule.find(i => i.id === selectedItemId) || null,
    [schedule, selectedItemId],
  );
  const activeItem = useMemo(
    () => schedule.find(i => i.id === activeItemId) || null,
    [schedule, activeItemId],
  );
  const activeSlide = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex] : null;

  // Detect PPTX visual items in the schedule (imported MEDIA, excluding video-url items)
  const hasPptxImportedItems = useMemo(() =>
    schedule.some(item =>
      item.type === ItemType.MEDIA &&
      item.metadata?.source === 'import' &&
      // Exclude video URL items: they share source='import' in legacy data but
      // are never PPTX decks. PPTX slides never carry mediaType='video'.
      item.theme?.mediaType !== 'video' &&
      !item.slides.some(s => s.mediaType === 'video'),
    ),
    [schedule],
  );
  // Detect Bible items using the split-panel style (SVG data URI background)
  const hasSplitPanelBibleItems = useMemo(() =>
    schedule.some(item =>
      item.type === ItemType.BIBLE &&
      item.slides.some(s => typeof s.backgroundUrl === 'string' && s.backgroundUrl.startsWith('data:image/svg+xml')),
    ),
    [schedule],
  );
  const splitPanelPptxConflict = hasPptxImportedItems && hasSplitPanelBibleItems;
  // Re-show the warning if the conflict reappears after being dismissed
  useEffect(() => {
    if (!splitPanelPptxConflict) setSplitPanelConflictDismissed(false);
  }, [splitPanelPptxConflict]);
  const presenterExperience = sanitizePresenterExperience(workspaceSettings.presenterExperience);
  const isPresenterBeta = viewMode === 'PRESENTER' && presenterExperience === 'next_gen_beta';
  const previewLowerThirds = lowerThirdsEnabled;
  const nextSlidePreview = activeItem && activeSlideIndex >= 0 ? activeItem.slides[activeSlideIndex + 1] || null : null;
  const lobbyItem = schedule.find((item) => item.type === ItemType.ANNOUNCEMENT) || activeItem;
  const activeScheduleIndex = activeItemId ? schedule.findIndex((item) => item.id === activeItemId) : -1;
  const presenterUpcomingItems = activeScheduleIndex >= 0
    ? schedule.slice(activeScheduleIndex + 1)
    : schedule;
  const presenterPreviewItem = schedule.find((item) => item.id === presenterPreviewSelection.itemId) || selectedItem || activeItem || null;
  const presenterPreviewSlides = presenterPreviewItem?.slides || [];
  const presenterPreviewSlideIndex = presenterPreviewSlides.length > 0
    ? clamp(presenterPreviewSelection.slideIndex, 0, presenterPreviewSlides.length - 1)
    : -1;
  const presenterPreviewSlide = presenterPreviewSlideIndex >= 0 ? presenterPreviewSlides[presenterPreviewSlideIndex] : null;
  const currentLiveBackground = useMemo(
    () => getBackgroundSnapshotFromItem(activeItem, activeSlide),
    [activeItem, activeSlide],
  );
  const activeBackgroundUrl = (activeSlide?.backgroundUrl || activeItem?.theme?.backgroundUrl || '').trim();
  const isActiveVideo = !!activeSlide && (
    activeSlide.mediaType === 'video'
    || (!activeSlide.mediaType && activeItem?.theme.mediaType === 'video')
    || looksLikeVideoUrl(activeBackgroundUrl)
  );

  // Keep epoch refs in sync with play/pause so triggerSeek has accurate time estimates
  useEffect(() => {
    if (!isActiveVideo) return;
    if (isPlaying) {
      const now = Date.now();
      const offset = videoPausedOffsetRef.current;
      videoPlayStartEpochRef.current = now;
      // Broadcast sync epoch so late-loading renderers can catch up
      setVideoSyncEpoch({ epochMs: now, offsetSec: offset });
    } else {
      // Freeze the accumulated offset
      const epoch = videoPlayStartEpochRef.current;
      if (epoch !== null) {
        videoPausedOffsetRef.current = videoPausedOffsetRef.current + (Date.now() - epoch) / 1000;
      }
      videoPlayStartEpochRef.current = null;
    }
  }, [isPlaying, isActiveVideo]);

  const presenterSidebarCompact = isElectronShell && viewMode === 'PRESENTER' && viewportWidth < 1500;
  const presenterShellTight = viewMode === 'PRESENTER' && viewportWidth < 1720;
  const presenterShellVeryTight = viewMode === 'PRESENTER' && viewportWidth < 1540;
  const sidebarExpanded = presenterSidebarCompact ? false : (sidebarPinned || isSidebarHovering);
  const presenterSidebarDrawerVisible = presenterSidebarCompact && (sidebarPinned || presenterSidebarDrawerOpen);
  const sidebarRailWidth = presenterSidebarCompact
    ? 48
    : (sidebarExpanded ? (presenterShellTight ? 176 : 208) : 48);
  const sidebarPanelWidth = viewMode === 'PRESENTER'
    ? (presenterShellVeryTight ? 320 : presenterShellTight ? 336 : 360)
    : 360;
  const sidebarRailWidthClass = 'transition-[width] duration-200 ease-out';
  const sidebarLabelClass = `${sidebarExpanded ? 'opacity-100' : 'opacity-0'} transition-opacity whitespace-nowrap`;
  const presenterQueueSlides = activeItem?.slides || [];
  const presenterQueueActiveIndex = activeItem && activeItem.slides.length > 0
    ? clamp(activeSlideIndex, 0, activeItem.slides.length - 1)
    : -1;
  const presenterQueueCompact = presenterQueueSlides.length > 10;
  const presenterInlineQueueTight = isElectronShell && viewMode === 'PRESENTER' && !presenterSidebarCompact && viewportWidth < 1700;
  const legacyMachineMode = workspaceSettings.machineMode && !isElectronShell;
  const presenterQueueWidth = legacyMachineMode
    ? 0
    : presenterQueueCompact
      ? (presenterSidebarCompact
          ? (presenterShellVeryTight ? 232 : 256)
          : (presenterInlineQueueTight ? (presenterShellVeryTight ? 224 : 244) : (presenterShellVeryTight ? 280 : presenterShellTight ? 304 : 336)))
      : (presenterSidebarCompact
          ? (presenterShellVeryTight ? 240 : 264)
          : (presenterInlineQueueTight ? (presenterShellVeryTight ? 232 : 248) : (presenterShellVeryTight ? 288 : presenterShellTight ? 304 : 320)));
  const presenterSidebarInlineWidth = viewMode === 'PRESENTER' && !presenterSidebarCompact
    ? sidebarRailWidth + sidebarPanelWidth
    : sidebarRailWidth;
  const presenterMainWorkspaceWidth = viewMode === 'PRESENTER'
    ? Math.max(0, viewportWidth - presenterSidebarInlineWidth - presenterQueueWidth - (legacyMachineMode ? 24 : 40))
    : viewportWidth;
  const presenterCardsSingleColumn = viewMode === 'PRESENTER' && presenterMainWorkspaceWidth < 1120;
  const presenterCueEngineStacked = viewMode === 'PRESENTER' && presenterMainWorkspaceWidth < 1240;
  const presenterStageOpsSingleColumn = viewMode === 'PRESENTER' && presenterMainWorkspaceWidth < 1180;
  const presenterStageOpsDense = viewMode === 'PRESENTER' && presenterMainWorkspaceWidth < 1380;
  const presenterTransportDense = viewMode === 'PRESENTER' && presenterMainWorkspaceWidth < 980;
  const presenterPreviewAlignClass = isElectronShell
    ? (presenterMainWorkspaceWidth < 920 ? 'justify-center px-3' : 'justify-start px-4')
    : 'justify-center';
  const presenterQueueUpNext = useMemo(() => {
    if (presenterQueueActiveIndex < 0) return [];
    const upNextCount = presenterQueueCompact ? 3 : 4;
    return presenterQueueSlides
      .map((slide, idx) => ({ slide, idx }))
      .filter((entry) => entry.idx > presenterQueueActiveIndex)
      .slice(0, upNextCount);
  }, [presenterQueueSlides, presenterQueueActiveIndex, presenterQueueCompact]);
  const presenterQueueRemaining = useMemo(() => {
    const excluded = new Set(presenterQueueUpNext.map((entry) => entry.slide.id));
    return presenterQueueSlides
      .map((slide, idx) => ({ slide, idx }))
      .filter((entry) => entry.idx !== presenterQueueActiveIndex && !excluded.has(entry.slide.id));
  }, [presenterQueueSlides, presenterQueueActiveIndex, presenterQueueUpNext]);

  const persistBackgroundSnapshotForProjection = useCallback(async (
    snapshot: BackgroundSnapshot | null | undefined,
  ): Promise<BackgroundSnapshot | null> => {
    const backgroundUrl = String(snapshot?.backgroundUrl || '').trim();
    if (!backgroundUrl || !snapshot) return null;
    if (snapshot.mediaType === 'color') {
      return {
        ...snapshot,
        backgroundFallbackUrl: backgroundUrl,
        backgroundFallbackMediaType: 'color',
      };
    }

    // Data URIs (SVG split-panel, gradient backgrounds) are self-contained in memory.
    // Never fetch, save, or replace them — doing so would swap the instant data URI for
    // a local:// URL that requires an async round-trip, causing "BACKGROUND UNAVAILABLE".
    if (isDataMediaUrl(backgroundUrl)) {
      return { ...snapshot };
    }

    const sourceUrl = String(snapshot.backgroundSourceUrl || (isRemoteMediaUrl(backgroundUrl) ? backgroundUrl : '') || '').trim();
    const provider = inferSavedBackgroundProvider(sourceUrl, backgroundUrl, snapshot.backgroundProvider || '');
    const category = inferSavedBackgroundCategory(sourceUrl, backgroundUrl, snapshot.backgroundCategory || '', provider);
    const title = inferSavedBackgroundTitle(sourceUrl, backgroundUrl, snapshot.backgroundTitle || '', category);
    const existingFallbackUrl = String(snapshot.backgroundFallbackUrl || '').trim();
    const isBuiltIn = isBuiltInBackgroundUrl(backgroundUrl) || isBuiltInBackgroundUrl(sourceUrl);

    const withSavedDescriptor = (
      localUrl: string,
      overrides?: { sourceUrl?: string; provider?: string; category?: string; title?: string },
    ): BackgroundSnapshot => ({
      ...snapshot,
      backgroundUrl: localUrl,
      backgroundFallbackUrl: localUrl,
      backgroundFallbackMediaType: snapshot.mediaType,
      backgroundSourceUrl: overrides?.sourceUrl || sourceUrl || undefined,
      backgroundProvider: overrides?.provider || provider,
      backgroundCategory: overrides?.category || category,
      backgroundTitle: overrides?.title || title,
    });

    if (isBuiltIn) {
      if (existingFallbackUrl && isProjectionSafeBackgroundUrl(existingFallbackUrl)) {
        return {
          ...snapshot,
          backgroundFallbackUrl: existingFallbackUrl,
          backgroundFallbackMediaType: snapshot.backgroundFallbackMediaType || snapshot.mediaType,
        };
      }
      if (isProjectionSafeBackgroundUrl(backgroundUrl) || getYoutubeId(backgroundUrl)) {
        return {
          ...snapshot,
          backgroundFallbackUrl: backgroundUrl,
          backgroundFallbackMediaType: snapshot.mediaType,
        };
      }
      try {
        const response = await fetch(backgroundUrl);
        if (!response.ok) throw new Error(`BACKGROUND_FETCH_${response.status}`);
        const blob = await response.blob();
        const mediaType = snapshot.mediaType === 'video' ? 'video' : 'image';
        const mimeType = String(blob.type || '').trim() || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
        const fileName = inferRemoteMediaFileName(backgroundUrl, mediaType, mimeType);
        const file = new File([blob], fileName, { type: mimeType });
        const localUrl = await saveMedia(file);
        return {
          ...snapshot,
          backgroundFallbackUrl: localUrl,
          backgroundFallbackMediaType: snapshot.mediaType,
        };
      } catch {
        return {
          ...snapshot,
          backgroundFallbackUrl: existingFallbackUrl || backgroundUrl,
          backgroundFallbackMediaType: snapshot.mediaType,
        };
      }
    }

    if (backgroundUrl.startsWith('local://')) {
      const registered = await registerSavedBackground({
        localUrl: backgroundUrl,
        mediaType: snapshot.mediaType === 'video' ? 'video' : 'image',
        sourceUrl,
        provider,
        category,
        title,
      });
      if (registered) {
        return withSavedDescriptor(registered.localUrl, registered);
      }
      return {
        ...snapshot,
        backgroundFallbackUrl: existingFallbackUrl || backgroundUrl,
        backgroundFallbackMediaType: snapshot.mediaType,
      };
    }

    const knownSavedBackground = await findSavedBackgroundBySourceUrl(sourceUrl || backgroundUrl);
    if (knownSavedBackground) {
      await markSavedBackgroundUsed(knownSavedBackground.localUrl);
      return withSavedDescriptor(knownSavedBackground.localUrl, knownSavedBackground);
    }

    if (existingFallbackUrl.startsWith('local://')) {
      const registered = await registerSavedBackground({
        localUrl: existingFallbackUrl,
        mediaType: snapshot.mediaType === 'video' ? 'video' : 'image',
        sourceUrl: sourceUrl || backgroundUrl,
        provider,
        category,
        title,
      });
      if (registered) {
        return withSavedDescriptor(registered.localUrl, registered);
      }
    }

    if (isProjectionSafeBackgroundUrl(backgroundUrl) || getYoutubeId(backgroundUrl)) {
      return {
        ...snapshot,
        backgroundFallbackUrl: existingFallbackUrl || backgroundUrl,
        backgroundFallbackMediaType: snapshot.mediaType,
        backgroundSourceUrl: sourceUrl || undefined,
        backgroundProvider: provider,
        backgroundCategory: category,
        backgroundTitle: title,
      };
    }

    try {
      const response = await fetch(backgroundUrl);
      if (!response.ok) throw new Error(`BACKGROUND_FETCH_${response.status}`);
      const blob = await response.blob();
      const mediaType = snapshot.mediaType === 'video' ? 'video' : 'image';
      const mimeType = String(blob.type || '').trim() || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const fileName = inferRemoteMediaFileName(sourceUrl || backgroundUrl, mediaType, mimeType);
      const file = new File([blob], fileName, { type: mimeType });
      const savedAsset = await saveBackgroundAsset(file, {
        mediaType,
        sourceUrl: sourceUrl || backgroundUrl,
        provider,
        category,
        title,
      });
      if (savedAsset) {
        return withSavedDescriptor(savedAsset.localUrl, savedAsset);
      }
      const localUrl = await saveMedia(file);
      return {
        ...snapshot,
        backgroundFallbackUrl: localUrl,
        backgroundFallbackMediaType: snapshot.mediaType,
        backgroundSourceUrl: sourceUrl || backgroundUrl,
        backgroundProvider: provider,
        backgroundCategory: category,
        backgroundTitle: title,
      };
    } catch (error) {
      console.warn('Failed to create projector-safe fallback for prevailing live background.', {
        backgroundUrl,
        sourceUrl,
        mediaType: snapshot.mediaType,
        error,
      });
      return {
        ...snapshot,
        backgroundFallbackUrl: existingFallbackUrl || backgroundUrl,
        backgroundFallbackMediaType: snapshot.mediaType,
        backgroundSourceUrl: sourceUrl || undefined,
        backgroundProvider: provider,
        backgroundCategory: category,
        backgroundTitle: title,
      };
    }
  }, []);

  useEffect(() => {
    if (!currentLiveBackground?.backgroundUrl) return;
    prevailingGeneratedBackgroundRef.current = currentLiveBackground;
    const backgroundKey = [
      currentLiveBackground.backgroundUrl,
      currentLiveBackground.mediaType,
      currentLiveBackground.backgroundFallbackUrl || '',
      currentLiveBackground.backgroundFallbackMediaType || '',
    ].join('::');
    if (
      prevailingGeneratedBackgroundKeyRef.current === backgroundKey
      && prevailingGeneratedBackgroundSafeRef.current
    ) {
      prevailingGeneratedBackgroundRef.current = prevailingGeneratedBackgroundSafeRef.current;
      return;
    }
    let cancelled = false;
    void persistBackgroundSnapshotForProjection(currentLiveBackground).then((persistedSnapshot) => {
      if (cancelled || !persistedSnapshot?.backgroundUrl) return;
      if (persistedSnapshot.backgroundUrl !== currentLiveBackground.backgroundUrl) {
        const metadataUpdates = {
          backgroundFallbackUrl: persistedSnapshot.backgroundFallbackUrl || persistedSnapshot.backgroundUrl,
          backgroundFallbackMediaType: persistedSnapshot.backgroundFallbackMediaType || persistedSnapshot.mediaType,
          backgroundSourceUrl: persistedSnapshot.backgroundSourceUrl || currentLiveBackground.backgroundSourceUrl || currentLiveBackground.backgroundUrl,
          backgroundProvider: persistedSnapshot.backgroundProvider,
          backgroundCategory: persistedSnapshot.backgroundCategory,
          backgroundTitle: persistedSnapshot.backgroundTitle,
        };
        setSchedule((prev) => replaceMediaUrlAcrossSchedule(
          prev,
          currentLiveBackground.backgroundUrl,
          persistedSnapshot.backgroundUrl,
          metadataUpdates,
        ));
      }
      prevailingGeneratedBackgroundSafeRef.current = persistedSnapshot;
      prevailingGeneratedBackgroundRef.current = persistedSnapshot;
      prevailingGeneratedBackgroundKeyRef.current = backgroundKey;
    });
    return () => {
      cancelled = true;
    };
  }, [currentLiveBackground, persistBackgroundSnapshotForProjection]);

  const getPrevailingGeneratedBackground = useCallback(() => {
    // 1. If output is live, prefer the current live background (projector-safe when available)
    if (isOutputLive) {
      const liveSnapshot = currentLiveBackground || prevailingGeneratedBackgroundRef.current;
      if (liveSnapshot) {
        const projectorSafeSnapshot = prevailingGeneratedBackgroundSafeRef.current;
        if (
          projectorSafeSnapshot
          && projectorSafeSnapshot.backgroundUrl === liveSnapshot.backgroundUrl
          && projectorSafeSnapshot.mediaType === liveSnapshot.mediaType
        ) {
          return projectorSafeSnapshot;
        }
        return prevailingGeneratedBackgroundRef.current || liveSnapshot;
      }
    }
    // 2. Fall back to user's explicitly stored default background preference
    //    This covers all cases: output not live, no live background, etc.
    return getUserDefaultBackgroundSnapshot();
  }, [currentLiveBackground, isOutputLive]);

  const finalizeGeneratedItemBackground = useCallback((
    item: ServiceItem,
    backgroundSource: ServiceItemBackgroundSource,
  ) => {
    const stampedItem = stampItemBackgroundSource(item, backgroundSource);
    if (backgroundSource !== 'system') return stampedItem;
    return inheritPrevailingBackground(stampedItem, getPrevailingGeneratedBackground());
  }, [getPrevailingGeneratedBackground]);

  const markItemBackgroundAsUserChanged = useCallback((item: ServiceItem, previousItem?: ServiceItem | null) => {
    if (!previousItem) return item;
    const themeChanged = String(previousItem.theme.backgroundUrl || '').trim() !== String(item.theme.backgroundUrl || '').trim()
      || String(previousItem.theme.mediaType || '').trim() !== String(item.theme.mediaType || '').trim();
    const previousSlidesById = new Map(previousItem.slides.map((slide) => [slide.id, slide]));
    const slideBackgroundChanged = item.slides.some((slide) => {
      const previousSlide = previousSlidesById.get(slide.id);
      return String(previousSlide?.backgroundUrl || '').trim() !== String(slide.backgroundUrl || '').trim()
        || String(previousSlide?.mediaType || '').trim() !== String(slide.mediaType || '').trim();
    });
    if (!themeChanged && !slideBackgroundChanged) return item;
    return stampItemBackgroundSource(clearItemBackgroundFallback(item), 'user');
  }, []);

  const prepareItemForGoLive = useCallback((item: ServiceItem) => {
    const nextItem = inheritPrevailingBackground(item, getPrevailingGeneratedBackground());
    if (nextItem === item) return item;
    setSchedule((prev) => prev.map((entry) => (
      entry.id === nextItem.id ? nextItem : entry
    )));
    return nextItem;
  }, [getPrevailingGeneratedBackground]);
  useEffect(() => {
    const nextItem = selectedItem || activeItem || schedule[0] || null;
    if (!nextItem) {
      setPresenterPreviewSelection((prev) => (
        prev.itemId === null && prev.slideIndex === 0 ? prev : { itemId: null, slideIndex: 0 }
      ));
      return;
    }
    const maxSlideIndex = Math.max(0, nextItem.slides.length - 1);
    setPresenterPreviewSelection((prev) => {
      const nextItemId = nextItem.id;
      const suggestedIndex = prev.itemId === nextItemId
        ? clamp(prev.slideIndex, 0, maxSlideIndex)
        : (activeItemId === nextItemId && activeSlideIndex >= 0
          ? clamp(activeSlideIndex, 0, maxSlideIndex)
          : 0);
      if (prev.itemId === nextItemId && prev.slideIndex === suggestedIndex) {
        return prev;
      }
      return {
        itemId: nextItemId,
        slideIndex: suggestedIndex,
      };
    });
  }, [selectedItem, activeItem, schedule, activeItemId, activeSlideIndex]);
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
  const currentCueOvertimeBehavior: 'count-up' | 'stop' | 'flash-and-stop' = (() => {
    if (!currentCue) return 'count-up';
    const presetId = schedule.find((item) => item.id === currentCue.itemId)?.timerCue?.presetId;
    const preset = presetId ? (workspaceSettings.speakerTimerPresets || []).find((p) => p.id === presetId) : null;
    return preset?.overtimeBehavior || 'count-up';
  })();
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
  const speakerTimerPresets = workspaceSettings.speakerTimerPresets || [];
  const presetTargetItemId = currentCueItemId || selectedItemId;
  const presetDraftDurationSec = clamp(Math.round(Number(presetDraft.durationSec) || 300), 10, 7200);
  const presetDraftHours = Math.floor(presetDraftDurationSec / 3600);
  const presetDraftMinutes = Math.floor((presetDraftDurationSec % 3600) / 60);
  const presetDraftSeconds = presetDraftDurationSec % 60;
  const presetDraftThresholds = normalizeSpeakerTimerThresholds(presetDraft.amberPercent, presetDraft.redPercent);
  const presetDraftRunwayPercent = Math.max(0, 100 - presetDraftThresholds.amberPercent);
  const presetDraftAmberZonePercent = Math.max(0, presetDraftThresholds.amberPercent - presetDraftThresholds.redPercent);
  const presetDraftRedZonePercent = presetDraftThresholds.redPercent;
  const presetDraftAmberRemainingSec = Math.max(1, Math.round(presetDraftDurationSec * (presetDraftThresholds.amberPercent / 100)));
  const presetDraftRedRemainingSec = Math.max(1, Math.round(presetDraftDurationSec * (presetDraftThresholds.redPercent / 100)));
  const presetDraftRunwaySec = Math.max(0, presetDraftDurationSec - presetDraftAmberRemainingSec);
  const presetDraftAmberWindowSec = Math.max(0, presetDraftAmberRemainingSec - presetDraftRedRemainingSec);
  const presetDraftRedStartSec = Math.max(0, presetDraftDurationSec - presetDraftRedRemainingSec);
  const presetDraftDisplayName = presetDraft.name.trim() || 'Untitled Timer';
  const presetDraftSpeakerLabel = presetDraft.speakerName?.trim() || 'Speaker slot ready';
  const activePresetCardId = editingPresetId || selectedSpeakerPresetId;
  const presetStudioIsWide = presetStudioWidthMode === 'wide';
  const presetStudioSaveLabel = presetStudioSaveState
    ? `${presetStudioSaveState.mode === 'updated' ? 'Updated' : 'Saved'} just now`
    : '';
  const presetStudioShellWidthClass = presetStudioIsWide
    ? 'max-w-[min(96vw,1680px)]'
    : 'max-w-6xl';
  const presetStudioBodyGridClass = presetStudioIsWide
    ? 'grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)]'
    : 'grid min-h-0 flex-1 grid-cols-1 2xl:grid-cols-[320px_minmax(0,1fr)]';
  const presetStudioEditorGridClass = presetStudioIsWide
    ? 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1.12fr)_340px]'
    : 'grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]';
  const presetStudioHeroGridClass = presetStudioIsWide
    ? 'grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px] xl:gap-3'
    : 'grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-start';
  const presetStudioHeroTimerClass = presetStudioIsWide
    ? 'mt-1 max-w-full whitespace-nowrap text-[clamp(2.25rem,4.5vw,4rem)] font-semibold leading-[0.88] tracking-tight text-white'
    : 'mt-1 max-w-full whitespace-nowrap text-[clamp(1.75rem,5.5vw,2.75rem)] font-semibold leading-[0.86] tracking-tight text-white';
  const presetStudioHeroSectionPaddingClass = presetStudioIsWide ? 'p-3 md:p-3.5' : 'p-2';
  const presetStudioHeroBehaviorCardClass = presetStudioIsWide
    ? 'min-w-0 rounded-[18px] border border-white/10 bg-black/25 p-2.5'
    : 'min-w-0 rounded-[14px] border border-white/10 bg-black/25 p-2';
  const presetStudioHeroBehaviorCopy = '';
  const presetStudioHeroSummaryGridClass = presetStudioIsWide
    ? 'mt-2.5 grid gap-2 sm:grid-cols-3'
    : 'mt-2 grid gap-1.5 sm:grid-cols-3';
  const presetStudioHeroSummaryCardClass = presetStudioIsWide
    ? 'rounded-[16px] border border-white/10 bg-black/20 p-2.5'
    : 'rounded-[14px] border border-white/10 bg-black/20 p-2';
  const presetStudioHeroSummaryValueClass = presetStudioIsWide
    ? 'mt-1 text-xl font-semibold text-white'
    : 'mt-0.5 text-lg font-semibold leading-none text-white';
  const presetStudioHeroEyebrow = editingPresetId ? 'Editing' : 'New preset';
  const presetStudioLibraryCopy = '';
  const presetStudioRunwayCopy = '';
  const presetStudioAmberCopy = '';
  const presetStudioRedCopy = '';
  const presetStudioFlightPlanCopies = { amber: '', red: '', finish: '' };
  const presetStudioOperatorNotes = ['Presets persist across studio, presenter, and stage.'];
  const presetStudioCommitCopy = '';
  const presetStudioNameHelperCopy = '';
  const presetStudioSpeakerHelperCopy = '';
  const presetStudioDurationHeading = '';
  const presetStudioThresholdHeading = '';
  const presetStudioCueBehaviorHeading = '';
  const presetStudioCueBehaviorSectionCopy = '';
  const syncIssueDisplay = useMemo(() => {
    if (!syncIssue) return null;
    const issue = String(syncIssue || '').trim();
    const queuedLabel = syncPendingCount > 0
      ? `${syncPendingCount} pending update${syncPendingCount === 1 ? '' : 's'} will retry automatically.`
      : 'Lumina will keep retrying in the background.';

    if (issue.startsWith('Cloud sharing needs permission.')) {
      return {
        id: 'cloud-sharing-permission',
        title: 'Cloud sync needs your attention',
        summary: 'This machine is still driving the live service normally through the local Lumina server.',
        steps: [
          'Keep presenting. Projector, stage, and local output stay active here.',
          'Your saved Remote Intelligence emails and Active Session ID remain available on this machine.',
          'If teammates need cloud updates, sign in with the approved workspace account after service.',
        ],
        detail: 'Cloud sharing is blocked for the current account, but local live control and saved workspace identity are still healthy.',
      };
    }

    if (issue.startsWith('Cloud sync will retry in')) {
      return {
        id: 'cloud-sync-backoff',
        title: 'Cloud sync is temporarily paused',
        summary: 'Lumina is still saving your live work locally on this machine.',
        steps: [
          queuedLabel,
          'If this keeps coming back, check your internet connection or workspace permissions.',
        ],
        detail: issue,
      };
    }

    if (issue.startsWith('Settings sync failed')) {
      return {
        id: 'settings-sync-failed',
        title: 'Workspace settings could not reach the cloud',
        summary: 'Your local settings are still safe on this machine, including Remote Intelligence emails and the active session value.',
        steps: [
          'Keep working normally in Lumina.',
          'When the connection settles, re-open the workspace and sync again.',
        ],
        detail: issue,
      };
    }

    return {
      id: `generic-${normalizeSyncIssueId(issue)}`,
      title: 'Sync needs attention',
      summary: 'Lumina is protecting your local work, but cloud updates need another try.',
      steps: [
        queuedLabel,
        'Finish the service locally, then check connection or account access before retrying.',
      ],
      detail: issue,
    };
  }, [syncIssue, syncPendingCount]);
  const dismissedSyncGuidanceKey = useMemo(() => {
    if (!syncIssueDisplay?.id) return null;
    return buildSyncGuidanceStorageKey(workspaceId, user?.uid, syncIssueDisplay.id);
  }, [syncIssueDisplay?.id, user?.uid, workspaceId]);
  const showSyncGuidance = Boolean(
    syncIssueDisplay
    && (!dismissedSyncGuidanceKey || !dismissedSyncGuidance[dismissedSyncGuidanceKey])
  );
  const dismissSyncGuidance = useCallback(() => {
    if (dismissedSyncGuidanceKey) {
      setDismissedSyncGuidance((prev) => ({
        ...prev,
        [dismissedSyncGuidanceKey]: Date.now(),
      }));
    }
    setSyncIssue(null);
  }, [dismissedSyncGuidanceKey]);
  const renderSpeakerPresetThresholdBar = (
    amberPercent: number,
    redPercent: number,
    options?: { compact?: boolean }
  ) => {
    const { amberPercent: safeAmber, redPercent: safeRed } = normalizeSpeakerTimerThresholds(amberPercent, redPercent);
    const safePercent = Math.max(0, 100 - safeAmber);
    const amberBandPercent = Math.max(0, safeAmber - safeRed);
    const redBandPercent = safeRed;
    const compact = !!options?.compact;
    return (
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        <div className={`overflow-hidden rounded-full border border-white/10 bg-zinc-950/80 ${compact ? 'h-2.5' : 'h-3.5'}`}>
          <div className="flex h-full w-full">
            <div
              className="bg-[linear-gradient(90deg,rgba(16,185,129,0.95),rgba(34,211,238,0.9))]"
              style={{ width: `${safePercent}%` }}
            />
            <div
              className="bg-[linear-gradient(90deg,rgba(252,211,77,0.96),rgba(245,158,11,0.95))]"
              style={{ width: `${amberBandPercent}%` }}
            />
            <div
              className="bg-[linear-gradient(90deg,rgba(251,113,133,0.96),rgba(225,29,72,0.98))]"
              style={{ width: `${redBandPercent}%` }}
            />
          </div>
        </div>
        {!compact && (
          <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            <div>Runway {safePercent}%</div>
            <div className="text-center text-amber-200/80">Amber {safeAmber}%</div>
            <div className="text-right text-rose-200/80">Red {safeRed}%</div>
          </div>
        )}
      </div>
    );
  };
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
  const cleanFeedUrl = typeof window !== 'undefined'
    ? `${buildSharedRouteUrl('output')}&clean=1`
    : `/#/output?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}&fullscreen=1&clean=1`;
  const remoteControlUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('remote')
    : `/#/remote?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}`;
  const stageDisplayUrl = typeof window !== 'undefined'
    ? buildSharedRouteUrl('stage')
    : `/#/stage?session=${encodeURIComponent(liveSessionId)}&workspace=${encodeURIComponent(workspaceId)}`;
  const electronMachineApi = typeof window !== 'undefined' ? window.electron?.machine : undefined;
  const hasElectronDisplayControl = !!(isElectronShell && electronMachineApi?.listDisplays && electronMachineApi?.startService);

  const buildAutoDisplayMapping = useCallback((displays: DesktopDisplayInfo[]): DesktopDisplayMapping => {
    const orderedDisplays = [...displays];
    const primary = orderedDisplays.find((display) => display.isPrimary) || orderedDisplays[0] || null;
    const externalDisplays = orderedDisplays
      .filter((display) => !display.isInternal)
      .sort((left, right) => (right.bounds.width * right.bounds.height) - (left.bounds.width * left.bounds.height));
    const audience = externalDisplays[0]
      || orderedDisplays.find((display) => display.id !== primary?.id)
      || primary;
    const stage = orderedDisplays.find((display) => display.id !== primary?.id && display.id !== audience?.id)
      || externalDisplays.find((display) => display.id !== audience?.id && display.id !== primary?.id)
      || null;
    const roleByDisplayId = new Map<number, DisplayRole>();
    if (primary) roleByDisplayId.set(primary.id, 'control');
    if (audience && audience.id !== primary?.id) roleByDisplayId.set(audience.id, 'audience');
    if (stage && stage.id !== primary?.id && stage.id !== audience?.id) roleByDisplayId.set(stage.id, 'stage');

    return {
      assignments: orderedDisplays.map((display) => ({
        role: roleByDisplayId.get(display.id) || 'none',
        displayId: display.id,
        displayKey: display.key,
      })),
      updatedAt: Date.now(),
    };
  }, []);

  const getMappedRoleForDisplay = useCallback((display: DesktopDisplayInfo) => {
    const exact = desktopDisplayMapping.assignments.find((entry) => entry.displayId === display.id);
    if (exact) return exact.role;
    const keyed = desktopDisplayMapping.assignments.find((entry) => entry.displayKey && entry.displayKey === display.key);
    return keyed?.role || 'none';
  }, [desktopDisplayMapping.assignments]);

  const desktopDisplayCards = useMemo<DesktopDisplayCard[]>(() => {
    return desktopDisplays.map((display) => {
      const role = getMappedRoleForDisplay(display);
      const liveStatus = (
        (role === 'audience' && desktopServiceState.outputOpen)
        || (role === 'stage' && desktopServiceState.stageOpen)
        || (role === 'control' && desktopServiceState.controlDisplayId === display.id)
      ) ? 'active' : 'idle';
      return {
        id: display.id,
        key: display.key,
        name: display.name,
        role,
        isPrimary: display.isPrimary,
        isInternal: display.isInternal,
        width: display.bounds.width,
        height: display.bounds.height,
        scaleFactor: display.scaleFactor,
        x: display.bounds.x,
        y: display.bounds.y,
        liveStatus,
      };
    });
  }, [desktopDisplays, desktopServiceState.controlDisplayId, desktopServiceState.outputOpen, desktopServiceState.stageOpen, getMappedRoleForDisplay]);

  const desktopRoleAssignments = useMemo(() => {
    const entries: Record<Exclude<DisplayRole, 'none'>, number | null> = {
      control: null,
      audience: null,
      stage: null,
    };
    desktopDisplayCards.forEach((display) => {
      if (display.role !== 'none') {
        entries[display.role] = display.id;
      }
    });
    return entries;
  }, [desktopDisplayCards]);

  const desktopDisplayValidationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!desktopRoleAssignments.control) {
      errors.push('Assign one control display.');
    }
    if (!desktopRoleAssignments.audience) {
      errors.push('Assign one audience display.');
    }
    return errors;
  }, [desktopRoleAssignments.audience, desktopRoleAssignments.control]);

  const persistDesktopDisplayMapping = useCallback((mapping: DesktopDisplayMapping, message?: string) => {
    setDesktopDisplayMapping(mapping);
    writeDesktopDisplayMapping(mapping);
    if (message) {
      setDesktopDisplayStatusText(message);
    }
  }, []);

  const refreshDesktopDisplays = useCallback(async () => {
    if (!hasElectronDisplayControl) return;
    try {
      const nextDisplays = await electronMachineApi?.listDisplays?.();
      if (Array.isArray(nextDisplays)) {
        setDesktopDisplays(nextDisplays);
      }
    } catch (error) {
      console.error('Failed to enumerate desktop displays', error);
      setDesktopDisplayStatusText('Could not refresh connected displays.');
    }
  }, [electronMachineApi, hasElectronDisplayControl]);

  const handleDesktopRoleChange = useCallback((displayId: number, role: DisplayRole) => {
    const nextAssignments = desktopDisplays.map((display) => {
      const currentRole = getMappedRoleForDisplay(display);
      let nextRole: DisplayRole = currentRole;
      if (display.id === displayId) {
        nextRole = role;
      } else if (role !== 'none' && currentRole === role) {
        nextRole = 'none';
      }
      return {
        role: nextRole,
        displayId: display.id,
        displayKey: display.key,
      };
    });
    persistDesktopDisplayMapping({
      assignments: nextAssignments,
      updatedAt: Date.now(),
    });
  }, [desktopDisplays, getMappedRoleForDisplay, persistDesktopDisplayMapping]);

  const handleDesktopAutoAssign = useCallback(() => {
    if (!desktopDisplays.length) return;
    persistDesktopDisplayMapping(buildAutoDisplayMapping(desktopDisplays), 'Displays auto-assigned. Review and save if needed.');
  }, [buildAutoDisplayMapping, desktopDisplays, persistDesktopDisplayMapping]);

  const handleSaveDesktopDisplayMapping = useCallback(() => {
    persistDesktopDisplayMapping({
      assignments: desktopDisplays.map((display) => ({
        role: getMappedRoleForDisplay(display),
        displayId: display.id,
        displayKey: display.key,
      })),
      updatedAt: Date.now(),
    }, 'Display mapping saved on this machine.');
  }, [desktopDisplays, getMappedRoleForDisplay, persistDesktopDisplayMapping]);

  const handleOpenDisplaySetup = useCallback(() => {
    if (!hasElectronDisplayControl) {
      setWorkspaceSettings(prev => ({ ...prev, machineMode: !prev.machineMode }));
      return;
    }
    setIsDisplaySetupOpen(true);
    void refreshDesktopDisplays();
  }, [hasElectronDisplayControl, refreshDesktopDisplays]);

  const handleStartDesktopService = useCallback(async () => {
    if (!hasElectronDisplayControl) return;
    if (desktopDisplayValidationErrors.length > 0) {
      setDesktopDisplayStatusText(desktopDisplayValidationErrors[0]);
      return;
    }
    try {
      const result = await electronMachineApi?.startService?.({
        workspaceId,
        sessionId: liveSessionId,
        controlDisplayId: desktopRoleAssignments.control,
        audienceDisplayId: desktopRoleAssignments.audience,
        stageDisplayId: desktopRoleAssignments.stage,
      });
      if (result?.ok && result.state) {
        setDesktopServiceState(result.state);
        setIsOutputLive(!!result.state.outputOpen);
        setIsStageDisplayLive(!!result.state.stageOpen);
        setPopupBlocked(false);
        setOutputWin(null);
        setStageWin(null);
        setDesktopDisplayStatusText(
          desktopRoleAssignments.stage
            ? 'Service started across control, audience, and stage displays.'
            : 'Service started. No stage screen assigned.'
        );
        handleSaveDesktopDisplayMapping();
        setIsDisplaySetupOpen(false);
      } else {
        setDesktopDisplayStatusText('Could not start service on the selected displays.');
      }
    } catch (error) {
      console.error('Failed to start desktop service', error);
      setDesktopDisplayStatusText('Desktop service launch failed.');
    }
  }, [desktopDisplayValidationErrors.length, desktopRoleAssignments.audience, desktopRoleAssignments.control, desktopRoleAssignments.stage, electronMachineApi, handleSaveDesktopDisplayMapping, hasElectronDisplayControl, liveSessionId, workspaceId]);

  useEffect(() => {
    if (!hasElectronDisplayControl) return;
    void refreshDesktopDisplays();
    void electronMachineApi?.getServiceState?.().then((state) => {
      if (state) {
        setDesktopServiceState(state);
        setIsOutputLive(!!state.outputOpen);
        setIsStageDisplayLive(!!state.stageOpen);
      }
    });
    const offDisplays = electronMachineApi?.onDisplaysChanged?.((payload) => {
      if (Array.isArray(payload)) {
        setDesktopDisplays(payload);
      }
    });
    const offService = electronMachineApi?.onServiceState?.((payload) => {
      setDesktopServiceState(payload);
      setIsOutputLive(!!payload.outputOpen);
      setIsStageDisplayLive(!!payload.stageOpen);
      if (payload.outputOpen || payload.stageOpen) {
        setPopupBlocked(false);
        setOutputWin(null);
        setStageWin(null);
      }
    });
    return () => {
      offDisplays?.();
      offService?.();
    };
  }, [electronMachineApi, hasElectronDisplayControl, refreshDesktopDisplays]);

  // Subscribe to NDI sender state pushed from main process.
  useEffect(() => {
    if (!isElectronShell) return;
    const off = window.electron?.ndi?.onState?.((state: { active: boolean; sourceName: string }) => {
      setNdiActive(state.active);
    });
    return () => off?.();
  }, [isElectronShell]);

  useEffect(() => {
    if (!hasElectronDisplayControl) return;
    if (!desktopDisplays.length) return;
    if (desktopDisplayMapping.assignments.length > 0) return;
    const nextMapping = buildAutoDisplayMapping(desktopDisplays);
    setDesktopDisplayMapping(nextMapping);
    writeDesktopDisplayMapping(nextMapping);
  }, [buildAutoDisplayMapping, desktopDisplayMapping.assignments.length, desktopDisplays, hasElectronDisplayControl]);
  const goLiveNextItem = () => {
    const idx = schedule.findIndex(i => i.id === activeItemId);
    const nextIdx = idx + 1;
    if (nextIdx < schedule.length) {
      setActiveItemId(schedule[nextIdx].id);
      setActiveSlideIndex(0);
    }
  };

  const goLivePrevItem = () => {
    const idx = schedule.findIndex(i => i.id === activeItemId);
    const prevIdx = idx - 1;
    if (prevIdx >= 0) {
      setActiveItemId(schedule[prevIdx].id);
      setActiveSlideIndex(0);
    }
  };

  const toggleBlackout = () => setBlackout(!blackout);

  const estimateVideoTime = () => {
    const epoch = videoPlayStartEpochRef.current;
    const offset = videoPausedOffsetRef.current;
    if (epoch === null) return offset;
    return offset + (Date.now() - epoch) / 1000;
  };

  const triggerSeek = (seconds: number) => {
    const target = Math.max(0, estimateVideoTime() + seconds);
    const now = Date.now();
    // Update the anchor so subsequent seeks stay accurate
    videoPlayStartEpochRef.current = now;
    videoPausedOffsetRef.current = target;
    setSeekTarget(target);
    setVideoSyncEpoch({ epochMs: now, offsetSec: target });
    setSeekCommand(now);
    setSeekAmount(seconds);
  };




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
    const activeSlideContent = String(activeSlide?.content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
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
    event: AetherBridgeEvent,
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
    // Derive room ID from the bridge URL's ?room= query param (new pairing flow)
    // Fall back to the legacy stored aetherRoomId for backwards compat
    const roomId = (() => {
      try { return new URL(workspaceSettings.aetherBridgeUrl).searchParams.get('room') || undefined; }
      catch { return String(workspaceSettings.aetherRoomId || '').trim() || undefined; }
    })();
    const result = await dispatchAetherBridgeEvent({
      endpointUrl,
      accessToken: String(aetherBridgeToken || '').trim() || undefined,
      roomId,
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
  }, [aetherBridgeToken, liveSessionId, workspaceId, workspaceSettings.aetherBridgeUrl, workspaceSettings.aetherRoomId]);

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

  // Heartbeat: ping Aether every 60s while bridge is enabled + configured
  useEffect(() => {
    if (!workspaceSettings.aetherBridgeEnabled || !workspaceSettings.aetherBridgeUrl.trim()) return;
    const id = setInterval(() => {
      void dispatchAetherEvent('lumina.bridge.ping', { app: 'lumina-presenter', heartbeat: true }, { timeoutMs: 4000 });
    }, 60_000);
    return () => clearInterval(id);
  }, [workspaceSettings.aetherBridgeEnabled, workspaceSettings.aetherBridgeUrl, dispatchAetherEvent]);

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

  const handleAetherStreamRequest = useCallback(async (
    action: 'start' | 'stop' | 'toggle',
    payload: Record<string, unknown> = {},
    options?: { timeoutMs?: number; successLabel?: string; failureLabel?: string }
  ) => {
    await dispatchAetherEvent(
      'lumina.stream.request',
      {
        action,
        ...payload,
        workspaceId,
        sessionId: liveSessionId,
      },
      {
        timeoutMs: options?.timeoutMs ?? 5000,
        successLabel: options?.successLabel ?? `Aether ${action} command sent`,
        failureLabel: options?.failureLabel ?? `Aether ${action} command failed`,
      }
    );
  }, [dispatchAetherEvent, liveSessionId, workspaceId]);

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

  const handleStageTimerLayoutChange = useCallback((layout: StageTimerLayout) => {
    const normalized = normalizeStageTimerLayout(layout);
    writeStoredStageWorkspaceSettings({ stageTimerLayout: normalized });
    setWorkspaceSettings((prev) => (
      stageTimerLayoutsEqual(prev.stageTimerLayout, normalized)
        ? prev
        : { ...prev, stageTimerLayout: normalized }
    ));
  }, []);

  const handleStageAlertLayoutChange = useCallback((layout: StageAlertLayout) => {
    const normalized = normalizeStageAlertLayout(layout);
    writeStoredStageWorkspaceSettings({ stageAlertLayout: normalized });
    setWorkspaceSettings((prev) => (
      stageAlertLayoutsEqual(prev.stageAlertLayout, normalized)
        ? prev
        : { ...prev, stageAlertLayout: normalized }
    ));
  }, []);

  const handleStageFlowLayoutChange = useCallback((layout: StageFlowLayout) => {
    const normalized = VALID_STAGE_FLOW_LAYOUTS.includes(layout) ? layout : 'balanced';
    writeStoredStageWorkspaceSettings({ stageFlowLayout: normalized });
    setWorkspaceSettings((prev) => (
      prev.stageFlowLayout === normalized
        ? prev
        : { ...prev, stageFlowLayout: normalized }
    ));
  }, []);

  useEffect(() => {
    const syncStageLayoutsFromStorage = (raw: string | null) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw) as { workspaceSettings?: Partial<WorkspaceSettings> };
        const storedSettings = parsed?.workspaceSettings;
        if (!storedSettings || typeof storedSettings !== 'object') return;
        const nextTimerLayout = normalizeStageTimerLayout(storedSettings.stageTimerLayout);
        const nextAlertLayout = normalizeStageAlertLayout(storedSettings.stageAlertLayout);
        const nextFlowLayout = typeof storedSettings.stageFlowLayout === 'string' && VALID_STAGE_FLOW_LAYOUTS.includes(storedSettings.stageFlowLayout as StageFlowLayout)
          ? storedSettings.stageFlowLayout as StageFlowLayout
          : null;
        setWorkspaceSettings((prev) => {
          const timerChanged = !stageTimerLayoutsEqual(prev.stageTimerLayout, nextTimerLayout);
          const alertChanged = !stageAlertLayoutsEqual(prev.stageAlertLayout, nextAlertLayout);
          const flowChanged = !!nextFlowLayout && prev.stageFlowLayout !== nextFlowLayout;
          if (!timerChanged && !alertChanged && !flowChanged) return prev;
          return {
            ...prev,
            stageTimerLayout: nextTimerLayout,
            stageAlertLayout: nextAlertLayout,
            stageFlowLayout: nextFlowLayout || prev.stageFlowLayout,
          };
        });
      } catch {
        // ignore malformed shared storage payloads
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      syncStageLayoutsFromStorage(event.newValue);
    };

    window.addEventListener('storage', handleStorage);
    syncStageLayoutsFromStorage(window.localStorage.getItem(STORAGE_KEY));
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

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
      return cloneSchedule(INITIAL_SCHEDULE).map((item, idx) => stampItemBackgroundSource({ ...item, id: `${now}-${idx}` }, 'system'));
    }
    if (templateId === 'YOUTH') {
      const youthItems: ServiceItem[] = [
        {
          id: `${now}-1`,
          title: 'Countdown + Hype',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[9], fontSize: 'xlarge' as const },
          slides: [
            { id: `${now}-1a`, label: 'Start', content: 'Service starts in 05:00' },
            { id: `${now}-1b`, label: 'Welcome', content: 'Welcome to Youth Night' },
          ],
        },
        {
          id: `${now}-2`,
          title: 'Worship Set',
          type: ItemType.SONG,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[7], fontSize: 'large' as const },
          slides: [
            { id: `${now}-2a`, label: 'Verse 1', content: 'You are here, moving in our midst' },
            { id: `${now}-2b`, label: 'Chorus', content: 'Way maker, miracle worker' },
          ],
        },
        {
          id: `${now}-3`,
          title: 'Message + Call',
          type: ItemType.ANNOUNCEMENT,
          theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[2], fontSize: 'medium' as const },
          slides: [
            { id: `${now}-3a`, label: 'Main Point', content: 'Faith over fear' },
            { id: `${now}-3b`, label: 'Response', content: 'Prayer team available at the front' },
          ],
        },
      ];
      return youthItems.map((item) => stampItemBackgroundSource(item, 'system'));
    }
    const prayerItems: ServiceItem[] = [
      {
        id: `${now}-p1`,
        title: 'Prayer + Reflection',
        type: ItemType.SCRIPTURE,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[5], fontFamily: 'serif', fontSize: 'medium' as const },
        slides: [
          { id: `${now}-p1a`, label: 'Reading', content: 'Psalm 23:1-3' },
          { id: `${now}-p1b`, label: 'Meditation', content: 'Be still and know that I am God.' },
        ],
      },
      {
        id: `${now}-p2`,
        title: 'Intercession',
        type: ItemType.ANNOUNCEMENT,
        theme: { ...baseTheme, backgroundUrl: DEFAULT_BACKGROUNDS[10], fontSize: 'large' as const },
        slides: [
          { id: `${now}-p2a`, label: 'Prayer Focus', content: 'Families, healing, and community leaders' },
        ],
      },
    ];
    return prayerItems.map((item) => stampItemBackgroundSource(item, 'system'));
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
    if (viewMode === 'PRESENTER') {
      const msg = startNewAfterArchive
        ? "⚠️ RUNNING LIVE: Archive current run sheet and start a fresh one? This cannot be undone easily."
        : "⚠️ RUNNING LIVE: Archive current run sheet?";
      if (!window.confirm(msg)) return;
    }

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

    const confirmMsg = viewMode === 'PRESENTER'
      ? `⚠️ RUNNING LIVE: Move "${item.title}" to archives? It will be removed from the active run sheet.`
      : `Move "${item.title}" to Run Sheet Files? It will be removed from the active run sheet.`;

    const confirmed = window.confirm(confirmMsg);
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

    if (viewMode === 'PRESENTER') {
      if (!window.confirm("⚠️ RUNNING LIVE: Rename this archived run sheet? Changes will sync to the cloud for all operators.")) return;
    }

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
    const confirmMsg = viewMode === 'PRESENTER'
      ? "⚠️ RUNNING LIVE: Permanently delete this archived run sheet? This will REMOVE it for all operators immediately."
      : 'Delete this archived run sheet?';

    if (!window.confirm(confirmMsg)) return;
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

  const handleRefreshSermons = () => {
    setArchivedSermonsLoading(true);
    getArchivedSermons(workspaceId).then((items) => {
      setArchivedSermons(items);
      setArchivedSermonsLoading(false);
    });
  };

  const handleCopySermon = (item: ArchivedSermon) => {
    const text = [
      `SERMON: ${item.summary.title}`,
      ``,
      `THEME: ${item.summary.mainTheme}`,
      ``,
      `KEY POINTS:`,
      ...item.summary.keyPoints.map((p, i) => `${i + 1}. ${p}`),
      ``,
      `SCRIPTURES: ${item.summary.scripturesReferenced.join(' · ') || 'None'}`,
      ``,
      `CALL TO ACTION: ${item.summary.callToAction}`,
    ].join('\n');
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  };

  const openCreatePresetModal = () => {
    setEditingPresetId(null);
    setPresetDraft(createSpeakerPresetDraft());
    setPresetStudioSaveState(null);
    setIsPresetModalOpen(true);
  };

  const openEditPresetModal = (preset: SpeakerTimerPreset) => {
    setSelectedSpeakerPresetId(preset.id);
    setEditingPresetId(preset.id);
    setPresetDraft({
      ...preset,
      speakerName: preset.speakerName || '',
    });
    setPresetStudioSaveState(null);
    setIsPresetModalOpen(true);
  };

  const openSpeakerPresetStudio = () => {
    const selectedPreset = (workspaceSettings.speakerTimerPresets || []).find((entry) => entry.id === selectedSpeakerPresetId);
    if (selectedPreset) {
      openEditPresetModal(selectedPreset);
      return;
    }
    openCreatePresetModal();
  };

  const duplicateSpeakerPresetDraft = (preset: SpeakerTimerPreset) => {
    const freshDraft = createSpeakerPresetDraft();
    setEditingPresetId(null);
    setPresetDraft({
      ...freshDraft,
      ...preset,
      id: freshDraft.id,
      name: `${preset.name} Copy`,
      speakerName: preset.speakerName || '',
    });
    setPresetStudioSaveState(null);
    setIsPresetModalOpen(true);
  };

  const updatePresetDurationSegment = (segment: 'hours' | 'minutes' | 'seconds', value: number) => {
    setPresetDraft((prev) => {
      const safeDuration = clamp(Math.round(Number(prev.durationSec) || 300), 10, 7200);
      let hours = Math.floor(safeDuration / 3600);
      let minutes = Math.floor((safeDuration % 3600) / 60);
      let seconds = safeDuration % 60;
      const safeValue = Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
      if (segment === 'hours') hours = clamp(safeValue, 0, 2);
      if (segment === 'minutes') minutes = clamp(safeValue, 0, 59);
      if (segment === 'seconds') seconds = clamp(safeValue, 0, 59);
      const nextDurationSec = clamp((hours * 3600) + (minutes * 60) + seconds, 10, 7200);
      return {
        ...prev,
        durationSec: nextDurationSec,
      };
    });
  };

  const updatePresetThresholdDraft = (field: 'amber' | 'red', value: number) => {
    setPresetDraft((prev) => {
      const nextThresholds = normalizeSpeakerTimerThresholds(
        field === 'amber' ? value : prev.amberPercent,
        field === 'red' ? value : prev.redPercent,
      );
      return {
        ...prev,
        ...nextThresholds,
      };
    });
  };

  const savePresetDraft = () => {
    const normalized = sanitizeSpeakerTimerPreset(presetDraft);
    if (!normalized) return;
    const wasEditing = !!editingPresetId;
    const savedPreset = wasEditing
      ? { ...normalized, id: editingPresetId as string }
      : normalized;
    const nextSelectedPresetId = savedPreset.id;
    setWorkspaceSettings((prev) => {
      const existing = Array.isArray(prev.speakerTimerPresets) ? prev.speakerTimerPresets : [];
      if (wasEditing) {
        return {
          ...prev,
          speakerTimerPresets: existing.map((entry) => (
            entry.id === savedPreset.id ? savedPreset : entry
          )),
        };
      }
      return {
        ...prev,
        speakerTimerPresets: [...existing, savedPreset],
      };
    });
    setSelectedSpeakerPresetId(nextSelectedPresetId);
    setEditingPresetId(savedPreset.id);
    setPresetDraft({
      ...savedPreset,
      speakerName: savedPreset.speakerName || '',
    });
    setPresetStudioSaveState({
      at: Date.now(),
      mode: wasEditing ? 'updated' : 'saved',
    });
  };

  const deleteSpeakerPreset = (presetId: string) => {
    if (!window.confirm('Delete this speaker preset?')) return;
    if (editingPresetId === presetId) {
      setEditingPresetId(null);
      setPresetDraft(createSpeakerPresetDraft());
      setPresetStudioSaveState(null);
    }
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
    const normalizedThresholds = normalizeSpeakerTimerThresholds(preset.amberPercent, preset.redPercent);
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
          amberPercent: normalizedThresholds.amberPercent,
          redPercent: normalizedThresholds.redPercent,
          presetId: preset.id,
        },
      };
    }));
  };

  const addItem = (item: ServiceItem) => {
    pushHistory();
    setSchedule((prev) => [...prev, item]);
  };

  const updateItem = (item: ServiceItem) => {
    const previousItem = schedule.find((entry) => entry.id === item.id) || null;
    const normalizedItem = markItemBackgroundAsUserChanged(item, previousItem);
    pushHistory();
    setSchedule((prev) => prev.map((i) => (i.id === normalizedItem.id ? normalizedItem : i)));
  };

  const removeItem = (itemId: string) => {
    if (viewMode === 'PRESENTER') {
      if (!window.confirm("⚠️ RUNNING LIVE: Remove this item from the schedule?")) return;
    }
    pushHistory();
    const nextSchedule = schedule.filter((i) => i.id !== itemId);
    setSchedule(nextSchedule);
    if (selectedItemId === itemId) {
      setSelectedItemId(nextSchedule[0]?.id || '');
    }
    if (activeItemId === itemId) {
      setActiveItemId(null);
      setActiveSlideIndex(-1);
    }
  };

  const addEmptyItem = () => {
    const newItem = finalizeGeneratedItemBackground({
      id: Date.now().toString(),
      title: "New Item",
      type: ItemType.ANNOUNCEMENT,
      slides: [],
      theme: { backgroundUrl: DEFAULT_BACKGROUNDS[2], fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'medium' },
      metadata: {
        source: 'manual',
      },
    }, 'system');
    addItem(newItem);
    setSelectedItemId(newItem.id);
  };

  const cloneServiceItemForDuplication = useCallback((item: ServiceItem) => {
    const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    return {
      ...JSON.parse(JSON.stringify(item)) as ServiceItem,
      id: `item-${stamp}`,
      title: `${item.title} Copy`,
      slides: item.slides.map((slide, idx) => ({
        ...slide,
        id: `slide-${stamp}-${idx + 1}`,
      })),
    };
  }, []);

  const duplicateScheduleItem = useCallback((itemId: string) => {
    const sourceIndex = schedule.findIndex((entry) => entry.id === itemId);
    if (sourceIndex < 0) return;
    const source = schedule[sourceIndex];
    if (!source) return;
    const duplicated = cloneServiceItemForDuplication(source);
    pushHistory();
    setSchedule((prev) => {
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, duplicated);
      return next;
    });
    setSelectedItemId(duplicated.id);
  }, [cloneServiceItemForDuplication, schedule, pushHistory]);

  const goLive = (item: ServiceItem, slideIndex: number = 0) => {
    const nextLiveItem = prepareItemForGoLive(item);
    if (!nextLiveItem || !Array.isArray(nextLiveItem.slides) || nextLiveItem.slides.length === 0) return;
    const boundedIndex = Math.max(0, Math.min(nextLiveItem.slides.length - 1, slideIndex));
    const bridgeReady = workspaceSettings.aetherBridgeEnabled && !!String(workspaceSettings.aetherBridgeUrl || '').trim();
    const shouldRequestAetherStart = bridgeReady && (!activeItemId || blackout || holdScreenMode !== 'none' || !isPlaying);
    const goLiveSlide = nextLiveItem.slides[boundedIndex];
    setActiveItemId(nextLiveItem.id);
    setActiveSlideIndex(boundedIndex);
    if (nextLiveItem.timerCue?.enabled) {
      const cueDuration = Number.isFinite(nextLiveItem.timerCue.durationSec) ? Math.max(1, Math.round(nextLiveItem.timerCue.durationSec)) : 300;
      setCurrentCueItemId(nextLiveItem.id);
      if (!timerRunning) {
        setTimerMode('COUNTDOWN');
        setTimerDurationMin(Math.max(1, Math.ceil(cueDuration / 60)));
        setTimerSeconds(cueDuration);
        setCueZeroHold(false);
      }
    }
    setBlackout(false);
    setHoldScreenMode('none');
    setIsPlaying(true);
    // Reset video playback tracking whenever a new item goes live
    const now = Date.now();
    videoPlayStartEpochRef.current = now;
    videoPausedOffsetRef.current = 0;
    setSeekTarget(null);
    setVideoSyncEpoch({ epochMs: now, offsetSec: 0 });
    logActivity(user?.uid, 'PRESENTATION_START', { itemTitle: nextLiveItem.title });
    // Fire item_start macro triggers
    const itemStartMatches = matchTriggers(
      { type: 'item_start', itemId: nextLiveItem.id },
      macros,
    );
    itemStartMatches.forEach((macro) => {
      import('./services/macroEngine').then(({ executeMacro }) => {
        executeMacro(macro, macroCtx).catch(() => {});
      });
    });

    if (bridgeReady) {
      const programSceneName = resolveAetherSceneName('program');
      const bridgePayload = {
        target: 'program',
        sceneTarget: 'program',
        sceneName: programSceneName,
        itemId: nextLiveItem.id,
        itemTitle: nextLiveItem.title,
        itemType: nextLiveItem.type,
        slideIndex: boundedIndex,
        slideLabel: String(goLiveSlide?.label || `Slide ${boundedIndex + 1}`),
      };
      if (shouldRequestAetherStart) {
        void handleAetherStreamRequest('start', bridgePayload, {
          successLabel: 'Aether live start sent',
          failureLabel: 'Aether live start failed',
        });
      } else {
        void handleAetherSceneSwitch('program');
      }
    }
  };
  const goLiveSelectedPreview = useCallback(() => {
    if (!presenterPreviewItem || presenterPreviewSlideIndex < 0) return;
    goLive(presenterPreviewItem, presenterPreviewSlideIndex);
  }, [presenterPreviewItem, presenterPreviewSlideIndex]);

  const handleSermonFlashToScreen = useCallback(async (content: { transcript: string; summary?: SermonSummary }) => {
    const stamp = Date.now().toString(36);

    // Build slides from summary key points or raw transcript chunks
    let title = 'Sermon Recap';
    let slideItems: { id: string; content: string; label: string }[];

    if (content.summary) {
      title = content.summary.title || 'Sermon';
      slideItems = [];
      // Slide 1: main theme
      if (content.summary.mainTheme) {
        slideItems.push({ id: `${stamp}-theme`, content: `THEME\n\n${content.summary.mainTheme}`, label: 'Theme' });
      }
      // Slide 2: all key points on ONE slide (numbered list)
      if (content.summary.keyPoints.length > 0) {
        const pointsContent = content.summary.keyPoints.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
        slideItems.push({ id: `${stamp}-points`, content: `KEY POINTS\n\n${pointsContent}`, label: 'Key Points' });
      }
      // Slide 3: call to action
      if (content.summary.callToAction) {
        slideItems.push({ id: `${stamp}-cta`, content: `CALL TO ACTION\n\n${content.summary.callToAction}`, label: 'Call to Action' });
      }
      if (!slideItems.length) {
        slideItems = [{ id: `${stamp}-0`, content: title, label: 'Sermon' }];
      }
    } else {
      const words = content.transcript.split(/\s+/).filter(Boolean);
      const PER_SLIDE = 30;
      slideItems = [];
      for (let i = 0; i < words.length; i += PER_SLIDE) {
        slideItems.push({
          id: `${stamp}-${slideItems.length}`,
          content: words.slice(i, i + PER_SLIDE).join(' '),
          label: `Part ${slideItems.length + 1}`,
        });
      }
      if (!slideItems.length) {
        slideItems = [{ id: `${stamp}-0`, content: content.transcript, label: 'Sermon' }];
      }
    }

    // Add to run sheet and go live — use user's default BG if set
    const sermonBg = getDefaultBgTheme(DEFAULT_BACKGROUNDS[2]);
    const sermonItem = finalizeGeneratedItemBackground({
      id: `${stamp}-sermon`,
      title,
      type: ItemType.ANNOUNCEMENT,
      slides: slideItems,
      theme: {
        backgroundUrl: sermonBg.backgroundUrl,
        mediaType: sermonBg.mediaType,
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: true,
        fontSize: 'large' as const,
      },
      metadata: { source: 'manual', createdAt: Date.now() },
    }, 'system');
    addItem(sermonItem);
    goLive(sermonItem, 0);
  }, [finalizeGeneratedItemBackground, addItem, goLive]);

  // Build a sermon item (same as flash but without goLive — for inserting into runsheet)
  const buildSermonItem = useCallback((summary: SermonSummary) => {
    const stamp = Date.now().toString(36);
    const title = summary.title || 'Sermon';
    const slideItems: { id: string; content: string; label: string }[] = [];
    if (summary.mainTheme) slideItems.push({ id: `${stamp}-theme`, content: `THEME\n\n${summary.mainTheme}`, label: 'Theme' });
    if (summary.keyPoints.length > 0) {
      const pointsContent = summary.keyPoints.map((pt, i) => `${i + 1}. ${pt}`).join('\n');
      slideItems.push({ id: `${stamp}-points`, content: `KEY POINTS\n\n${pointsContent}`, label: 'Key Points' });
    }
    if (summary.callToAction) slideItems.push({ id: `${stamp}-cta`, content: `CALL TO ACTION\n\n${summary.callToAction}`, label: 'Call to Action' });
    if (!slideItems.length) slideItems.push({ id: `${stamp}-0`, content: title, label: 'Sermon' });
    const bgTheme = getDefaultBgTheme(DEFAULT_BACKGROUNDS[2]);
    return finalizeGeneratedItemBackground({
      id: `${stamp}-sermon`,
      title,
      type: ItemType.ANNOUNCEMENT,
      slides: slideItems,
      theme: { backgroundUrl: bgTheme.backgroundUrl, mediaType: bgTheme.mediaType, fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' as const },
      metadata: { source: 'manual', createdAt: Date.now() },
    }, 'system');
  }, [finalizeGeneratedItemBackground]);

  const handleSermonProjectToScreen = useCallback((summary: SermonSummary) => {
    const item = buildSermonItem(summary);
    addItem(item);
    goLive(item, 0);
  }, [buildSermonItem, addItem, goLive]);

  const handleSermonInsertToRunsheet = useCallback((summary: SermonSummary) => {
    const item = buildSermonItem(summary);
    addItem(item);
  }, [buildSermonItem, addItem]);

  const handleSermonSave = useCallback(async (transcript: string, summary: SermonSummary) => {
    const wc = transcript.trim().split(/\s+/).filter(Boolean).length;
    const saved = await archiveSermon(summary, wc, workspaceId);
    if (saved) setArchivedSermons((prev) => [saved, ...prev]);
  }, [workspaceId]);

  const selectPresenterPreviewItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setPresenterFocusArea('schedule');
    setPresenterContextMenu(null);
  }, []);

  const selectPresenterPreviewSlide = useCallback((itemId: string, slideIndex: number, focusArea: PresenterFocusArea = 'filmstrip') => {
    setSelectedItemId(itemId);
    setPresenterPreviewSelection({
      itemId,
      slideIndex,
    });
    setPresenterFocusArea(focusArea);
    setPresenterContextMenu(null);
  }, []);

  const movePreviewSelectionByOffset = useCallback((offset: number) => {
    if (!presenterPreviewItem || !presenterPreviewSlides.length) return;
    setPresenterPreviewSelection((prev) => ({
      itemId: presenterPreviewItem.id,
      slideIndex: clamp((prev.itemId === presenterPreviewItem.id ? prev.slideIndex : presenterPreviewSlideIndex) + offset, 0, presenterPreviewSlides.length - 1),
    }));
  }, [presenterPreviewItem, presenterPreviewSlideIndex, presenterPreviewSlides.length]);

  const moveSelectedScheduleItemByOffset = useCallback((offset: number) => {
    const baseIndex = schedule.findIndex((entry) => entry.id === selectedItemId);
    if (baseIndex < 0) return;
    const nextIndex = clamp(baseIndex + offset, 0, schedule.length - 1);
    const nextItem = schedule[nextIndex];
    if (!nextItem) return;
    setSelectedItemId(nextItem.id);
  }, [schedule, selectedItemId]);

  const jumpToLiveSlide = useCallback((itemId: string, slideIndex: number) => {
    const item = schedule.find((entry) => entry.id === itemId);
    if (!item) return;
    goLive(item, slideIndex);
    setPresenterFocusArea('live');
    setPresenterContextMenu(null);
  }, [schedule]);

  const updatePresenterLayoutPref = useCallback((field: keyof PresenterLayoutPrefs, delta: number) => {
    setPresenterLayoutPrefs((prev) => clampPresenterLayoutPrefs({
      ...prev,
      [field]: Number(prev[field]) + delta,
    }));
  }, []);

  const showPresenterContextMenu = useCallback((event: React.MouseEvent, nextMenu: Exclude<PresenterContextMenuState, null>) => {
    event.preventDefault();
    setPresenterContextMenu(nextMenu);
  }, []);

  const closePresenterContextMenu = useCallback(() => {
    setPresenterContextMenu(null);
  }, []);
  const handleApplyHymnInsertion = (result: RunSheetInsertionResult, options?: { goLive?: boolean }) => {
    const insertedBackgroundSource = result.insertedItem.metadata?.backgroundSource === 'user' ? 'user' : 'system';
    const normalizedInsertedItem = finalizeGeneratedItemBackground(result.insertedItem, insertedBackgroundSource);
    const normalizedSchedule = result.schedule.map((entry) => (
      entry.id === normalizedInsertedItem.id ? normalizedInsertedItem : entry
    ));
    pushHistory();
    setSchedule(normalizedSchedule);
    setSelectedItemId(result.selectedItemId);
    logActivity(user?.uid, 'ADD_HYMN', {
      hymnId: normalizedInsertedItem.metadata?.hymn?.hymnId,
      title: normalizedInsertedItem.title,
      slideCount: normalizedInsertedItem.slides.length,
    });
    if (options?.goLive) {
      goLive(normalizedInsertedItem, 0);
    }
  };
  const handleProjectAudienceMessage = (text: string, label?: string) => {
    const existingIdx = schedule.findIndex(i => i.id === 'audience-live-item');
    const newItem = finalizeGeneratedItemBackground({
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
      },
      metadata: {
        source: 'audience',
      },
    }, 'system');

    if (existingIdx >= 0) {
      pushHistory();
      setSchedule((prev) => prev.map((entry) => (
        entry.id === newItem.id ? newItem : entry
      )));
    } else {
      addItem(newItem);
    }

    setLowerThirdsEnabled(true);
    goLive(newItem, 0);
  };


  const nextSlide = useCallback(() => {
    setBlackout((prev) => (prev ? false : prev));
    setHoldScreenMode('none');
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
    setHoldScreenMode('none');
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
        setHoldScreenMode('none');
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

  const handleSaveSlidesFromEditor = useCallback((slidesToSave: Slide[], selectedSlideId?: string | null) => {
    if (!selectedItem) return;
    const normalizedSlides = slidesToSave.map((slide, index) => ({
      ...slide,
      id: slide.id || `${Date.now()}-smart-slide-${index + 1}`,
    }));
    updateItem({ ...selectedItem, slides: normalizedSlides });
    setIsSlideEditorOpen(false);
    setEditingSlide(null);
  }, [selectedItem, updateItem]);

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

  const reorderItemSlides = useCallback((itemId: string, sourceId: string, targetId: string, placeAfter = false) => {
    if (!itemId || !sourceId || !targetId || sourceId === targetId) return;
    const targetItem = schedule.find((entry) => entry.id === itemId);
    if (!targetItem) return;
    const sourceIndex = targetItem.slides.findIndex((entry) => entry.id === sourceId);
    const targetIndex = targetItem.slides.findIndex((entry) => entry.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    let nextIndex = targetIndex + (placeAfter ? 1 : 0);
    if (sourceIndex < nextIndex) nextIndex -= 1;
    if (sourceIndex === nextIndex) return;

    const nextSlides = [...targetItem.slides];
    const [moved] = nextSlides.splice(sourceIndex, 1);
    nextSlides.splice(Math.max(0, Math.min(nextSlides.length, nextIndex)), 0, moved);
    updateItem({ ...targetItem, slides: nextSlides });
  }, [schedule, updateItem]);

  const reorderSelectedItemSlides = useCallback((sourceId: string, targetId: string, placeAfter = false) => {
    if (!selectedItem) return;
    reorderItemSlides(selectedItem.id, sourceId, targetId, placeAfter);
  }, [selectedItem, reorderItemSlides]);

  const moveSlideWithinItem = useCallback((itemId: string, slideId: string, offset: number) => {
    const targetItem = schedule.find((entry) => entry.id === itemId);
    if (!targetItem) return;
    const currentIndex = targetItem.slides.findIndex((entry) => entry.id === slideId);
    if (currentIndex < 0) return;
    const nextIndex = clamp(currentIndex + offset, 0, targetItem.slides.length - 1);
    if (currentIndex === nextIndex) return;
    const targetSlide = targetItem.slides[nextIndex];
    if (!targetSlide) return;
    reorderItemSlides(itemId, slideId, targetSlide.id, offset > 0);
  }, [schedule, reorderItemSlides]);

  const reorderScheduleItems = useCallback((sourceId: string, targetId: string, placeAfter = false) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const sourceIndex = schedule.findIndex((entry) => entry.id === sourceId);
    const targetIndex = schedule.findIndex((entry) => entry.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    let nextIndex = targetIndex + (placeAfter ? 1 : 0);
    if (sourceIndex < nextIndex) nextIndex -= 1;
    if (sourceIndex === nextIndex) return;
    pushHistory();
    setSchedule((prev) => {
      const next = [...prev];
      const currentSourceIndex = next.findIndex((entry) => entry.id === sourceId);
      if (currentSourceIndex < 0) return prev;
      const [moved] = next.splice(currentSourceIndex, 1);
      next.splice(Math.max(0, Math.min(next.length, nextIndex)), 0, moved);
      return next;
    });
  }, [schedule, pushHistory]);

  const moveScheduleItemByOffset = useCallback((itemId: string, offset: number) => {
    const currentIndex = schedule.findIndex((entry) => entry.id === itemId);
    if (currentIndex < 0) return;
    const nextIndex = clamp(currentIndex + offset, 0, schedule.length - 1);
    if (currentIndex === nextIndex) return;
    const target = schedule[nextIndex];
    if (!target) return;
    reorderScheduleItems(itemId, target.id, offset > 0);
  }, [reorderScheduleItems, schedule]);

  const stageGeneratedItem = useCallback((
    item: ServiceItem,
    backgroundSource: ServiceItemBackgroundSource,
    options?: { select?: boolean; goLive?: boolean; slideIndex?: number },
  ) => {
    const normalizedItem = finalizeGeneratedItemBackground(item, backgroundSource);
    addItem(normalizedItem);
    if (options?.select !== false) {
      setSelectedItemId(normalizedItem.id);
    }
    if (options?.goLive) {
      goLive(normalizedItem, options.slideIndex || 0);
    }
    return normalizedItem;
  }, [addItem, finalizeGeneratedItemBackground, goLive]);

  // Commits a drafted Bible item onto an existing selected/live Bible entry when possible.
  // Returns true when the draft was applied in-place and should not be staged as a new item.
  const handleBibleLiveUpdate = useCallback((item: ServiceItem): boolean => {
    const normalizedItem = finalizeGeneratedItemBackground({
      ...item,
      metadata: { ...item.metadata, source: item.metadata?.source || 'bible' },
    }, 'system');
    const liveItem = activeItemId ? schedule.find((entry) => entry.id === activeItemId) || null : null;
    const selectedItem = selectedItemId ? schedule.find((entry) => entry.id === selectedItemId) || null : null;
    const targetItem = isBibleGeneratedItem(liveItem)
      ? liveItem
      : (isBibleGeneratedItem(selectedItem) ? selectedItem : null);

    if (targetItem) {
      const replacedItem = mergeBibleGeneratedItem(targetItem, normalizedItem);
      const nextSlideIndex = liveItem && liveItem.id === targetItem.id
        ? clamp(
          activeSlideIndex >= 0 ? activeSlideIndex : 0,
          0,
          Math.max(0, replacedItem.slides.length - 1),
        )
        : 0;
      const nextProjectedItem = areBibleGeneratedItemsVisuallyEqual(targetItem, replacedItem)
        ? targetItem
        : replacedItem;

      if (!areBibleGeneratedItemsVisuallyEqual(targetItem, replacedItem)) {
        pushHistory();
        setSchedule((prev) => prev.map((entry) => (entry.id === targetItem.id ? replacedItem : entry)));
      }
      setSelectedItemId(targetItem.id);
      goLive(nextProjectedItem, nextSlideIndex);
      return true;
    }
    return false;
  }, [activeItemId, activeSlideIndex, selectedItemId, schedule, finalizeGeneratedItemBackground, goLive, pushHistory]);

  const handleAIItemGenerated = (item: ServiceItem) => {
    const normalizedItem = finalizeGeneratedItemBackground({
      ...item,
      metadata: {
        ...item.metadata,
        source: item.metadata?.source || 'ai',
      },
    }, 'system');
    const sentiment = analyzeSentimentContext(item.title + ' ' + (item.slides[0]?.content || ''));
    logActivity(user?.uid, 'AI_GENERATION', { sentiment, slideCount: normalizedItem.slides.length, type: normalizedItem.type });
    addItem(normalizedItem);
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

  const persistRemoteMotionLibraryAsset = useCallback(async (sourceUrl: string, mediaType: 'image' | 'video') => {
    const trimmedUrl = String(sourceUrl || '').trim();
    if (!isRemoteMediaUrl(trimmedUrl)) return trimmedUrl;

    try {
      const response = await fetch(trimmedUrl, { mode: 'cors' });
      if (!response.ok) throw new Error(`REMOTE_MEDIA_FETCH_${response.status}`);

      const blob = await response.blob();
      const mimeType = String(blob.type || '').trim() || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const fileName = inferRemoteMediaFileName(trimmedUrl, mediaType, mimeType);
      const file = new File([blob], fileName, { type: mimeType });
      const uploaded = user?.uid
        ? await uploadWorkspaceMedia(workspaceId, user, file)
        : null;
      return String(uploaded?.url || '').trim() || await saveMedia(file);
    } catch (error) {
      console.warn('Failed to persist remote motion asset for projector-safe playback.', {
        sourceUrl: trimmedUrl,
        mediaType,
        error,
      });
      return trimmedUrl;
    }
  }, [user, workspaceId]);

  const applyQuickBackgroundToItem = useCallback(async (targetItem: ServiceItem, selection: QuickBackgroundSelection) => {
    if (!targetItem?.id) return;
    const isMotion = selection.mediaType === 'motion' || isMotionUrl(selection.url);
    const resolvedMediaType = isMotion ? 'motion' as const : (selection.mediaType === 'image' ? 'image' as const : 'video' as const);
    const resolvedUrl = isMotion ? selection.url : await persistRemoteMotionLibraryAsset(selection.url, resolvedMediaType as 'image' | 'video');
    const latestItem = scheduleRef.current.find((entry) => entry.id === targetItem.id);
    if (!latestItem) return;

    const normalizedItem = markItemBackgroundAsUserChanged({
      ...latestItem,
      theme: {
        ...latestItem.theme,
        backgroundUrl: resolvedUrl,
        mediaType: resolvedMediaType,
      },
      metadata: {
        ...latestItem.metadata,
        backgroundProvider: selection.provider,
        backgroundCategory: selection.category,
        backgroundTitle: selection.title,
        backgroundSourceUrl: selection.sourceUrl || selection.url,
        backgroundThumbnailUrl: selection.thumb || undefined,
      },
    }, latestItem);

    // Persist as user's default background for all future slide creation
    setUserDefaultBackground({
      url: resolvedUrl,
      mediaType: resolvedMediaType,
      provider: selection.provider,
      category: selection.category,
      title: selection.title,
      sourceUrl: selection.sourceUrl || selection.url,
    });

    pushHistory();
    setSchedule((prev) => prev.map((entry) => (entry.id === normalizedItem.id ? normalizedItem : entry)));
    logActivity(user?.uid, 'UPDATE_THEME', {
      type: 'QUICK_BG',
      itemId: normalizedItem.id,
      mediaType: resolvedMediaType,
      provider: selection.provider,
      category: selection.category,
    });
  }, [markItemBackgroundAsUserChanged, persistRemoteMotionLibraryAsset, pushHistory, user?.uid]);

  const buildTextSlidesFromPptx = async (file: File) => {
    const parsed = await parsePptxFile(file);
    const now = Date.now();
    const slides: Slide[] = parsed.slides.map((entry, idx) => ({
      id: `${now}-pptx-text-${idx + 1}`,
      label: entry.label || `Slide ${idx + 1}`,
      content: entry.content,
      notes: entry.notes,
    }));
    return { suggestedTitle: parsed.title, slides };
  };

  const buildVisualSlidesFromPptx = async (file: File, onProgress?: (message: string) => void) => {
    if (!user?.uid) throw new Error('Please sign in before importing PowerPoint visuals.');
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
        if (!entry?.imageBase64) throw new Error(`Visual import slide ${idx + 1} is missing image data.`);
        const imageFile = base64ToFile(entry.imageBase64, fileName, 'image/png');
        const uploaded = user?.uid ? await uploadWorkspaceMedia(workspaceId, user, imageFile) : null;
        backgroundUrl = String(uploaded?.url || '').trim() || await saveMedia(imageFile);
      }
      slides.push({ id: `${now}-pptx-visual-${idx + 1}`, label: `Slide ${idx + 1}`, content: '', backgroundUrl, mediaType: 'image', notes: '' });
    }
    return { suggestedTitle: file.name.replace(/\.[^.]+$/, ''), slides };
  };

  const isVisualRendererUnavailable = (message: string) => {
    const normalized = (message || '').toLowerCase();
    return normalized.includes('soffice') || normalized.includes('libreoffice')
      || normalized.includes('renderer is unavailable')
      || normalized.includes('visual powerpoint import endpoint is not available');
  };

  const importLyricsAsItem = () => {
    setImportModalError(null);
    const raw = importLyrics.trim();
    if (!raw) return;
    const chunks = raw.split(/\n\s*\n+/).map((entry) => entry.trim()).filter(Boolean);
    if (!chunks.length) return;
    const now = Date.now();
    const slides: Slide[] = chunks.map((content, idx) => ({ id: `${now}-${idx}`, label: `Part ${idx + 1}`, content }));
    const newItem = finalizeGeneratedItemBackground({
      id: `${now}`,
      title: importTitle.trim() || 'Imported Lyrics',
      type: ItemType.SONG,
      slides,
      theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
      metadata: {
        source: 'import',
      },
    }, 'system');
    addItem(newItem);
    setImportTitle('Imported Lyrics');
    setImportLyrics('');
    setIsLyricsImportOpen(false);
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
      const importedItem = finalizeGeneratedItemBackground({
        id: `${Date.now()}`,
        title: resolveImportedDeckTitle(parsed.suggestedTitle),
        type: ItemType.ANNOUNCEMENT,
        slides: parsed.slides,
        theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
        metadata: {
          source: 'import',
        },
      }, 'system');
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: parsed.slides.length, mode: 'text' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      setImportModalError(error?.message || 'PowerPoint import failed.');
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
      if (!converted.slides.length) throw new Error('Visual PowerPoint import returned no slides.');
      if (isElectronShell && converted.slides.every((entry) => !entry.backgroundUrl)) {
        setImportDeckStatus('Visual render unavailable. Falling back to PPTX text import...');
        converted = await buildTextSlidesFromPptx(file);
        fallbackToText = true;
      }
      const importedItem = finalizeGeneratedItemBackground({
        id: `${Date.now()}`,
        title: resolveImportedDeckTitle(converted.suggestedTitle),
        type: fallbackToText ? ItemType.ANNOUNCEMENT : ItemType.MEDIA,
        slides: converted.slides,
        theme: { backgroundUrl: fallbackToText ? DEFAULT_BACKGROUNDS[0] : '', mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: fallbackToText, fontSize: fallbackToText ? 'large' : 'medium' },
        metadata: {
          source: 'import',
        },
      }, fallbackToText ? 'system' : 'user');
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: converted.slides.length, mode: fallbackToText ? 'visual_fallback_text' : 'visual' });
      setImportTitle('Imported Lyrics');
      setImportLyrics('');
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      const message = error?.message || 'Visual PowerPoint import failed.';
      if (isElectronShell && isVisualRendererUnavailable(message)) {
        try {
          setImportDeckStatus('Visual renderer unavailable. Falling back to PPTX text import...');
          const parsed = await buildTextSlidesFromPptx(file);
          const importedItem = finalizeGeneratedItemBackground({
            id: `${Date.now()}`,
            title: resolveImportedDeckTitle(parsed.suggestedTitle),
            type: ItemType.ANNOUNCEMENT,
            slides: parsed.slides,
            theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
            metadata: {
              source: 'import',
            },
          }, 'system');
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

  const insertMediaFileAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || looksLikeVideoUrl(file.name);
    try {
      const uploaded = user?.uid
        ? await uploadWorkspaceMedia(workspaceId, user, file)
        : null;
      const backgroundUrl = String(uploaded?.url || '').trim() || await saveMedia(file);
      const now = Date.now();
      const mediaItem = finalizeGeneratedItemBackground({
        id: `${now}-media-item`,
        title: file.name.replace(/\.[^.]+$/, '') || 'Media Item',
        type: ItemType.MEDIA,
        slides: [{
          id: `${now}-media-slide`,
          label: 'Media',
          content: '',
          backgroundUrl,
          mediaType: isVideo ? 'video' : 'image',
        }],
        theme: {
          backgroundUrl: '',
          mediaType: isVideo ? 'video' : 'image',
          fontFamily: 'sans-serif',
          textColor: '#ffffff',
          shadow: false,
          fontSize: 'medium',
        },
        metadata: {
          source: 'import',
        },
      }, 'user');
      addItem(mediaItem);
      setSelectedItemId(mediaItem.id);
    } catch (error: any) {
      setImportModalError(error?.message || 'Media import failed.');
    }
  };

  const insertVideoUrlAsItem = (urlOverride?: string) => {
    const url = (urlOverride ?? videoUrlDraft).trim();
    if (!url) return;
    const youtubeId = getYoutubeId(url);
    const isVideo = youtubeId || looksLikeVideoUrl(url);
    if (!youtubeId && !isVideo) return;
    const now = Date.now();
    const title = youtubeId ? `YouTube — ${youtubeId}` : (url.split('/').pop() || 'Video');
    const mediaItem = finalizeGeneratedItemBackground({
      id: `${now}-video-url-item`,
      title,
      type: ItemType.MEDIA,
      slides: [{
        id: `${now}-video-url-slide`,
        label: 'Video',
        content: '',
        backgroundUrl: url,
        mediaType: 'video',
      }],
      theme: {
        backgroundUrl: url,
        mediaType: 'video',
        fontFamily: 'sans-serif',
        textColor: '#ffffff',
        shadow: false,
        fontSize: 'medium',
      },
      metadata: { source: 'video-url' },
    }, 'user');
    addItem(mediaItem);
    setSelectedItemId(mediaItem.id);
    if (!urlOverride) setVideoUrlDraft('');
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
        logActivity(user?.uid, 'IMPORT_PPTX', { filename: file.name, slideCount: parsed.slides.length, mode: 'visual_slide_editor_server_unavailable_fallback_text' });
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

  const importEasyWorshipAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing EasyWorship file...');
    try {
      const parsed = await parseEasyWorshipFile(file);
      const now = Date.now();
      const slides: Slide[] = parsed.slides.map((entry, idx) => ({
        id: `${now}-ew-${idx + 1}`,
        label: entry.label || `Slide ${idx + 1}`,
        content: entry.content,
        ...(entry.notes ? { notes: entry.notes } : {}),
      }));
      const importedItem = finalizeGeneratedItemBackground({
        id: `${now}`,
        title: resolveImportedDeckTitle(parsed.title),
        type: ItemType.SONG,
        slides,
        theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
        metadata: { source: 'import' },
      }, 'system');
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_EASYWORSHIP', { filename: file.name, slideCount: slides.length });
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      setImportModalError(error?.message || 'EasyWorship import failed.');
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importProPresenterAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing ProPresenter file...');
    try {
      const parsed = await parseProPresenterFile(file);
      const now = Date.now();
      const slides: Slide[] = parsed.slides.map((entry, idx) => ({
        id: `${now}-pp-${idx + 1}`,
        label: entry.label || `Slide ${idx + 1}`,
        content: entry.content,
        ...(entry.notes ? { notes: entry.notes } : {}),
      }));
      const importedItem = finalizeGeneratedItemBackground({
        id: `${now}`,
        title: resolveImportedDeckTitle(parsed.title),
        type: ItemType.SONG,
        slides,
        theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
        metadata: { source: 'import' },
      }, 'system');
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_PROPRESENTER', { filename: file.name, slideCount: slides.length });
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      setImportModalError(error?.message || 'ProPresenter import failed.');
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importOpenSongAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing OpenSong file...');
    try {
      const parsed = await parseOpenSongFile(file);
      const now = Date.now();
      const slides: Slide[] = parsed.slides.map((entry, idx) => ({
        id: `${now}-os-${idx + 1}`,
        label: entry.label || `Slide ${idx + 1}`,
        content: entry.content,
        ...(entry.notes ? { notes: entry.notes } : {}),
      }));
      const importedItem = finalizeGeneratedItemBackground({
        id: `${now}`,
        title: resolveImportedDeckTitle(parsed.title),
        type: ItemType.SONG,
        slides,
        theme: { backgroundUrl: DEFAULT_BACKGROUNDS[0], mediaType: 'image', fontFamily: 'sans-serif', textColor: '#ffffff', shadow: true, fontSize: 'large' },
        metadata: { source: 'import' },
      }, 'system');
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_OPENSONG', { filename: file.name, slideCount: slides.length });
      setIsLyricsImportOpen(false);
    } catch (error: any) {
      setImportModalError(error?.message || 'OpenSong import failed.');
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const importOpenLyricsAsItem = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportModalError(null);
    setIsImportingDeck(true);
    setImportDeckStatus('Parsing OpenLyrics file...');
    try {
      const hymn = await parseOpenLyricsFile(file);
      const generated = generateSlidesFromHymn(hymn);
      const importedItem = finalizeGeneratedItemBackground(
        { ...generated.item, metadata: { ...generated.item.metadata, source: 'import' } },
        'system',
      );
      addItem(importedItem);
      logActivity(user?.uid, 'IMPORT_OPENLYRICS', { filename: file.name, slideCount: generated.slides.length });
    } catch (error: any) {
      setImportModalError(error?.message || 'OpenLyrics import failed.');
    } finally {
      setIsImportingDeck(false);
      setImportDeckStatus('');
    }
  };

  const handleSaveCcliApiCredentials = async (
    licenseNumber: string,
  ): Promise<void> => {
    if (!workspaceId) throw new Error('No workspace loaded.');
    setCcliActor(user?.uid ?? workspaceId, user?.email ?? null);
    await storeCcliCredentials(workspaceId, licenseNumber);
    // Sentinel — actual secret lives only on the server.
    initCcliProvider(
      { licenseNumber: '', clientId: '', clientSecret: '', connectedAt: Date.now() },
      workspaceId,
    );
    setCcliConnected(true);
    logActivity(user?.uid, 'CCLI_CREDENTIALS_SAVED', { licenseNumber });
  };

  const startSlideLabelRename = useCallback((itemId: string, slideId: string, currentLabel: string, source: 'runsheet' | 'thumbnail' = 'thumbnail') => {
    setInlineSlideRename({
      itemId,
      slideId,
      value: currentLabel.trim() || 'Slide',
      source,
    });
  }, []);

  const handleRenameSlideLabel = useCallback((itemId: string, slideId: string, nextLabel: string) => {
    const targetItem = schedule.find((entry) => entry.id === itemId);
    if (!targetItem) return;
    const targetSlide = targetItem.slides.find((entry) => entry.id === slideId);
    if (!targetSlide) return;
    const trimmed = String(nextLabel || '').trim();
    setInlineSlideRename(null);
    if (!trimmed) return;
    updateItem({
      ...targetItem,
      slides: targetItem.slides.map((entry) => (
        entry.id === slideId
          ? { ...entry, label: trimmed }
          : entry
      )),
    });
  }, [schedule, updateItem]);

  useEffect(() => {
    if (!inlineSlideRename) return;
    const focusHandle = window.setTimeout(() => {
      const input = inlineSlideRenameInputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    }, 0);
    return () => window.clearTimeout(focusHandle);
  }, [inlineSlideRename]);

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
      if (isPresenterBeta) {
        switch (e.key) {
          case 'ArrowUp':
            if (presenterFocusArea === 'schedule') {
              e.preventDefault();
              moveSelectedScheduleItemByOffset(-1);
            }
            break;
          case 'ArrowDown':
            if (presenterFocusArea === 'schedule') {
              e.preventDefault();
              moveSelectedScheduleItemByOffset(1);
            }
            break;
          case 'ArrowLeft':
            if (presenterFocusArea === 'filmstrip') {
              e.preventDefault();
              movePreviewSelectionByOffset(-1);
            }
            break;
          case 'ArrowRight':
            if (presenterFocusArea === 'filmstrip') {
              e.preventDefault();
              movePreviewSelectionByOffset(1);
            }
            break;
          case 'Enter':
            e.preventDefault();
            goLiveSelectedPreview();
            break;
          case ' ':
          case 'PageDown':
            e.preventDefault();
            nextSlide();
            break;
          case 'PageUp':
            e.preventDefault();
            prevSlide();
            break;
          case 'b':
          case 'B':
            setBlackout((prev) => !prev);
            break;
          case 'Escape':
            closePresenterContextMenu();
            break;
        }
        return;
      }
      switch (e.key) {
        case 'ArrowRight': case ' ': case 'PageDown': e.preventDefault(); nextSlide(); break;
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); prevSlide(); break;
        case 'b': setBlackout(prev => !prev); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, nextSlide, prevSlide, isPresenterBeta, presenterFocusArea, goLiveSelectedPreview, movePreviewSelectionByOffset, moveSelectedScheduleItemByOffset, closePresenterContextMenu, isAIModalOpen, isSlideEditorOpen, isHelpOpen, isProfileOpen, isMotionLibOpen, isTemplateOpen, isLyricsImportOpen]);




  useEffect(() => {
    if (!user?.uid) return;
    if (!canUseFirebaseSync) {
      if (!hasHydratedCloudStateRef.current) {
        hasHydratedCloudStateRef.current = true;
        setCloudBootstrapComplete(true);
      }
      return;
    }

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
            const preferredSelected = typeof preferred.selectedItemId === 'string' ? preferred.selectedItemId : '';
            const selectedExists = nextSchedule.some((item) => item.id === preferredSelected);
            const preferredActiveItemId = typeof preferred.activeItemId === 'string' ? preferred.activeItemId : null;
            const activeItem = preferredActiveItemId
              ? nextSchedule.find((item) => item.id === preferredActiveItemId)
              : null;
            const rawActiveIndex = typeof preferred.activeSlideIndex === 'number' ? preferred.activeSlideIndex : 0;
            const boundedIndex = activeItem
              ? Math.max(0, Math.min(activeItem.slides.length - 1, rawActiveIndex))
              : -1;
            applyHydratedStudioState({
              schedule: nextSchedule,
              selectedItemId: selectedExists ? preferredSelected : nextSchedule[0]?.id || '',
              activeItemId: activeItem ? activeItem.id : null,
              activeSlideIndex: activeItem && activeItem.slides.length > 0 ? boundedIndex : -1,
            });
          }

          if (Object.prototype.hasOwnProperty.call(preferred, 'holdScreenMode')) {
            setHoldScreenMode(sanitizeHoldScreenMode(preferred.holdScreenMode));
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
          if (preferred.stageTimerFlash && typeof preferred.stageTimerFlash === 'object') {
            const cloudFlash = sanitizeStageTimerFlashState(preferred.stageTimerFlash);
            setStageTimerFlash((prev) => (
              cloudFlash.updatedAt >= (prev.updatedAt || 0)
                ? cloudFlash
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
            setWorkspaceSettings((prev) => mergeIncomingWorkspaceSettings(prev, cloudSettings, cloudSettingsUpdatedAt));
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
  }, [user?.uid, cloudPlaylistId, reportSyncFailure, applyHydratedStudioState, canUseFirebaseSync]);

  useEffect(() => {
    if (!canUseFirebaseSync || !user?.uid || !cloudBootstrapComplete) return;

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
  }, [user?.uid, cloudBootstrapComplete, executeRemoteCommand, liveSessionId, reportSyncFailure, canUseFirebaseSync]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    let active = true;
    const pollServerCommands = async () => {
      const response = await fetchServerSessionState(workspaceId, liveSessionId);
      if (!active || !response?.state) return;
      const data = response.state;

      // Remote command sync (existing)
      const rawIncomingAt = data.remoteCommandAt;
      const incomingAt = typeof rawIncomingAt === 'number' && Number.isFinite(rawIncomingAt) ? rawIncomingAt : null;
      if (incomingAt && incomingAt !== lastServerRemoteCommandAtRef.current) {
        lastServerRemoteCommandAtRef.current = incomingAt;
        const command = data.remoteCommand;
        if (isRemoteCommand(command)) executeRemoteCommand(command);
      }

      // Schedule snapshot sync for collaborators: apply when controller wrote a newer snapshot
      const rawScheduleAt = data.scheduleSnapshotAt;
      const scheduleAt = typeof rawScheduleAt === 'number' && Number.isFinite(rawScheduleAt) ? rawScheduleAt : null;
      const isCollaborator = typeof data.controllerOwnerUid === 'string' && data.controllerOwnerUid !== user.uid;
      if (
        scheduleAt &&
        scheduleAt !== lastServerScheduleSnapshotAtRef.current &&
        isCollaborator &&
        Array.isArray(data.scheduleSnapshot) &&
        data.scheduleSnapshot.length > 0
      ) {
        lastServerScheduleSnapshotAtRef.current = scheduleAt;
        applyHydratedStudioState({ schedule: data.scheduleSnapshot });
      }

      // Sermon flash request relayed from a stage device
      const rawSermonFlashAt = data.sermonFlashRequestAt;
      const sermonFlashAt = typeof rawSermonFlashAt === 'number' && Number.isFinite(rawSermonFlashAt) ? rawSermonFlashAt : null;
      if (sermonFlashAt && sermonFlashAt !== lastServerSermonFlashAtRef.current) {
        lastServerSermonFlashAtRef.current = sermonFlashAt;
        const req = data.sermonFlashRequest;
        if (req && typeof req === 'object' && typeof (req as Record<string, unknown>).transcript === 'string') {
          const flashReq = req as { transcript: string; summary?: unknown };
          handleSermonFlashToScreen({
            transcript: flashReq.transcript,
            ...(flashReq.summary ? { summary: flashReq.summary as import('./services/sermonSummaryService').SermonSummary } : {}),
          });
        }
      }
    };
    pollServerCommands();
    const id = window.setInterval(pollServerCommands, 650);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, [workspaceId, liveSessionId, user?.uid, user, cloudBootstrapComplete, executeRemoteCommand, applyHydratedStudioState, handleSermonFlashToScreen]);

  useEffect(() => {
    if (!user?.uid || !cloudBootstrapComplete) return;
    syncLiveState({
      activeItemId,
      activeSlideIndex,
      blackout,
      holdScreenMode,
      isPlaying,
      outputMuted,
      seekCommand,
      seekAmount,
      seekTarget,
      videoSyncEpoch,
      lowerThirdsEnabled,
      routingMode,
      timerMode,
      timerSeconds,
      timerDurationSec: effectiveTimerDurationSec,
      timerCueSpeaker: currentCueSpeaker,
      timerCueAmberPercent: currentCueAmberPercent,
      timerCueRedPercent: currentCueRedPercent,
      stageTimerFlash,
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
  }, [activeItemId, activeSlideIndex, blackout, holdScreenMode, isPlaying, outputMuted, seekCommand, seekAmount, seekTarget, videoSyncEpoch, lowerThirdsEnabled, routingMode, timerMode, timerSeconds, effectiveTimerDurationSec, currentCueSpeaker, currentCueAmberPercent, currentCueRedPercent, stageTimerFlash, currentCueItemId, audienceDisplay, audienceQrProjection, stageMessageCenter, workspaceSettings, user?.uid, user?.email, allowedAdminEmails, syncLiveState, cloudBootstrapComplete]);

  useEffect(() => {
    if (hasElectronDisplayControl) return;
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
  }, [user?.uid, cloudBootstrapComplete, workspaceSettings.machineMode, isOutputLive, isStageDisplayLive, hasElectronDisplayControl]);

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
        if (timerMode === 'COUNTDOWN') {
          const next = prev - 1;
          if (next <= 0 && currentCueOvertimeBehavior !== 'count-up') {
            return 0;
          }
          return next;
        }
        return prev + 1;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [timerRunning, timerMode, currentCueItemId, currentCueOvertimeBehavior]);

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

    // Fire timer_end macro triggers
    const timerEndMatches = matchTriggers(
      { type: 'timer_end', timerPresetId: currentCue.itemId },
      macrosRef.current,
    );
    timerEndMatches.forEach((macro) => {
      import('./services/macroEngine').then(({ executeMacro }) => {
        executeMacro(macro, macroCtxRef.current).catch(() => {});
      });
    });
  }, [timerMode, timerRunning, timerSeconds, currentCue, currentCueIndex, enabledTimerCues, activateCueByItemId]);

  // --- flash-and-stop overtime behavior ---
  const flashStopGuardRef = useRef<string>('');
  useEffect(() => {
    if (timerMode !== 'COUNTDOWN' || !timerRunning || !currentCue) return;
    if (timerSeconds > 0) return;
    if (currentCueOvertimeBehavior !== 'flash-and-stop' && currentCueOvertimeBehavior !== 'stop') return;

    const guardKey = `${currentCue.itemId}-stop`;
    if (flashStopGuardRef.current === guardKey) return;
    flashStopGuardRef.current = guardKey;

    if (currentCueOvertimeBehavior === 'flash-and-stop') {
      updateStageTimerFlash({ active: true, color: 'red', updatedAt: Date.now() });
      setTimeout(() => {
        updateStageTimerFlash({ active: false, updatedAt: Date.now() });
        setTimerRunning(false);
      }, 3000);
    } else {
      setTimerRunning(false);
    }
  }, [timerMode, timerRunning, timerSeconds, currentCue, currentCueOvertimeBehavior, updateStageTimerFlash]);

  useEffect(() => {
    if (timerRunning || timerSeconds > 0) {
      setCueZeroHold(false);
      flashStopGuardRef.current = '';
    }
  }, [timerRunning, timerSeconds, currentCueItemId]);

  // --- Chime threshold-crossing detection ---
  useEffect(() => {
    if (timerMode !== 'COUNTDOWN' || !timerRunning || !currentCue) return;
    if (!workspaceSettings.timerChimesEnabled) return;

    const dur = currentCue.cue.durationSec;
    const amberPct = currentCue.cue.amberPercent;
    const redPct = currentCue.cue.redPercent;
    const amberSec = Math.round(dur * amberPct / 100);
    const redSec = Math.round(dur * redPct / 100);
    const cueId = currentCue.itemId;

    // Find the active preset for chime config
    const activePreset = (workspaceSettings.speakerTimerPresets || []).find(
      (p) => p.id === (schedule.find((item) => item.id === cueId)?.timerCue?.presetId),
    );
    const chimeAmber = activePreset?.chimeOnAmber !== false;
    const chimeRed = activePreset?.chimeOnRed !== false;
    const chimeMilestones = activePreset?.chimeOnMilestones === true;

    // Determine which boundary we just crossed
    let boundary = '';
    if (timerSeconds <= 0 && chimeRed) {
      boundary = 'overtime';
    } else if (timerSeconds <= redSec && timerSeconds > redSec - 1 && chimeRed) {
      boundary = 'red';
    } else if (timerSeconds <= amberSec && timerSeconds > amberSec - 1 && chimeAmber) {
      boundary = 'amber';
    } else if (chimeMilestones && timerSeconds === 30) {
      boundary = 'milestone-30';
    } else if (chimeMilestones && timerSeconds === 10) {
      boundary = 'milestone-10';
    }

    if (!boundary) return;

    // Guard: don't fire the same boundary for the same cue twice
    const lastFired = lastChimeFiredRef.current;
    if (lastFired.cueId === cueId && lastFired.boundary === boundary) return;
    lastChimeFiredRef.current = { cueId, boundary };

    if (boundary === 'amber') timerChimeService.playAmberChime();
    else if (boundary === 'red') timerChimeService.playRedChime();
    else if (boundary === 'overtime') timerChimeService.playOvertimeChime();
    else timerChimeService.playMilestoneChime();
  }, [timerMode, timerRunning, timerSeconds, currentCue, workspaceSettings.timerChimesEnabled, workspaceSettings.speakerTimerPresets, schedule]);

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

  useLayoutEffect(() => {
    setIsSidebarHovering(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ left: 0, top: window.scrollY, behavior: 'auto' });
    }
    try {
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
      if (studioShellRef.current) {
        studioShellRef.current.scrollLeft = 0;
      }
    } catch {}
  }, [viewMode, sidebarPinned, activeSidebarTab, viewportWidth]);

  useEffect(() => {
    if (!presenterSidebarCompact) {
      setIsSidebarHovering(false);
      return;
    }
    setIsSidebarHovering(false);
    if (sidebarPinned) {
      setPresenterSidebarDrawerOpen(true);
    }
  }, [presenterSidebarCompact, sidebarPinned]);

  useEffect(() => {
    if (!presenterSidebarDrawerVisible || sidebarPinned) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPresenterSidebarDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [presenterSidebarDrawerVisible, sidebarPinned]);

  const handleSidebarPinToggle = () => {
    if (presenterSidebarCompact) {
      setSidebarPinned((prev) => {
        const next = !prev;
        setPresenterSidebarDrawerOpen(next);
        return next;
      });
      return;
    }
    setSidebarPinned((prev) => !prev);
  };

  const handleSidebarTabSelect = (tab: 'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS') => {
    setActiveSidebarTab(tab);
    if (presenterSidebarCompact) {
      setPresenterSidebarDrawerOpen(true);
    }
  };

  // ✅ Launch Output handler (opens window synchronously from user gesture — popup-safe)
  const handleToggleOutput = () => {
    if (!activeItem && selectedItem && selectedItem.slides.length > 0) {
      goLive(selectedItem, 0);
    } else if (activeItem && !activeSlide && activeItem.slides.length > 0) {
      goLive(activeItem, 0);
    }

    if (hasElectronDisplayControl) {
      const audienceDisplayId = desktopRoleAssignments.audience;
      if (desktopServiceState.outputOpen) {
        void electronMachineApi?.closeRoleWindow?.('audience').then((state) => {
          if (!state) return;
          setDesktopServiceState(state);
          setIsOutputLive(false);
        });
        return;
      }

      if (!audienceDisplayId) {
        setDesktopDisplayStatusText('Assign an audience display before launching output.');
        setIsDisplaySetupOpen(true);
        return;
      }

      void electronMachineApi?.openRoleWindow?.({
        role: 'audience',
        displayId: audienceDisplayId,
        workspaceId,
        sessionId: liveSessionId,
      }).then((result) => {
        if (!result?.ok || !result.state) {
          setDesktopDisplayStatusText('Could not open the audience display.');
          return;
        }
        setDesktopServiceState(result.state);
        setIsOutputLive(true);
        setPopupBlocked(false);
        setOutputWin(null);
      }).catch((error) => {
        console.error('Failed to open audience display', error);
        setDesktopDisplayStatusText('Audience display launch failed.');
      });
      return;
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
    if (hasElectronDisplayControl) {
      const stageDisplayId = desktopRoleAssignments.stage;
      if (desktopServiceState.stageOpen) {
        void electronMachineApi?.closeRoleWindow?.('stage').then((state) => {
          if (!state) return;
          setDesktopServiceState(state);
          setIsStageDisplayLive(false);
        });
        return;
      }

      if (!stageDisplayId) {
        setDesktopDisplayStatusText('Assign a stage display before launching stage view.');
        setIsDisplaySetupOpen(true);
        return;
      }

      void electronMachineApi?.openRoleWindow?.({
        role: 'stage',
        displayId: stageDisplayId,
        workspaceId,
        sessionId: liveSessionId,
      }).then((result) => {
        if (!result?.ok || !result.state) {
          setDesktopDisplayStatusText('Could not open the stage display.');
          return;
        }
        setDesktopServiceState(result.state);
        setIsStageDisplayLive(true);
        setPopupBlocked(false);
        setStageWin(null);
      }).catch((error) => {
        console.error('Failed to open stage display', error);
        setDesktopDisplayStatusText('Stage display launch failed.');
      });
      return;
    }

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

  // --- Timer Pop-out Window ---
  const handleToggleTimerPopout = () => {
    if (timerPopoutWin && !timerPopoutWin.closed) {
      timerPopoutWin.close();
      setTimerPopoutWin(null);
      return;
    }
    const w = window.open(
      'about:blank',
      'LuminaTimerPopout',
      'width=640,height=320,menubar=no,toolbar=no,location=no,status=no,resizable=yes',
    );
    if (!w) return;
    setTimerPopoutWin(w);
    w.document.write(`<!DOCTYPE html><html><head><title>Timer</title><style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{background:#000;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,monospace;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;overflow:hidden}
      #timer{font-size:min(28vw,28vh);font-weight:900;font-variant-numeric:tabular-nums;transition:color .3s,text-shadow .3s}
      #label{font-size:min(3vw,3vh);text-transform:uppercase;letter-spacing:.25em;opacity:.6;margin-top:.5em}
      #ring{position:absolute;top:12px;right:12px}
      .green{color:#34d399;text-shadow:0 0 20px rgba(52,211,153,.3)}
      .amber{color:#fcd34d;text-shadow:0 0 20px rgba(252,211,77,.3)}
      .red{color:#f87171;text-shadow:0 0 24px rgba(248,113,113,.4)}
      .overtime{color:#f87171;animation:pulse 1.2s ease-in-out infinite}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}
    </style></head><body>
      <svg id="ring" width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="4"/><circle id="arc" cx="32" cy="32" r="28" fill="none" stroke="#34d399" stroke-width="4" stroke-dasharray="${2 * Math.PI * 28}" stroke-dashoffset="0" stroke-linecap="round" transform="rotate(-90 32 32)" style="transition:stroke-dashoffset 1s linear,stroke .3s"/></svg>
      <div id="timer">--:--</div>
      <div id="label">Timer</div>
      <script>
        const C=${2 * Math.PI * 28};
        const bc=new BroadcastChannel('lumina-timer-popout');
        bc.onmessage=function(e){
          var d=e.data;if(!d)return;
          var el=document.getElementById('timer');
          var arc=document.getElementById('arc');
          var label=document.getElementById('label');
          el.textContent=d.display||'--:--';
          label.textContent=(d.speaker||d.label||'Timer')+(d.overtime?' — OVERTIME':'');
          var cls=d.overtime?'overtime':d.zone==='red'?'red':d.zone==='amber'?'amber':'green';
          el.className=cls;
          var ratio=d.ratio!=null?d.ratio:1;
          arc.setAttribute('stroke-dashoffset',String(C*(1-Math.max(0,Math.min(1,ratio)))));
          arc.setAttribute('stroke',d.zone==='red'?'rgba(248,113,113,.9)':d.zone==='amber'?'rgba(252,211,77,.9)':'rgba(52,211,153,.85)');
        };
      <\/script></body></html>`);
    w.document.close();
    try { w.focus(); } catch {}
  };

  useEffect(() => {
    if (timerPopoutWin && timerPopoutWin.closed) setTimerPopoutWin(null);
    const check = window.setInterval(() => {
      if (timerPopoutWin && timerPopoutWin.closed) { setTimerPopoutWin(null); }
    }, 1000);
    return () => window.clearInterval(check);
  }, [timerPopoutWin]);

  useEffect(() => {
    if (!timerBroadcastRef.current) {
      try { timerBroadcastRef.current = new BroadcastChannel('lumina-timer-popout'); } catch { return; }
    }
    const bc = timerBroadcastRef.current;
    const remaining = timerMode === 'COUNTDOWN' ? timerSeconds : timerSeconds;
    const duration = effectiveTimerDurationSec;
    const ratio = duration > 0 ? Math.max(0, remaining / duration) : 1;
    const amberPct = currentCueAmberPercent / 100;
    const redPct = currentCueRedPercent / 100;
    const zone = isTimerOvertime ? 'red' : ratio <= redPct ? 'red' : ratio <= amberPct ? 'amber' : 'green';
    bc.postMessage({
      display: formatTimer(timerSeconds),
      ratio,
      zone,
      overtime: isTimerOvertime,
      label: timerMode,
      speaker: currentCueSpeaker,
    });
  }, [timerSeconds, timerMode, isTimerOvertime, effectiveTimerDurationSec, currentCueAmberPercent, currentCueRedPercent, currentCueSpeaker]);

  const shouldBypassAppAuthGate = (
    (viewState === 'output' && managedRouteParams.hasManagedOutputRoute)
    || (viewState === 'stage' && managedRouteParams.hasManagedStageRoute)
  );

  if (authLoading && !shouldBypassAppAuthGate) return <div className="h-screen w-screen bg-black flex items-center justify-center text-zinc-500 font-mono text-xs animate-pulse">LOADING NEURAL HUB...</div>;

  // ROUTING: LANDING PAGE
  if (viewState === 'landing') {
    if (isElectronShell) {
      return null;
    }
    return <LandingPage
      onEnter={() => setViewState('studio')}
      onLogout={user ? handleLogout : undefined}
      isAuthenticated={!!user}
      hasSavedSession={hasSavedSession}
      user={user ? { uid: user.uid, email: user.email } : null}
      userPlan={userPlan}
      onPlanActivated={(plan) => setUserPlan(plan)}
    />;
  }

  // ROUTING: AUDIENCE SUBMISSION PAGE
  if (viewState === 'audience') {
    return <AudienceSubmit workspaceId={workspaceId} />;
  }

  // ROUTING: PROJECTOR / OBS OUTPUT
  if (viewState === 'output') {
    if (managedRouteParams.hasManagedOutputRoute) {
      return <OutputRoute />;
    }
    const holdState = renderPresenterHoldState();
    return (
      <div className="h-screen w-screen bg-black overflow-hidden relative">
        {holdState ? holdState : (!activeItem || !activeSlide) ? (
          <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 font-mono text-xs font-bold tracking-[0.2em]">WAITING_FOR_LIVE_CONTENT</div>
        ) : (
          <SlideRenderer
            slide={activeSlide}
            item={activeItem}
            isPlaying={isPlaying}
            seekCommand={seekCommand}
            seekAmount={seekAmount}
            seekTarget={seekTarget}
            videoSyncEpoch={videoSyncEpoch}
            isMuted={outputMuted}
            isProjector={true}
            lowerThirds={lowerThirdsEnabled}
            showSlideLabel={true}
            audienceOverlay={audienceDisplay}
            projectedAudienceQr={isNdiCapture ? undefined : audienceQrProjection}
            branding={{ enabled: workspaceSettings.slideBrandingEnabled, churchName: workspaceSettings.churchName, seriesLabel: workspaceSettings.slideBrandingSeriesLabel, style: workspaceSettings.slideBrandingStyle, textOpacity: workspaceSettings.slideBrandingOpacity }}
          />
        )}
      </div>
    );
  }

  if (viewState === 'stage') {
    if (managedRouteParams.hasManagedStageRoute) {
      return <StageRoute />;
    }
    const holdState = renderPresenterHoldState();
    if (holdState) {
      return <div className="h-screen w-screen bg-black overflow-hidden">{holdState}</div>;
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
        timerFlashActive={stageTimerFlash.active}
        timerFlashColor={stageTimerFlash.color}
        timerLayout={workspaceSettings.stageTimerLayout}
        onTimerLayoutChange={handleStageTimerLayoutChange}
        stageAlertLayout={workspaceSettings.stageAlertLayout}
        onStageAlertLayoutChange={handleStageAlertLayoutChange}
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

  // ROUTING: LOGIN (If not authenticated, force login for studio — both browser and Electron)
  // Exception: when running under Playwright E2E (VITE_E2E=true) with the Electron shell flag
  // injected by addInitScript, skip the gate so tests can reach the studio without Firebase creds.
  // This env var is never set in production builds; it is only passed by run-e2e.mjs.
  // @ts-ignore
  const _e2eElectronBypass = import.meta.env.VITE_E2E === 'true' && window.electron?.isElectron;
  if (!user && viewState === 'studio' && !_e2eElectronBypass) {
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
    // In Electron there's no public landing page, so the login screen cannot be dismissed.
    return <LoginScreen onLoginSuccess={handleLoginSuccess} onClose={isElectronShell ? undefined : () => setViewState('landing')} />;
  }

  const renderScheduleList = () => (
    <div className="flex-1 overflow-y-auto bg-zinc-950" data-testid="runsheet-list">
      {teamPlaylists.length > 0 && (<div className="px-3 py-2 text-[10px] text-emerald-400 border-b border-zinc-900">Cloud Playlists Synced: {teamPlaylists.length}</div>)}
      {schedule.map((item, idx) => (
        <React.Fragment key={item.id}>
          <div
            data-testid={`schedule-item-${item.id}`}
            draggable={viewMode === 'BUILDER'}
            onDragStart={(e) => {
              if (viewMode !== 'BUILDER') return;
              setDraggedScheduleItemId(item.id);
              setScheduleDropIndicator({ itemId: item.id, after: false });
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', item.id);
            }}
            onDragEnd={() => {
              setDraggedScheduleItemId(null);
              setScheduleDropIndicator(null);
            }}
            onDragOver={(e) => {
              if (viewMode !== 'BUILDER' || !draggedScheduleItemId) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setScheduleDropIndicator({
                itemId: item.id,
                after: e.clientY > (rect.top + rect.height / 2),
              });
            }}
            onDrop={(e) => {
              if (viewMode !== 'BUILDER' || !draggedScheduleItemId) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              reorderScheduleItems(draggedScheduleItemId, item.id, e.clientY > (rect.top + rect.height / 2));
              setDraggedScheduleItemId(null);
              setScheduleDropIndicator(null);
            }}
            onClick={() => {
              setSelectedItemId(item.id);
              if (viewMode === 'PRESENTER') {
                setBlackout(false);
                if (Array.isArray(item.slides) && item.slides.length > 0) {
                  const currentIdx = activeItemId === item.id && activeSlideIndex >= 0 ? activeSlideIndex : 0;
                  goLive(item, currentIdx);
                }
              }
            }}
            className={`px-3 py-3 cursor-pointer flex items-center justify-between group transition-colors border-l-2 ${
              selectedItemId === item.id ? 'bg-zinc-900 border-l-blue-600' : 'hover:bg-zinc-900/50 border-l-transparent'
            } ${activeItemId === item.id ? 'bg-red-950/20' : ''} ${
              scheduleDropIndicator?.itemId === item.id && draggedScheduleItemId && draggedScheduleItemId !== item.id
                ? (scheduleDropIndicator.after ? 'border-b-2 border-b-blue-500' : 'border-t-2 border-t-blue-500')
                : ''
            }`}
          >
            <div className="flex flex-col truncate flex-1 min-w-0 pr-2">
              <span className={`font-medium text-sm truncate ${activeItemId === item.id ? 'text-red-500' : 'text-zinc-300'}`}>{item.title}</span>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mt-1 flex items-center gap-1">{item.type}</span>
            </div>
            <div className="flex gap-1 items-center">
              {activeItemId === item.id && <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse mr-2"></div>}
              {viewMode === 'BUILDER' ? (
                <>
                  <span
                    className={`px-1.5 py-1 text-[9px] font-bold border rounded-sm ${
                      draggedScheduleItemId === item.id ? 'border-blue-500 text-blue-300 bg-blue-950/20' : 'border-zinc-800 text-zinc-500'
                    }`}
                    title="Drag to reorder"
                  >
                    DRAG
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveScheduleItemByOffset(item.id, -1); }}
                    disabled={idx === 0}
                    className="px-1.5 py-1 text-[9px] font-bold border border-zinc-800 rounded-sm text-zinc-400 disabled:opacity-25 hover:text-white"
                    title="Move up"
                  >
                    UP
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveScheduleItemByOffset(item.id, 1); }}
                    disabled={idx === schedule.length - 1}
                    className="px-1.5 py-1 text-[9px] font-bold border border-zinc-800 rounded-sm text-zinc-400 disabled:opacity-25 hover:text-white"
                    title="Move down"
                  >
                    DN
                  </button>
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
                <div
                  key={slide.id}
                  draggable={viewMode === 'BUILDER' && selectedItemId === item.id}
                  onDragStart={(e) => {
                    if (viewMode !== 'BUILDER' || selectedItemId !== item.id) return;
                    setDraggedRunSheetSlide({ itemId: item.id, slideId: slide.id });
                    setRunSheetSlideDropIndicator({ itemId: item.id, slideId: slide.id, after: false });
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', slide.id);
                  }}
                  onDragEnd={() => {
                    setDraggedRunSheetSlide(null);
                    setRunSheetSlideDropIndicator(null);
                  }}
                  onDragOver={(e) => {
                    if (viewMode !== 'BUILDER' || !draggedRunSheetSlide || draggedRunSheetSlide.itemId !== item.id) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setRunSheetSlideDropIndicator({
                      itemId: item.id,
                      slideId: slide.id,
                      after: e.clientY > (rect.top + rect.height / 2),
                    });
                  }}
                  onDrop={(e) => {
                    if (viewMode !== 'BUILDER' || !draggedRunSheetSlide || draggedRunSheetSlide.itemId !== item.id) return;
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    reorderItemSlides(item.id, draggedRunSheetSlide.slideId, slide.id, e.clientY > (rect.top + rect.height / 2));
                    setDraggedRunSheetSlide(null);
                    setRunSheetSlideDropIndicator(null);
                  }}
                  className={`pl-8 pr-3 py-2 text-xs text-zinc-500 hover:text-zinc-200 cursor-pointer border-l-2 ${activeItemId === item.id && activeSlideIndex === sIdx ? 'text-red-400 font-bold border-l-red-600 bg-red-950/10' : 'border-l-transparent hover:bg-zinc-900/30'} ${
                    runSheetSlideDropIndicator?.itemId === item.id && runSheetSlideDropIndicator.slideId === slide.id && draggedRunSheetSlide && draggedRunSheetSlide.slideId !== slide.id
                      ? (runSheetSlideDropIndicator.after ? 'border-b-2 border-b-blue-500' : 'border-t-2 border-t-blue-500')
                      : ''
                  }`}
                  onClick={(e) => { e.stopPropagation(); if (viewMode === 'PRESENTER') goLive(item, sIdx); }}
                >
                  <div className="flex justify-between items-center gap-2">
                      {inlineSlideRename?.itemId === item.id && inlineSlideRename.slideId === slide.id && inlineSlideRename.source === 'runsheet' ? (
                      <div className="flex flex-1 items-center gap-1">
                        <input
                          ref={inlineSlideRenameInputRef}
                          autoFocus
                          type="text"
                          value={inlineSlideRename.value}
                          onMouseDown={(e) => { e.stopPropagation(); }}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setInlineSlideRename((current) => (
                              current && current.itemId === item.id && current.slideId === slide.id
                                ? { ...current, value: nextValue }
                                : current
                            ));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameSlideLabel(item.id, slide.id, inlineSlideRename.value);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              setInlineSlideRename(null);
                            }
                          }}
                          className="h-7 flex-1 rounded border border-cyan-700 bg-zinc-950 px-2 text-[11px] font-mono text-zinc-100 outline-none"
                          title="Press Enter or click save to store the name. Press Escape or X to cancel."
                          data-testid={`runsheet-slide-rename-input-${slide.id}`}
                        />
                        <button
                          type="button"
                          onMouseDown={(e) => { e.stopPropagation(); }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRenameSlideLabel(item.id, slide.id, inlineSlideRename.value);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-700 bg-zinc-950 text-emerald-300 hover:bg-emerald-950/30"
                          title="Save name"
                          aria-label="Save slide name"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setInlineSlideRename(null);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-300 hover:bg-zinc-900"
                          title="Cancel rename"
                          aria-label="Cancel slide rename"
                        >
                          <XIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="truncate flex-1 font-mono text-[10px] opacity-80" data-testid={`runsheet-slide-label-${slide.id}`}>{slide.label || `SLIDE ${sIdx + 1}`}</span>
                    )}
                    <div className="flex items-center gap-1">
                      {viewMode === 'BUILDER' && selectedItemId === item.id && (
                        <>
                        <span
                          className={`px-1.5 py-1 text-[9px] font-bold border rounded-sm ${
                            draggedRunSheetSlide?.itemId === item.id && draggedRunSheetSlide.slideId === slide.id
                              ? 'border-blue-500 text-blue-300 bg-blue-950/20'
                              : 'border-zinc-800 text-zinc-500'
                          }`}
                          title="Drag inside this item only"
                        >
                          DRAG
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveSlideWithinItem(item.id, slide.id, -1); }}
                          disabled={sIdx === 0}
                          className="px-1.5 py-1 text-[9px] font-bold border border-zinc-800 rounded-sm text-zinc-400 disabled:opacity-25 hover:text-white"
                          title="Move slide up"
                          data-testid={`runsheet-slide-up-${slide.id}`}
                        >
                          UP
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveSlideWithinItem(item.id, slide.id, 1); }}
                          disabled={sIdx === item.slides.length - 1}
                          className="px-1.5 py-1 text-[9px] font-bold border border-zinc-800 rounded-sm text-zinc-400 disabled:opacity-25 hover:text-white"
                          title="Move slide down"
                          data-testid={`runsheet-slide-down-${slide.id}`}
                        >
                          DN
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            startSlideLabelRename(item.id, slide.id, slide.label || `Slide ${sIdx + 1}`, 'runsheet');
                          }}
                          className="inline-flex items-center justify-center rounded border border-zinc-800 bg-zinc-950 px-1.5 py-1 text-zinc-400 hover:border-cyan-700 hover:text-cyan-300"
                          title="Rename slide/image"
                          aria-label={`Rename ${slide.label || `Slide ${sIdx + 1}`}`}
                          data-testid={`runsheet-slide-rename-${slide.id}`}
                        >
                          <EditIcon className="w-3 h-3" />
                        </button>
                        </>
                      )}
                      {activeItemId === item.id && activeSlideIndex === sIdx && <span className="text-[9px] uppercase tracking-widest text-red-600 font-bold">LIVE</span>}
                    </div>
                  </div>
                  <div className="truncate opacity-70 mt-0.5 font-sans">{slide.content.replace(/<[^>]*>/g, '').substring(0, 40)}</div>
                </div>
              ))}
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderRundownList = renderScheduleList;

  const applySelectedPresetToCurrentCue = () => {
    if (!selectedSpeakerPresetId) return;
    const preset = (workspaceSettings.speakerTimerPresets || []).find(p => p.id === selectedSpeakerPresetId);
    if (!preset) return;
    const targetId = currentCueItemId || selectedItemId;
    if (!targetId) return;
    applySpeakerPresetToItem(targetId, preset.id);
  };

  const itemIsLive = (itemId: string, slideIndex?: number) => {
    if (activeItemId !== itemId) return false;
    if (slideIndex !== undefined && activeSlideIndex !== slideIndex) return false;
    return true;
  };

  const copyShareUrl = async (url: string, message: string = 'URL copied!') => {
    const ok = await copyTextToClipboard(url);
    if (ok) {
       // Best effort notification
       console.log(message);
    }
  };

  const clearHold = () => {
    setHoldScreenMode('clear');
    setBlackout(false);
  };

  const logoHold = () => {
    setHoldScreenMode('logo');
    setBlackout(false);
  };

  const resumeProgramOutput = () => {
    if (activeItem && activeSlide) {
      setBlackout(false);
      setHoldScreenMode('none');
      setIsPlaying(true);
      return;
    }
    goLiveSelectedPreview();
  };

  function renderPresenterHoldState(compact = false) {
    if (blackout) return <HoldScreen view="blackout" compact={compact} />;
    if (holdScreenMode === 'clear') return <HoldScreen view="clear" compact={compact} />;
    if (holdScreenMode === 'logo') return <HoldScreen view="logo" churchName={workspaceSettings.churchName} compact={compact} />;
    return null;
  }

  const presenterContextMenuActions: ContextMenuAction[] = (() => {
    if (!presenterContextMenu) return [];

    if (presenterContextMenu.type === 'schedule') {
      const targetIndex = schedule.findIndex((entry) => entry.id === presenterContextMenu.itemId);
      const targetItem = targetIndex >= 0 ? schedule[targetIndex] : null;
      if (!targetItem) return [];
      return [
        {
          id: 'select',
          label: 'Select Item',
          onSelect: () => selectPresenterPreviewItem(targetItem.id),
        },
        {
          id: 'go-live',
          label: 'Go Live',
          disabled: !targetItem.slides.length,
          onSelect: () => goLive(targetItem, 0),
        },
        {
          id: 'duplicate',
          label: 'Duplicate Item',
          onSelect: () => duplicateScheduleItem(targetItem.id),
        },
        {
          id: 'move-up',
          label: 'Move Up',
          disabled: targetIndex <= 0,
          onSelect: () => moveScheduleItemByOffset(targetItem.id, -1),
        },
        {
          id: 'move-down',
          label: 'Move Down',
          disabled: targetIndex >= schedule.length - 1,
          onSelect: () => moveScheduleItemByOffset(targetItem.id, 1),
        },
        {
          id: 'archive',
          label: 'Archive Item',
          onSelect: () => {
            void handleArchiveSingleRunSheetItem(targetItem.id);
          },
        },
        {
          id: 'delete',
          label: 'Delete Item',
          danger: true,
          onSelect: () => removeItem(targetItem.id),
        },
      ];
    }

    const targetItem = schedule.find((entry) => entry.id === presenterContextMenu.itemId);
    const targetSlide = targetItem?.slides?.[presenterContextMenu.slideIndex] || null;
    if (!targetItem || !targetSlide) return [];

    if (presenterContextMenu.type === 'preview-slide') {
      return [
        {
          id: 'preview',
          label: 'Preview This Slide',
          onSelect: () => selectPresenterPreviewSlide(targetItem.id, presenterContextMenu.slideIndex, 'filmstrip'),
        },
        {
          id: 'go-live',
          label: 'Send Slide Live',
          onSelect: () => goLive(targetItem, presenterContextMenu.slideIndex),
        },
        {
          id: 'copy-text',
          label: 'Copy Slide Text',
          disabled: !targetSlide.content.trim(),
          onSelect: () => {
            void copyTextToClipboard(targetSlide.content);
          },
        },
      ];
    }

    return [
      {
        id: 'load-live',
        label: 'Jump Live Here',
        onSelect: () => jumpToLiveSlide(targetItem.id, presenterContextMenu.slideIndex),
      },
      {
        id: 'copy-text',
        label: 'Copy Slide Text',
        disabled: !targetSlide.content.trim(),
        onSelect: () => {
          void copyTextToClipboard(targetSlide.content);
        },
      },
    ];
  })();

  const presenterLibraryTabs: Array<{ id: PresenterLibraryTab; label: string }> = [
    { id: 'songs', label: 'Songs' },
    { id: 'scripture', label: 'Scripture' },
    { id: 'media', label: 'Media' },
    { id: 'presentations', label: 'Presentations' },
  ];

  const renderPresenterBetaLibraryContent = () => {
    if (presenterLibraryTab === 'songs') {
      return (
        <div className="h-full min-h-0">
          <HymnLibrary
            schedule={schedule}
            selectedItemId={selectedItemId}
            onApplyInsertion={handleApplyHymnInsertion}
            compact={true}
          />
        </div>
      );
    }

    if (presenterLibraryTab === 'scripture') {
      return (
        <div className="h-full min-h-0 overflow-hidden p-2.5">
          <BibleBrowser
            onProjectRequest={(item) => {
              stageGeneratedItem({
                ...item,
                metadata: {
                  ...item.metadata,
                  source: item.metadata?.source || 'bible',
                },
              }, 'system', { goLive: true });
            }}
            onAddRequest={(item) => {
              stageGeneratedItem({
                ...item,
                metadata: {
                  ...item.metadata,
                  source: item.metadata?.source || 'bible',
                },
              }, 'system', { select: false });
            }}
            onLiveStyleUpdate={handleBibleLiveUpdate}
            speechLocaleMode={workspaceSettings.visionarySpeechLocaleMode}
            onSpeechLocaleModeChange={(mode) => setWorkspaceSettings((prev) => ({ ...prev, visionarySpeechLocaleMode: mode }))}
            compact={true}
            hasPptxItems={hasPptxImportedItems}
            workspaceId={workspaceId}
          />
        </div>
      );
    }

    if (presenterLibraryTab === 'media') {
      return (
        <div className="h-full overflow-y-auto custom-scrollbar p-3">
          <input
            ref={presenterMediaUploadInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={insertMediaFileAsItem}
          />
          <div className="grid gap-2.5 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Backgrounds</div>
              <div className="mt-1.5 text-sm font-semibold text-white">Apply library media</div>
              <p className="mt-1.5 text-[10px] leading-4 text-zinc-500">Use the media library on the selected preview item.</p>
              <button
                onClick={() => {
                  setMotionLibraryMode('selected-item');
                  setIsMotionLibOpen(true);
                }}
                disabled={!selectedItem}
                className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Open Library
              </button>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">New Slide</div>
              <div className="mt-1.5 text-sm font-semibold text-white">Insert still or video</div>
              <p className="mt-1.5 text-[10px] leading-4 text-zinc-500">Create a media slide from a local file, saved asset, or YouTube URL.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => presenterMediaUploadInputRef.current?.click()}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-200 hover:border-zinc-500"
                >
                  Upload
                </button>
                <button
                  onClick={() => {
                    setMotionLibraryMode('new-item');
                    setIsMotionLibOpen(true);
                  }}
                  className="rounded-lg border border-cyan-800/50 bg-cyan-950/30 px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-200 hover:bg-cyan-950/50"
                >
                  Library Asset
                </button>
              </div>
              <div className="mt-3 flex gap-1.5">
                <input
                  type="url"
                  value={videoUrlDraft}
                  onChange={(e) => setVideoUrlDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') insertVideoUrlAsItem(); }}
                  placeholder="Paste YouTube or video URL…"
                  className="flex-1 min-w-0 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
                <button
                  onClick={() => insertVideoUrlAsItem()}
                  disabled={!videoUrlDraft.trim()}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Selected Item</div>
              <div className="mt-1.5 text-sm font-semibold text-white">{selectedItem?.title || 'Nothing selected'}</div>
              <p className="mt-1.5 text-[10px] leading-4 text-zinc-500">
                {selectedItem
                  ? 'Ready for background updates from the media library.'
                  : 'Select an item first to target background updates.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-3">
        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Archive</div>
              <div className="mt-1.5 text-sm font-semibold text-white">Save current schedule</div>
            </div>
            <input
              value={runSheetArchiveTitle}
              onChange={(e) => setRunSheetArchiveTitle(e.target.value)}
              placeholder="Archive title"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-[13px] text-zinc-200"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void handleArchiveRunSheet(false)} className="px-3 py-2 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-200 hover:border-zinc-500">Archive</button>
              <button onClick={() => void handleArchiveRunSheet(true)} className="px-3 py-2 text-[9px] font-bold border border-blue-700/50 rounded bg-blue-900/30 text-blue-200 hover:border-blue-500">Archive + New</button>
            </div>
            <div className="border-t border-zinc-800 pt-3">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Import</div>
              <div className="mt-2.5 grid gap-2">
                <button onClick={() => setIsLyricsImportOpen(true)} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-left text-[10px] font-bold text-zinc-200 hover:border-zinc-500">Lyrics / PPTX Studio</button>
                <label className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200 hover:border-zinc-500 cursor-pointer">
                  Visual PPTX / PDF
                  <input type="file" accept=".pptx,.ppt,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointVisualAsItem} disabled={isImportingDeck} />
                </label>
                <label className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200 hover:border-zinc-500 cursor-pointer">
                  Import PPTX Text
                  <input type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="hidden" onChange={importPowerPointTextAsItem} disabled={isImportingDeck} />
                </label>
                <label className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200 hover:border-zinc-500 cursor-pointer">
                  EasyWorship (.ewsx)
                  <input type="file" accept=".ewsx,.ewp" className="hidden" onChange={importEasyWorshipAsItem} disabled={isImportingDeck} />
                </label>
                <label className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200 hover:border-zinc-500 cursor-pointer">
                  ProPresenter (.pro6/.pro)
                  <input type="file" accept=".pro6,.pro6x,.pro" className="hidden" onChange={importProPresenterAsItem} disabled={isImportingDeck} />
                </label>
                <label className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-[10px] font-bold text-zinc-200 hover:border-zinc-500 cursor-pointer">
                  OpenSong (.ofs/.xml)
                  <input type="file" accept=".ofs,.xml,.opensong" className="hidden" onChange={importOpenSongAsItem} disabled={isImportingDeck} />
                </label>
              </div>
            </div>
            {runSheetFilesError && (
              <div className="text-[10px] text-rose-400 border border-rose-900/60 bg-rose-950/30 rounded px-2 py-1.5">
                {runSheetFilesError}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 min-h-0">
            <div className="mb-2.5 flex items-center gap-2">
              <div className="text-[9px] font-black uppercase tracking-[0.18em] text-zinc-500">Archives</div>
              {runSheetFilesLoading && <span className="text-[10px] text-zinc-600">Loading...</span>}
            </div>
            <div className="mb-2.5 flex items-center gap-2">
              <input
                value={runSheetFileQuery}
                onChange={(e) => setRunSheetFileQuery(e.target.value)}
                placeholder="Search archives..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-[13px] text-zinc-200"
              />
              <button onClick={refreshRunSheetFiles} className="px-3 py-2 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Refresh</button>
            </div>
            <div className="space-y-2 max-h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar pr-1">
              {filteredRunSheetFiles.length === 0 && !runSheetFilesLoading && (
                <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  No archived run sheets
                </div>
              )}
              {filteredRunSheetFiles.map((file) => (
                <div key={file.fileId} className="border border-zinc-800 rounded-xl p-2.5 bg-zinc-900/50">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-bold text-zinc-200">{file.title}</div>
                    <div className="mt-1 text-[10px] text-zinc-500">{new Date(file.updatedAt).toLocaleString()} • {(file.payload?.items || []).length} items</div>
                  </div>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button onClick={() => void handleReuseRunSheet(file.fileId, 'replace')} className="px-2 py-1.5 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-200">Reuse</button>
                    <button onClick={() => void handleReuseRunSheet(file.fileId, 'duplicate')} className="px-2 py-1.5 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Duplicate</button>
                    <button onClick={() => void handleRenameRunSheet(file.fileId)} className="px-2 py-1.5 text-[9px] font-bold border border-zinc-700 rounded bg-zinc-900 text-zinc-300">Rename</button>
                    <button onClick={() => void handleDeleteRunSheet(file.fileId)} className="px-2 py-1.5 text-[9px] font-bold border border-rose-900/70 rounded bg-rose-950/20 text-rose-300">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPresenterBetaSchedulePane = () => (
    <SchedulePane
      title="Run Sheet"
      subtitle={`${schedule.length} item${schedule.length === 1 ? '' : 's'} ready`}
      badge={<span className="rounded-full border border-cyan-800/50 bg-cyan-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Beta</span>}
      actions={
        <div className="flex items-center gap-1">
          <button onClick={() => setIsTemplateOpen(true)} className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-sm text-[9px] font-bold transition-all">TPL</button>
          <button onClick={() => setIsLyricsImportOpen(true)} className="px-2 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 rounded-sm text-[9px] font-bold transition-all">LYR</button>
          <button onClick={addEmptyItem} className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-sm transition-colors"><PlusIcon className="w-3.5 h-3.5" /></button>
        </div>
      }
    >
      <div
        className="h-full overflow-y-auto bg-zinc-950 p-1.5 space-y-1.5 custom-scrollbar"
        data-testid="presenter-beta-schedule"
        onClick={() => setPresenterFocusArea('schedule')}
      >
        {schedule.map((item, idx) => {
          const live = activeItemId === item.id;
          const selected = selectedItemId === item.id;
          const slideCount = item.slides.length;
          const previewSelected = presenterPreviewItem?.id === item.id;
          return (
            <button
              key={item.id}
              onClick={() => selectPresenterPreviewItem(item.id)}
              onDoubleClick={() => goLive(item, 0)}
              onContextMenu={(event) => showPresenterContextMenu(event, {
                type: 'schedule',
                x: event.clientX,
                y: event.clientY,
                itemId: item.id,
              })}
              className={`w-full rounded-xl border px-2.5 py-2.5 text-left transition-all ${
                live
                  ? 'border-red-600/70 bg-red-950/20 shadow-[0_12px_24px_rgba(120,0,0,0.18)]'
                  : selected
                    ? 'border-blue-600/60 bg-blue-950/15'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/65'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`truncate text-[13px] font-bold ${live ? 'text-red-300' : 'text-zinc-100'}`}>{item.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] uppercase tracking-[0.14em] text-zinc-500">
                    <span>{item.type}</span>
                    <span>{slideCount} slide{slideCount === 1 ? '' : 's'}</span>
                    {previewSelected && <span className="text-cyan-300">Selected</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {live && <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />}
                  <span className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600">{idx + 1}</span>
                </div>
              </div>
              <div className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-zinc-500">
                {(item.slides[0]?.content || item.slides[0]?.label || 'Ready to present').slice(0, 72)}
              </div>
            </button>
          );
        })}
      </div>
    </SchedulePane>
  );

  const renderPresenterBetaPreviewPane = () => (
    <PreviewPane
      title={presenterPreviewItem?.title || 'Preview Ready'}
      subtitle={
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span>{presenterPreviewItem?.type || 'No item selected'}</span>
          {presenterPreviewSlides.length > 0 && (
            <span>{presenterPreviewSlideIndex + 1}/{presenterPreviewSlides.length} slides</span>
          )}
          {holdScreenMode !== 'none' && (
            <span className="rounded-full border border-amber-700/40 bg-amber-950/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-amber-200">
              {holdScreenMode}
            </span>
          )}
        </div>
      }
      actions={
        <button
          onClick={goLiveSelectedPreview}
          disabled={!presenterPreviewItem || presenterPreviewSlideIndex < 0}
          className="rounded-lg border border-blue-500 bg-blue-600 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Go Live
        </button>
      }
      stage={
        <div className="h-full min-h-0 flex flex-col bg-black">
          <div className="min-h-0 flex-1 p-3">
            <div
              className="h-full rounded-xl border border-zinc-800 bg-black shadow-2xl overflow-hidden"
              onClick={() => setPresenterFocusArea('filmstrip')}
            >
              {renderPresenterHoldState() || (
                presenterPreviewItem && presenterPreviewSlide
                  ? (
                    <SlideRenderer
                      slide={presenterPreviewSlide}
                      item={presenterPreviewItem}
                      fitContainer={true}
                      isPlaying={isPlaying}
                      seekCommand={seekCommand}
                      seekAmount={seekAmount}
                      seekTarget={seekTarget}
                      videoSyncEpoch={videoSyncEpoch}
                      isMuted={isPreviewMuted}
                      lowerThirds={previewLowerThirds}
                      audienceOverlay={audienceDisplay}
                      branding={{ enabled: workspaceSettings.slideBrandingEnabled, churchName: workspaceSettings.churchName, seriesLabel: workspaceSettings.slideBrandingSeriesLabel, style: workspaceSettings.slideBrandingStyle, textOpacity: workspaceSettings.slideBrandingOpacity }}
                    />
                  )
                  : (
                    <div className="h-full w-full bg-black flex items-center justify-center text-zinc-600 text-xs font-mono uppercase tracking-[0.25em]">
                      SELECT ITEM FOR PREVIEW
                    </div>
                  )
              )}
            </div>
          </div>
        </div>
      }
      footer={
        <div className="bg-[#0a0a0e]">
          <div className="grid gap-2 p-2.5 md:grid-cols-3">
            <PresenterOpsBar title="Transport" badge="Live Flow">
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={prevSlide} className="h-8 w-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center border border-zinc-700 active:scale-95 transition-all">
                  <ArrowLeftIcon className="w-4 h-4" />
                </button>
                <button onClick={goLiveSelectedPreview} className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black text-[9px] tracking-[0.16em] active:scale-95 transition-all shadow-[0_2px_8px_rgba(37,99,235,0.35)] uppercase gap-1.5">
                  Send
                </button>
                <button onClick={nextSlide} className="h-8 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center border border-zinc-700 active:scale-95 transition-all gap-1.5">
                  NEXT <ArrowRightIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </PresenterOpsBar>
            <PresenterOpsBar title="Hold" badge="Safe">
              <div className="flex flex-wrap items-center gap-1.5">
                <button onClick={resumeProgramOutput} className="h-8 px-3 rounded-lg border border-emerald-700/50 bg-emerald-950/30 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-900/40">
                  Live
                </button>
                <button onClick={() => setBlackout((prev) => !prev)} className={`h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-[0.16em] ${blackout ? 'border-red-500 bg-red-600 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
                  Black
                </button>
                <button onClick={clearHold} className={`h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-[0.16em] ${holdScreenMode === 'clear' ? 'border-amber-500 bg-amber-700/40 text-amber-50' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
                  Clear
                </button>
                <button onClick={logoHold} className={`h-8 px-3 rounded-lg border text-[8px] font-black uppercase tracking-[0.16em] ${holdScreenMode === 'logo' ? 'border-cyan-500 bg-cyan-950/45 text-cyan-100' : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500'}`}>
                  Logo
                </button>
              </div>
            </PresenterOpsBar>
            <PresenterOpsBar title="Output" badge="Route">
              <div className="flex flex-wrap items-center gap-1.5">
                <label className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 cursor-pointer hover:border-zinc-700 transition-colors">
                  <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-black shrink-0">Route</span>
                  <select value={routingMode} onChange={(e) => setRoutingMode(e.target.value as any)} style={{ colorScheme: 'dark' }} className="bg-zinc-900 text-zinc-200 text-[9px] font-bold outline-none cursor-pointer">
                    <option value="PROJECTOR">Projector</option>
                    <option value="STREAM">Stream</option>
                    <option value="LOBBY">Lobby</option>
                  </select>
                </label>
                <button
                  onClick={() => setLowerThirdsEnabled((prev) => !prev)}
                  className={`h-8 px-3 rounded-lg font-black text-[8px] tracking-[0.16em] border transition-all uppercase ${lowerThirdsEnabled ? 'bg-blue-950/60 text-blue-300 border-blue-700/50' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}`}
                >
                  Lower 3rds
                </button>
                <button onClick={() => void copyShareUrl(obsOutputUrl)} className="h-8 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-[8px] font-black text-zinc-400 hover:text-white hover:border-zinc-500 transition-all uppercase tracking-[0.16em]">OBS URL</button>
                <button onClick={() => void copyShareUrl(stageDisplayUrl)} className="h-8 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-[8px] font-black text-zinc-400 hover:text-white hover:border-zinc-500 transition-all uppercase tracking-[0.16em]">Stage URL</button>
              </div>
            </PresenterOpsBar>
          </div>
          <div className="border-t border-zinc-900 px-2.5 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Preview Filmstrip</div>
              <div className="text-[9px] text-zinc-600">Enter sends live</div>
            </div>
            <div
              className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar"
              onClick={() => setPresenterFocusArea('filmstrip')}
              data-testid="presenter-beta-filmstrip"
            >
              {presenterPreviewSlides.map((slide, idx) => {
                const selected = idx === presenterPreviewSlideIndex;
                const live = presenterPreviewItem?.id === activeItemId && idx === activeSlideIndex;
                return (
                  <button
                    key={slide.id}
                    onClick={() => presenterPreviewItem && selectPresenterPreviewSlide(presenterPreviewItem.id, idx)}
                    onDoubleClick={() => presenterPreviewItem && goLive(presenterPreviewItem, idx)}
                    onContextMenu={(event) => presenterPreviewItem && showPresenterContextMenu(event, {
                      type: 'preview-slide',
                      x: event.clientX,
                      y: event.clientY,
                      itemId: presenterPreviewItem.id,
                      slideIndex: idx,
                    })}
                    className={`shrink-0 w-44 rounded-xl overflow-hidden border text-left transition-all ${
                      live
                        ? 'border-red-500 bg-red-950/15'
                        : selected
                          ? 'border-cyan-500 bg-cyan-950/20'
                          : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="relative aspect-video bg-black">
                      <div className="absolute inset-0 pointer-events-none">
                        <SlideRenderer slide={slide} item={presenterPreviewItem} fitContainer={true} isThumbnail={true} />
                      </div>
                    </div>
                    <div className="border-t border-zinc-800 px-2 py-1.5">
                      <div className="truncate text-[10px] font-mono text-zinc-100">{idx + 1}. {slide.label || `Slide ${idx + 1}`}</div>
                      <div className="mt-1 truncate text-[10px] text-zinc-500">{slide.content || presenterPreviewItem?.title}</div>
                    </div>
                  </button>
                );
              })}
              {presenterPreviewSlides.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-6 text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  Selected item has no slides
                </div>
              )}
            </div>
          </div>
        </div>
      }
    />
  );

  const renderPresenterBetaLivePane = () => (
    <LivePane
      title="Live Pane"
      subtitle={activeItem ? `${activeItem.title} is active` : 'No item currently live'}
      badge={activeItem ? <span className="rounded-full border border-red-900/50 bg-red-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-red-300">Live</span> : null}
    >
      <div
        className="h-full overflow-y-auto px-2.5 py-2.5 custom-scrollbar"
        onClick={() => setPresenterFocusArea('live')}
        data-testid="presenter-beta-live-pane"
      >
        <div className="space-y-3">
          <div className="sticky top-0 z-10 -mx-2.5 border-b border-zinc-900 bg-zinc-950/95 px-2.5 pb-3 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
            <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Live Now</div>
            {activeItem && activeSlide ? (
              <button
                onClick={() => jumpToLiveSlide(activeItem.id, activeSlideIndex)}
                className="w-full text-left rounded-xl overflow-hidden border border-red-500 bg-zinc-900 shadow-[0_12px_24px_rgba(120,0,0,0.12)]"
              >
                <div className="relative aspect-video">
                  <div className="absolute inset-0 pointer-events-none">
                    <SlideRenderer slide={activeSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
                  </div>
                </div>
                <div className="border-t border-zinc-800 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[10px] font-mono text-zinc-100">{activeSlideIndex + 1}. {activeSlide.label || `Slide ${activeSlideIndex + 1}`}</div>
                    <span className="text-[9px] uppercase tracking-[0.18em] text-red-300 font-black">Live</span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-zinc-500">{activeSlide.content || activeItem.title}</div>
                </div>
              </button>
            ) : (
              <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                No active item
              </div>
            )}
          </div>

          {enabledTimerCues.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
              <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Rundown Cues</div>
              <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {enabledTimerCues.map((cue, idx) => (
                  <button
                    key={cue.itemId}
                    onClick={() => activateCueByItemId(cue.itemId, { autoStart: false, goLiveItem: true })}
                    className={`shrink-0 px-2 py-1 rounded border text-[8px] font-bold ${cue.itemId === currentCueItemId ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'}`}
                  >
                    {idx + 1}. {cue.itemTitle}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeItem && activeSlide && (
            <div className="space-y-2">
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Active Script</div>
              <div className="space-y-2">
                {activeItem.slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    onClick={() => jumpToLiveSlide(activeItem.id, idx)}
                    onContextMenu={(event) => showPresenterContextMenu(event, {
                      type: 'live-slide',
                      x: event.clientX,
                      y: event.clientY,
                      itemId: activeItem.id,
                      slideIndex: idx,
                    })}
                    className={`w-full rounded-xl border px-2.5 py-2 text-left transition-all ${
                      activeSlideIndex === idx
                        ? 'border-red-500 bg-red-950/15'
                        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[10px] font-mono text-zinc-100">{idx + 1}. {slide.label || `Slide ${idx + 1}`}</div>
                      {activeSlideIndex === idx && <span className="text-[8px] uppercase tracking-[0.16em] text-red-300 font-black">Live</span>}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-zinc-500">{slide.content || activeItem.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Queue</div>
            <div className="space-y-2">
              {presenterUpcomingItems.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  onClick={() => selectPresenterPreviewItem(item.id)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/30 px-2.5 py-2 text-left transition-all hover:border-zinc-700"
                >
                  <div className="truncate text-[11px] font-bold text-zinc-200">{item.title}</div>
                  <div className="mt-1 truncate text-[10px] text-zinc-500">{item.slides[0]?.content || item.type}</div>
                </button>
              ))}
              {presenterUpcomingItems.length === 0 && (
                <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-5 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  Queue clear after current item
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </LivePane>
  );

  const presenterBetaWorkspace = isPresenterBeta ? (
    <PresenterShell
      variant="beta"
      leftPane={renderPresenterBetaSchedulePane()}
      centerPane={renderPresenterBetaPreviewPane()}
      rightPane={renderPresenterBetaLivePane()}
      bottomPane={
        <LibraryTray
          tabs={presenterLibraryTabs}
          activeTab={presenterLibraryTab}
          onTabChange={setPresenterLibraryTab}
          headerActions={<div className="text-[9px] text-zinc-600">Search + add in presenter</div>}
        >
          <div className="h-full min-h-0">
            {renderPresenterBetaLibraryContent()}
          </div>
        </LibraryTray>
      }
      leftWidth={presenterLayoutPrefs.leftPaneWidth}
      rightWidth={presenterLayoutPrefs.rightPaneWidth}
      bottomHeight={presenterLayoutPrefs.bottomTrayHeight}
      onResizeLeft={(delta) => updatePresenterLayoutPref('leftPaneWidth', delta)}
      onResizeRight={(delta) => updatePresenterLayoutPref('rightPaneWidth', delta)}
      onResizeBottom={(delta) => updatePresenterLayoutPref('bottomTrayHeight', delta)}
      hideRightPane={legacyMachineMode}
    />
  ) : null;

  return (
    <div className={`theme-${workspaceSettings.theme} flex flex-col h-screen supports-[height:100dvh]:h-[100dvh] bg-zinc-950 text-zinc-200 font-sans selection:bg-blue-900 selection:text-white relative overflow-x-hidden`}>
      <audio ref={antiSleepAudioRef} src={SILENT_AUDIO_B64} loop muted />
      {saveError && <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-white px-4 py-2 rounded-sm shadow-xl z-50 flex items-center gap-3 text-xs font-bold animate-pulse"><span>⚠ STORAGE FULL: Changes are NOT saving.</span><button onClick={() => setSaveError(false)} className="hover:text-zinc-300">✕</button></div>}
      
      {showSyncGuidance && syncIssueDisplay && (
        <div className="fixed top-14 left-0 right-0 z-40 flex items-center gap-3 px-4 py-2 bg-amber-950/95 border-b border-amber-700/50 backdrop-blur-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="text-[11px] font-semibold text-amber-200 shrink-0">{syncIssueDisplay.title}</span>
          {syncIssueDisplay.detail && (
            <span className="text-[10px] text-amber-300/65 truncate hidden sm:block">{syncIssueDisplay.detail}</span>
          )}
          <button
            onClick={dismissSyncGuidance}
            className="ml-auto shrink-0 text-amber-500 hover:text-amber-200 transition-colors p-1 rounded hover:bg-amber-900/40"
            aria-label="Dismiss sync guidance"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {popupBlocked && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-red-500 p-6 max-w-md rounded-lg shadow-2xl text-center">
            <div className="text-red-500 mb-2"><MonitorIcon className="w-12 h-12 mx-auto" /></div>
            <h2 className="text-xl font-bold text-white mb-2">Projection Blocked</h2>
            <p className="text-zinc-400 text-sm mb-4">The browser blocked the projector window. Check address bar pop-up settings.</p>
            <button onClick={() => { setPopupBlocked(false); setIsOutputLive(false); }} className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold transition-colors">I Understand</button>
          </div>
        </div>
      )}

      {splitPanelPptxConflict && !splitPanelConflictDismissed && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[90] flex items-start gap-3 px-4 py-3 bg-amber-950/95 border border-amber-700/70 rounded-b-lg shadow-2xl shadow-amber-900/30 backdrop-blur-md max-w-xl w-full mx-auto" style={{ minWidth: 320 }}>
          <span className="text-amber-400 text-base font-black shrink-0 mt-0.5">!</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-200 leading-snug">Split-panel Bible style + PowerPoint slides detected</p>
            <p className="text-[10px] text-amber-300/70 mt-0.5 leading-snug">This combination may cause display instability. Switch the Bible style to Classic, or remove the imported PowerPoint item from your schedule.</p>
          </div>
          <button
            onClick={() => setSplitPanelConflictDismissed(true)}
            className="shrink-0 text-amber-500 hover:text-amber-200 transition-colors text-xs font-bold px-1.5 py-0.5 rounded hover:bg-amber-900/40"
            title="Dismiss"
          >✕</button>
        </div>
      )}

      <AppHeader
        isElectronShell={isElectronShell}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onHomeClick={() => setViewState(isElectronShell ? 'studio' : 'landing')}
        isPresenterBeta={isPresenterBeta}
        liveSessionId={liveSessionId}
        syncPendingCount={syncPendingCount}
        syncIssue={syncIssue}
        onOpenSyncGuidance={() => { if (syncIssue) setDismissedSyncGuidance({}); }}
        activeTargetConnectionCount={activeTargetConnectionCount}
        targetConnectionRoleCount={targetConnectionRoles.length}
        connectionCountsByRole={connectionCountsByRole}
        isOutputLive={isOutputLive}
        onToggleOutput={handleToggleOutput}
        isStageDisplayLive={isStageDisplayLive}
        onToggleStageDisplay={handleToggleStageDisplay}
        blackout={blackout}
        onToggleBlackout={() => setBlackout(prev => !prev)}
        isRightDockOpen={isRightDockOpen}
        onToggleRightDock={() => setIsRightDockOpen(prev => !prev)}
        remoteControlUrl={remoteControlUrl}
        stageDisplayUrl={stageDisplayUrl}
        onCopyUrl={(url, msg) => void copyShareUrl(url, msg)}
        desktopUpdateStatus={desktopUpdateStatus}
        showDesktopUpdateBanner={showDesktopUpdateBanner}
        onUpdateCheckNow={handleDesktopUpdateCheckNow}
        onUpdateInstallNow={handleDesktopUpdateInstallNow}
        onUpdateOpenReleases={handleDesktopUpdateOpenReleases}
        onUpdateDismiss={() => setDismissedUpdateKey(currentUpdateKey)}
        onOpenSettings={() => setIsProfileOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* MOBILE NAV BAR (Visible only on small screens) */}
      {!isElectronShell && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around p-3 z-50">
          <button onClick={() => setViewMode('BUILDER')} className={`flex flex-col items-center gap-1 ${viewMode === 'BUILDER' ? 'text-white' : 'text-zinc-500'}`}><EditIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">BUILD</span></button>
          <button onClick={() => setViewMode('PRESENTER')} className={`flex flex-col items-center gap-1 ${viewMode === 'PRESENTER' ? 'text-white' : 'text-zinc-500'}`}><PlayIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">PRESENT</span></button>
          <button onClick={handleToggleOutput} className={`flex flex-col items-center gap-1 ${isOutputLive ? 'text-emerald-400' : 'text-zinc-500'}`}><MonitorIcon className="w-5 h-5" /> <span className="text-[10px] font-bold">OUTPUT</span></button>
        </div>
      )}

      <div
        ref={studioShellRef}
        className={`relative flex-1 flex overflow-hidden min-w-0 overflow-x-hidden ${isElectronShell ? '' : 'mb-16 md:mb-0'}`}
        data-testid="studio-shell"
        onScroll={(e) => {
          if (e.currentTarget.scrollLeft !== 0) {
            e.currentTarget.scrollLeft = 0;
          }
        }}
      >
        {isPresenterBeta ? (
          presenterBetaWorkspace
        ) : (
          <>
        {presenterSidebarDrawerVisible && (
          <button
            type="button"
            aria-label="Close studio sidebar drawer"
            data-testid="studio-sidebar-drawer-backdrop"
            className="absolute inset-0 z-10 bg-black/35"
            onClick={() => {
              if (!sidebarPinned) {
                setPresenterSidebarDrawerOpen(false);
              }
            }}
          />
        )}
        <div className={`relative flex shrink-0 h-full border-r border-zinc-900 z-20 ${presenterSidebarCompact ? 'w-12 min-w-[48px]' : 'min-w-0'}`}>
          {/* Sidebar with Tabs (Hidden on Mobile unless Builder Mode) */}
          <div
            className={`group flex flex-col h-full bg-zinc-900/50 border-r border-zinc-800 shrink-0 overflow-hidden z-20 ${sidebarRailWidthClass}`}
            style={{ width: sidebarRailWidth }}
            data-testid="studio-sidebar-rail"
            onMouseEnter={() => {
              if (!presenterSidebarCompact) setIsSidebarHovering(true);
            }}
            onMouseLeave={() => {
              if (!presenterSidebarCompact) setIsSidebarHovering(false);
            }}
          >
            <div className="flex items-center justify-between p-1 border-b border-zinc-800/80">
              <span className={`px-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-600 ${sidebarLabelClass}`}>Studio</span>
              <button
                onClick={handleSidebarPinToggle}
                className={`h-9 w-9 shrink-0 rounded-sm border transition-colors flex items-center justify-center ${sidebarPinned ? 'border-blue-700 bg-blue-950/40 text-blue-300' : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'}`}
                title={sidebarPinned ? 'Unpin navigation' : 'Pin navigation open'}
                aria-label={sidebarPinned ? 'Unpin navigation' : 'Pin navigation open'}
                data-testid="studio-sidebar-pin"
              >
                <PinIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col flex-1 p-1 gap-1">
              <button onClick={() => handleSidebarTabSelect('SCHEDULE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'SCHEDULE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="SCHEDULE"><MonitorIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Schedule</span></button>
              <button onClick={() => handleSidebarTabSelect('HYMNS')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'HYMNS' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="HYMN LIBRARY"><MusicIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Hymns</span></button>
              <button onClick={() => handleSidebarTabSelect('FILES')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'FILES' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="RUN SHEET FILES"><CopyIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Files</span></button>
              <button onClick={() => handleSidebarTabSelect('AUDIO')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'AUDIO' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="AUDIO MIXER"><Volume2Icon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Audio Mixer</span></button>
              <button onClick={() => handleSidebarTabSelect('BIBLE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'BIBLE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="BIBLE LIBRARY"><BibleIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Bible Hub</span></button>
              <button onClick={() => handleSidebarTabSelect('AUDIENCE')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'AUDIENCE' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="AUDIENCE STUDIO"><ChatIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Audience</span></button>
              <button onClick={() => handleSidebarTabSelect('MACROS')} className={`p-2.5 rounded-sm flex items-center gap-3 transition-colors ${activeSidebarTab === 'MACROS' ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`} title="MACROS"><SparklesIcon className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Macros</span></button>
            </div>
            <div className="p-1 border-t border-zinc-800">
              <button onClick={() => setIsProfileOpen(true)} className="w-full p-2.5 rounded-sm flex items-center gap-3 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors" title="SETTINGS"><Settings className="w-5 h-5 shrink-0" /><span className={`text-xs font-bold tracking-tight uppercase ${sidebarLabelClass}`}>Settings</span></button>
            </div>
          </div>

          {/* SIDEBAR PANEL */}
          <div
            data-testid="studio-sidebar-panel"
            className={`flex flex-col bg-zinc-950 shrink-0 min-w-0 border-r border-zinc-900 transition-[transform,opacity] duration-200 ease-out ${presenterSidebarCompact ? 'absolute top-0 bottom-0 shadow-[0_28px_60px_rgba(0,0,0,0.45)]' : ''}`}
            aria-hidden={presenterSidebarCompact && !presenterSidebarDrawerVisible ? true : undefined}
            style={{
              width: sidebarPanelWidth,
              ...(presenterSidebarCompact
                ? {
                    left: sidebarRailWidth,
                    zIndex: 30,
                    transform: presenterSidebarDrawerVisible ? 'translateX(0)' : 'translateX(calc(-100% - 0.75rem))',
                    opacity: presenterSidebarDrawerVisible ? 1 : 0,
                    visibility: presenterSidebarDrawerVisible ? 'visible' : 'hidden',
                    pointerEvents: presenterSidebarDrawerVisible ? 'auto' : 'none',
                  }
                : {}),
            }}
          >
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
              {renderScheduleList()}
            </>
          )}
          {activeSidebarTab === 'FILES' && (
            <div className="flex-1 overflow-hidden flex flex-col">
              <FilesPanel
                runSheetFiles={filteredRunSheetFiles}
                runSheetFilesLoading={runSheetFilesLoading}
                runSheetFilesError={runSheetFilesError}
                runSheetFileQuery={runSheetFileQuery}
                onRunSheetFileQueryChange={setRunSheetFileQuery}
                onRefreshFiles={refreshRunSheetFiles}
                onReuseRunSheet={handleReuseRunSheet}
                onRenameRunSheet={handleRenameRunSheet}
                onDeleteRunSheet={handleDeleteRunSheet}
                runSheetArchiveTitle={runSheetArchiveTitle}
                onRunSheetArchiveTitleChange={setRunSheetArchiveTitle}
                onArchiveRunSheet={handleArchiveRunSheet}
                archivedSermons={archivedSermons}
                archivedSermonsLoading={archivedSermonsLoading}
                onRefreshSermons={handleRefreshSermons}
                onCopySermon={handleCopySermon}
                onProjectSermon={(item) => handleSermonProjectToScreen(item.summary)}
                onInsertSermon={(item) => handleSermonInsertToRunsheet(item.summary)}
                onDeleteSermon={async (id) => {
                  await deleteArchivedSermon(id, workspaceId);
                  setArchivedSermons((prev) => prev.filter((s) => s.id !== id));
                }}
                isImportingDeck={isImportingDeck}
                importDeckStatus={importDeckStatus}
                importModalError={importModalError}
                onImportProPresenter={importProPresenterAsItem}
                onImportEasyWorship={importEasyWorshipAsItem}
                onImportOpenSong={importOpenSongAsItem}
                onImportOpenLyrics={importOpenLyricsAsItem}
                onOpenLyricsImport={() => setIsLyricsImportOpen(true)}
                onAddVideoUrl={(url) => insertVideoUrlAsItem(url)}
              />
            </div>
          )}
          {activeSidebarTab === 'HYMNS' && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <HymnLibrary
                schedule={schedule}
                selectedItemId={selectedItemId}
                onApplyInsertion={handleApplyHymnInsertion}
              />
            </div>
          )}
          {activeSidebarTab === 'AUDIO' && <AudioLibrary currentTrackId={currentTrack?.id ?? null} isPlaying={isAudioPlaying} progress={audioProgress} onPlay={handlePlayTrack} onToggle={() => setIsAudioPlaying(!isAudioPlaying)} onStop={stopAudio} onVolumeChange={setAudioVolume} volume={audioVolume} />}
          {activeSidebarTab === 'BIBLE' && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="p-3 border-b border-zinc-900 shrink-0"><h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Bible Hub</h3></div>
              <div className="flex-1 min-h-0 overflow-hidden p-3">
                <BibleBrowser
                  onProjectRequest={(item) => {
                    stageGeneratedItem({
                      ...item,
                      metadata: {
                        ...item.metadata,
                        source: item.metadata?.source || 'bible',
                      },
                    }, 'system', { goLive: true });
                  }}
                  onAddRequest={(item) => {
                    stageGeneratedItem({
                      ...item,
                      metadata: {
                        ...item.metadata,
                        source: item.metadata?.source || 'bible',
                      },
                    }, 'system', { select: false });
                  }}
                  onLiveStyleUpdate={handleBibleLiveUpdate}
                  speechLocaleMode={workspaceSettings.visionarySpeechLocaleMode}
                  onSpeechLocaleModeChange={(mode) => setWorkspaceSettings((prev) => ({ ...prev, visionarySpeechLocaleMode: mode }))}
                  compact={true}
                  hasPptxItems={hasPptxImportedItems}
                  workspaceId={workspaceId}
                />
              </div>
            </div>
          )}
          {activeSidebarTab === 'MACROS' && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="p-3 border-b border-zinc-900 shrink-0 flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">⚡ Macros</h3>
              </div>
              <div className="flex-1 flex items-center justify-center p-6 text-center">
                <div className="text-zinc-600 text-xs font-semibold leading-relaxed">
                  Macro panel coming soon.<br />Trigger sequences, cues, and automations here.
                </div>
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
          {activeSidebarTab === 'MACROS' && (
            <MacroPanel
              macros={macros}
              schedule={schedule}
              workspaceId={workspaceId}
              executionContext={macroCtx}
              auditLog={macroAuditLog}
              onMacrosChange={setMacros}
              onAppendAudit={appendMacroAudit}
            />
          )}
        </div>
      </div>

      {viewMode === 'BUILDER' ? (
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 overflow-hidden">
        {selectedItem ? (
          <>
            <ItemEditorPanel
              item={selectedItem}
              onUpdate={updateItem}
              onApplyQuickBackground={applyQuickBackgroundToItem}
              onOpenLibrary={() => setIsMotionLibOpen(true)}
              speakerPresets={workspaceSettings.speakerTimerPresets}
            />
            <BuilderPreviewPanel
              item={selectedItem}
              onUpdate={updateItem}
              onOpenSlideEditor={(slide) => handleEditSlide(slide)}
              onDeleteSlide={handleDeleteSlide}
              onAddSlide={() => { setEditingSlide(null); setIsSlideEditorOpen(true); }}
              onStartLabelRename={startSlideLabelRename}
              inlineSlideRename={inlineSlideRename}
              inlineSlideRenameInputRef={inlineSlideRenameInputRef}
              onInlineRenameChange={(value) => inlineSlideRename && setInlineSlideRename({ ...inlineSlideRename, value })}
              onInlineRenameCommit={handleRenameSlideLabel}
              onGoLive={(liveItem, slideIdx) => goLive(liveItem, slideIdx)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-800 font-black text-xl uppercase tracking-[0.5em] opacity-20 pointer-events-none">Select item to edit</div>
        )}
      </div>
    ) : viewMode === 'STAGE' ? (
      <StageWorkspace
        activeItem={activeItem}
        activeSlide={activeSlide}
        activeSlideIndex={activeSlideIndex}
        nextSlide={nextSlidePreview}
        nextItem={schedule[schedule.findIndex(i => i.id === activeItem?.id) + 1] || null}
        schedule={schedule}
        workspaceId={workspaceId}
        isOutputLive={isOutputLive}
        isStageDisplayLive={isStageDisplayLive}
        blackout={blackout}
        onGoLive={(item, idx) => goLive(item, idx ?? 0)}
        onPrevSlide={prevSlide}
        onNextSlide={nextSlide}
        onToggleBlackout={() => setBlackout(prev => !prev)}
        isPlaying={isPlaying}
        isActiveVideo={isActiveVideo}
        seekTarget={seekTarget}
        videoSyncEpoch={videoSyncEpoch}
        seekCommand={seekCommand}
        seekAmount={seekAmount}
        outputMuted={outputMuted}
        onTogglePlay={() => setIsPlaying(prev => !prev)}
        onSeekForward={() => triggerSeek(10)}
        onSeekBackward={() => triggerSeek(-10)}
        onToggleMute={() => setOutputMuted(prev => !prev)}
        showSermonRecorder={showSermonRecorder}
        onToggleSermonRecorder={() => setShowSermonRecorder(v => !v)}
      />
    ) : (
            <div className="flex-1 flex flex-col lg:flex-row bg-black min-w-0 overflow-hidden">
            <div className="flex-1 flex flex-col relative min-w-0">
                <div className={`flex-1 relative flex items-center bg-zinc-950 overflow-hidden border-r border-zinc-900 p-3 ${presenterPreviewAlignClass}`}>
                  <div data-testid="presenter-live-preview" className="aspect-video w-full max-w-4xl border border-zinc-800 bg-black relative group shadow-2xl overflow-hidden rounded-sm">
                    {renderPresenterHoldState() || (
                      <SlideRenderer
                        slide={activeSlide}
                        item={activeItem}
                        isPlaying={isPlaying}
                        seekCommand={seekCommand}
                        seekAmount={seekAmount}
                        seekTarget={seekTarget}
                        videoSyncEpoch={videoSyncEpoch}
                        isMuted={isPreviewMuted}
                        lowerThirds={lowerThirdsEnabled}
                        audienceOverlay={audienceDisplay}
                        branding={{ enabled: workspaceSettings.slideBrandingEnabled, churchName: workspaceSettings.churchName, seriesLabel: workspaceSettings.slideBrandingSeriesLabel, style: workspaceSettings.slideBrandingStyle, textOpacity: workspaceSettings.slideBrandingOpacity }}
                      />
                    )}
                    <div className="absolute top-0 left-0 bg-zinc-900 text-zinc-400 text-[9px] font-bold px-2 py-0.5 border-r border-b border-zinc-800 flex items-center gap-2 z-50 shadow-md">
                      PREVIEW
                      <button onClick={() => setIsPreviewMuted(!isPreviewMuted)} className={`ml-1 hover:text-white transition-colors ${isPreviewMuted ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isPreviewMuted ? <VolumeXIcon className="w-3 h-3" /> : <Volume2Icon className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Presenter Ops Deck — 3-card production layout */}
                <div className="border-t border-zinc-900 bg-[#0a0a0e] px-3 py-3 shrink-0">
                  <div className={`grid gap-2.5 max-w-[1400px] mx-auto ${presenterMainWorkspaceWidth < 1060 ? 'grid-cols-1' : 'grid-cols-2'}`}>

                    {/* Card 1: TRANSPORT */}
                    <div className="rounded-xl border border-zinc-800/80 bg-[linear-gradient(160deg,rgba(28,28,34,0.95),rgba(10,10,14,1))] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-black">Transport</span>
                        <span className="rounded-full border border-blue-800/50 bg-blue-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-blue-300">Live Flow</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button onClick={prevSlide} className="h-9 w-10 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center border border-zinc-700 active:scale-95 transition-all">
                          <ArrowLeftIcon className="w-4 h-4" />
                        </button>
                        <button onClick={nextSlide} className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center font-black text-[10px] tracking-widest active:scale-95 transition-all shadow-[0_2px_8px_rgba(37,99,235,0.35)] uppercase gap-1.5">
                          NEXT <ArrowRightIcon className="w-3.5 h-3.5" />
                        </button>
                        {isActiveVideo && (
                          <div className="flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
                            <button onClick={() => triggerSeek(-10)} className="h-7 w-8 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded flex items-center justify-center transition-colors"><RewindIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setIsPlaying(!isPlaying)} className={`h-7 w-8 rounded flex items-center justify-center transition-all ${isPlaying ? 'bg-zinc-800 text-white' : 'bg-emerald-600/20 text-emerald-400'}`}>
                              {isPlaying ? <PauseIcon className="w-3.5 h-3.5" /> : <PlayIcon className="w-3.5 h-3.5 fill-current" />}
                            </button>
                            <button onClick={() => triggerSeek(10)} className="h-7 w-8 hover:text-white text-zinc-500 hover:bg-zinc-800 rounded flex items-center justify-center transition-colors"><ForwardIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                        <button
                          onClick={() => setLowerThirdsEnabled((prev) => !prev)}
                          title="Toggle lower thirds overlay"
                          className={`h-9 px-3 rounded-lg font-black text-[9px] tracking-wider border transition-all uppercase ${lowerThirdsEnabled ? 'bg-blue-950/60 text-blue-300 border-blue-700/50' : 'bg-zinc-900 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}`}
                        >Lower Thirds</button>
                        <label className="flex h-9 items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 cursor-pointer hover:border-zinc-700 transition-colors">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-black shrink-0">Route</span>
                          <select value={routingMode} onChange={(e) => setRoutingMode(e.target.value as any)} style={{ colorScheme: 'dark' }} className="bg-zinc-900 text-zinc-200 text-[10px] font-bold outline-none cursor-pointer">
                            <option value="PROJECTOR">Projector</option>
                            <option value="STREAM">Stream</option>
                            <option value="LOBBY">Lobby</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Card 2: TIMER + CUE */}
                    <div className="rounded-xl border border-zinc-800/80 bg-[linear-gradient(160deg,rgba(28,28,34,0.95),rgba(10,10,14,1))] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-black">Timer + Cue</span>
                        <span className="rounded-full border border-cyan-800/50 bg-cyan-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-300">Cue Engine</span>
                      </div>
                      <div className={`grid gap-1.5 ${presenterMainWorkspaceWidth < 760 ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1fr)]'}`}>
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2 h-9 min-w-0">
                          <select value={timerMode} onChange={(e) => {
                            const mode = e.target.value as 'COUNTDOWN' | 'ELAPSED';
                            setTimerMode(mode);
                            setTimerRunning(false);
                            setCueZeroHold(false);
                            setTimerSeconds(mode === 'COUNTDOWN' ? effectiveTimerDurationSec : 0);
                          }} style={{ colorScheme: 'dark' }} className="bg-zinc-900 text-zinc-200 text-[10px] font-bold outline-none cursor-pointer shrink-0">
                            <option value="COUNTDOWN">Countdown</option>
                            <option value="ELAPSED">Elapsed</option>
                          </select>
                          {timerMode === 'COUNTDOWN' && (
                            <input type="number" min={1} max={180} value={timerDurationMin} onChange={(e) => applyManualCountdownMinutes(Number(e.target.value))} className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200 text-center" />
                          )}
                          <div className={`text-[12px] font-mono font-black tabular-nums shrink-0 ${isTimerOvertime ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>{formatTimer(timerSeconds)}</div>
                          <button onClick={() => { setCueZeroHold(false); setTimerRunning((p) => !p); }} className="text-[9px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200 font-bold transition-colors shrink-0">{timerRunning ? 'Pause' : 'Start'}</button>
                          <button onClick={() => { setTimerRunning(false); setCueZeroHold(false); setTimerSeconds(timerMode === 'COUNTDOWN' ? effectiveTimerDurationSec : 0); }} className="text-[9px] px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-200 font-bold transition-colors shrink-0">Reset</button>
                          <button
                            onClick={() => {
                              const next = !workspaceSettings.timerChimesEnabled;
                              setWorkspaceSettings((prev) => ({ ...prev, timerChimesEnabled: next }));
                              timerChimeService.muted = !next;
                            }}
                            title={workspaceSettings.timerChimesEnabled ? 'Mute timer chimes' : 'Unmute timer chimes'}
                            className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors shrink-0 ${workspaceSettings.timerChimesEnabled ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/40' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'}`}
                          >{workspaceSettings.timerChimesEnabled ? 'Chime' : 'Muted'}</button>
                        </div>
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2 h-9 min-w-0">
                          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-wider shrink-0">Cue</span>
                          <input type="number" min={2} max={120} value={autoCueSeconds}
                            onChange={(e) => { const v = Math.max(2, Math.min(120, Number(e.target.value) || 2)); setAutoCueSeconds(v); setAutoCueRemaining(v); }}
                            className="w-10 bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200 text-center"
                          />
                          <button onClick={() => setAutoCueEnabled((p) => !p)}
                            className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors shrink-0 ${autoCueEnabled ? 'bg-cyan-900/50 text-cyan-200 border border-cyan-700/40' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'}`}
                          >{autoCueEnabled ? `On ${autoCueRemaining}s` : 'Off'}</button>
                        </div>
                        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 h-9 flex flex-col justify-center min-w-0">
                          <div className="text-[8px] uppercase tracking-widest text-zinc-600 font-black">Current Cue</div>
                          <div className="text-[10px] text-zinc-200 truncate font-bold leading-tight">
                            {currentCue ? `${currentCueIndex + 1}/${enabledTimerCues.length} ${currentCue.itemTitle}` : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: RUNDOWN + OUTPUT — always full width */}
                    <div className={`rounded-xl border border-zinc-800/80 bg-[linear-gradient(160deg,rgba(28,28,34,0.95),rgba(10,10,14,1))] p-3 shadow-[0_4px_16px_rgba(0,0,0,0.4)] ${presenterMainWorkspaceWidth < 1060 ? '' : 'col-span-2'}`}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[9px] uppercase tracking-[0.22em] text-zinc-500 font-black">Rundown + Output</span>
                        <span className="rounded-full border border-emerald-800/50 bg-emerald-950/30 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">Stage Ops</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2 h-9">
                          <span className="text-[9px] text-zinc-500 font-black uppercase shrink-0">Preset</span>
                          <select value={selectedSpeakerPresetId} onChange={(e) => setSelectedSpeakerPresetId(e.target.value)} style={{ colorScheme: 'dark' }} className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200 font-bold outline-none cursor-pointer min-w-[90px]">
                            {(workspaceSettings.speakerTimerPresets || []).map((preset) => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                          <button onClick={applySelectedPresetToCurrentCue} disabled={!selectedSpeakerPresetId || !(currentCueItemId || selectedItemId)} className="text-[9px] px-2.5 py-0.5 bg-emerald-700 hover:bg-emerald-600 rounded text-white font-bold transition-colors disabled:opacity-30 uppercase">Apply</button>
                          <button onClick={openSpeakerPresetStudio} aria-label="Manage" data-testid="speaker-preset-studio-open" className="h-6 w-6 flex items-center justify-center rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all"><Settings className="w-3 h-3" /></button>
                        </div>
                        <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2 h-9">
                          <span className="text-[9px] text-zinc-500 font-black uppercase shrink-0 mr-0.5">Rundown</span>
                          <button onClick={() => moveCueByOffset(-1, { autoStart: false, goLiveItem: true })} disabled={!enabledTimerCues.length} className="text-[9px] px-2.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 font-bold transition-colors disabled:opacity-30">Prev</button>
                          <button onClick={() => moveCueByOffset(1, { autoStart: false, goLiveItem: true })} disabled={!enabledTimerCues.length} className="text-[9px] px-2.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 font-bold transition-colors disabled:opacity-30">Next</button>
                          <button onClick={() => currentCue && activateCueByItemId(currentCue.itemId, { autoStart: false, goLiveItem: true })} disabled={!currentCue} className="text-[9px] px-2.5 py-0.5 bg-blue-900/60 hover:bg-blue-800 rounded text-blue-200 font-bold transition-colors disabled:opacity-30 border border-blue-700/30">Load</button>
                        </div>
                        <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2 h-9">
                          <span className="text-[9px] text-zinc-500 font-black uppercase shrink-0">Stage Grid</span>
                          <select value={workspaceSettings.stageFlowLayout} onChange={(e) => { const next = e.target.value as StageFlowLayout; handleStageFlowLayoutChange(next); }} style={{ colorScheme: 'dark' }} className="bg-zinc-900 border border-zinc-700 rounded px-1 py-0.5 text-[10px] text-zinc-200 font-bold outline-none cursor-pointer min-w-[90px]">
                            <option value="balanced">Balanced</option>
                            <option value="speaker_focus">Speaker Focus</option>
                            <option value="preview_focus">Preview Focus</option>
                            <option value="minimal_next">Minimal Next</option>
                          </select>
                        </div>
                        <button onClick={() => updateStageTimerFlash({ active: !stageTimerFlash.active })} className={`h-9 px-3 rounded-lg border font-black text-[9px] tracking-wider uppercase transition-all ${stageTimerFlash.active ? 'border-rose-600/60 bg-rose-950/40 text-rose-300 animate-pulse' : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}>Flash</button>
                        <button
                          onClick={handleToggleTimerPopout}
                          className={`h-9 px-3 rounded-lg border font-black text-[9px] tracking-wider uppercase transition-all ${timerPopoutWin && !timerPopoutWin.closed ? 'border-cyan-600/60 bg-cyan-950/40 text-cyan-300' : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'}`}
                          title="Open timer in a fullscreen pop-out window for confidence monitors"
                        >Timer Pop-out</button>
                        <button onClick={() => void copyShareUrl(obsOutputUrl)} className="h-9 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-[9px] font-black text-zinc-400 hover:text-white hover:border-zinc-500 transition-all uppercase tracking-wider">Copy OBS URL</button>
                        <button onClick={() => void copyShareUrl(cleanFeedUrl, 'Clean feed URL copied!')} className="h-9 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-[9px] font-black text-zinc-400 hover:text-violet-300 hover:border-violet-600 transition-all uppercase tracking-wider" title="No branding or audience overlays — use for recording or streaming">Copy Clean Feed</button>
                        <button onClick={() => void copyShareUrl(stageDisplayUrl)} className="h-9 px-3 rounded-lg border border-zinc-700 bg-zinc-900 text-[9px] font-black text-zinc-400 hover:text-white hover:border-zinc-500 transition-all uppercase tracking-wider">Copy Stage URL</button>
                        {isElectronShell && hasElectronDisplayControl && (
                          <button
                            onClick={async () => {
                              setNdiError(null);
                              if (ndiActive) {
                                await window.electron?.ndi?.stop?.();
                              } else {
                                const result = await window.electron?.ndi?.start?.({
                                  sourceName: `Lumina \u2013 ${workspaceSettings.churchName || 'Presenter'}`,
                                  workspaceId,
                                  sessionId: liveSessionId,
                                });
                                if (result && !result.ok) setNdiError(result.error ?? 'NDI failed to start.');
                              }
                            }}
                            title={ndiActive ? 'Stop NDI broadcast' : 'Broadcast slide output as an NDI source on the local network'}
                            className={`h-9 px-3 rounded-lg border font-black text-[9px] tracking-wider uppercase transition-all ${ndiActive ? 'border-violet-500/70 bg-violet-950/50 text-violet-300 animate-pulse' : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-violet-300 hover:border-violet-600'}`}
                          >
                            {ndiActive ? '● NDI LIVE' : 'Send NDI'}
                          </button>
                        )}
                        {ndiError && (
                          <span
                            className="h-9 flex items-center px-3 rounded-lg border border-rose-700/60 bg-rose-950/30 text-[9px] font-bold text-rose-300 cursor-pointer"
                            title="Click to dismiss"
                            onClick={() => setNdiError(null)}
                          >
                            {ndiError}
                          </span>
                        )}
                        <button onClick={() => setBlackout(!blackout)} className={`h-9 px-5 rounded-lg border font-black text-[10px] tracking-widest uppercase active:scale-95 transition-all ml-auto shadow-lg ${blackout ? 'bg-zinc-900 text-red-400 border-red-600/80 animate-pulse shadow-red-950/20' : 'bg-red-600 border-red-500 text-white hover:bg-red-500 shadow-red-950/30'}`}>
                          {blackout ? 'Go Live' : 'BLACKOUT'}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
              <div
                className={`w-full bg-zinc-950 border-l border-zinc-900 flex flex-col h-72 lg:h-auto border-t lg:border-t-0 shrink-0 min-w-0 ${legacyMachineMode ? 'hidden' : (isElectronShell ? 'flex' : 'hidden md:flex')}`}
                style={legacyMachineMode ? undefined : { width: presenterQueueWidth }}
              >
                <div className="sticky top-0 z-20 h-10 px-3 border-b border-zinc-900 font-bold text-zinc-500 text-[10px] uppercase tracking-wider flex justify-between items-center bg-zinc-950">
                  <span>Live Queue</span>
                  <div className="flex items-center gap-2">
                    {activeItem && <span className="text-zinc-600">{presenterQueueSlides.length} slides</span>}
                    {activeItem && <span className="text-red-500 animate-pulse">* LIVE</span>}
                  </div>
                </div>
                {enabledTimerCues.length > 0 && (
                  <div className="px-2 py-2 border-b border-zinc-900 bg-zinc-950/60">
                    <div className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1">Rundown Cues</div>
                    <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
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
                <div className="flex-1 overflow-y-auto p-3 space-y-4 scroll-smooth custom-scrollbar">
                  {activeItem && activeSlide ? (
                    <>
                      <div className="sticky top-0 z-10 bg-zinc-950 pb-3">
                        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Live Now</div>
                        <button
                          ref={activeSlideRef}
                          onClick={() => { setActiveSlideIndex(presenterQueueActiveIndex); setBlackout(false); setIsPlaying(true); }}
                          className="w-full text-left rounded-sm overflow-hidden border border-red-500 ring-1 ring-red-500/60 bg-zinc-900 shadow-lg shadow-red-950/20"
                        >
                          <div className="relative aspect-video">
                            <div className="absolute inset-0 pointer-events-none">
                              <SlideRenderer slide={activeSlide} item={activeItem} fitContainer={true} isThumbnail={true} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-t border-zinc-800 bg-black/80">
                            <span className="truncate text-[10px] font-mono text-zinc-100">{presenterQueueActiveIndex + 1}. {activeSlide.label || `Slide ${presenterQueueActiveIndex + 1}`}</span>
                            <span className="text-[9px] uppercase tracking-widest text-red-400 font-bold shrink-0">LIVE</span>
                          </div>
                        </button>
                        <div className="mt-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Stage Preview</div>
                            <button
                              onClick={() => setIsStagePreviewEditorOpen(true)}
                              className="inline-flex items-center gap-1 rounded border border-purple-700/40 bg-purple-950/25 px-2 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-purple-200 transition-colors hover:border-purple-500/60 hover:bg-purple-950/40"
                            >
                              <MaximizeIcon className="h-3 w-3" />
                              Expand
                            </button>
                          </div>
                          <div
                            ref={stagePreviewFrameRef}
                            className="relative aspect-video overflow-hidden rounded-sm border border-purple-700/40 bg-black shadow-[0_8px_22px_rgba(0,0,0,0.35)]"
                          >
                            {blackout ? (
                              <HoldScreen view="blackout" compact />
                            ) : holdScreenMode === 'clear' ? (
                              <HoldScreen view="clear" compact />
                            ) : holdScreenMode === 'logo' ? (
                              <HoldScreen view="logo" churchName={workspaceSettings.churchName} compact />
                            ) : (
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
                                timerFlashActive={stageTimerFlash.active}
                                timerFlashColor={stageTimerFlash.color}
                                timerLayout={workspaceSettings.stageTimerLayout}
                                onTimerLayoutChange={handleStageTimerLayoutChange}
                                stageAlertLayout={workspaceSettings.stageAlertLayout}
                                onStageAlertLayoutChange={handleStageAlertLayoutChange}
                                profile={workspaceSettings.stageProfile}
                                flowLayout={workspaceSettings.stageFlowLayout}
                                audienceOverlay={audienceDisplay}
                                stageAlert={stageAlert}
                                stageMessageCenter={stageMessageCenter}
                                embedded
                                viewportWidth={stagePreviewViewport.width}
                                viewportHeight={stagePreviewViewport.height}
                                className="select-none"
                              />
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
                            <span>Drag timer or alert here. Expand for a larger stage editor.</span>
                            <button
                              onClick={() => setIsStagePreviewEditorOpen(true)}
                              className="rounded border border-zinc-800 px-2 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:border-zinc-600"
                            >
                              Edit Stage
                            </button>
                          </div>
                        </div>
                      </div>
                      {presenterQueueUpNext.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">Up Next</div>
                          <div className="space-y-2">
                            {presenterQueueUpNext.map(({ slide, idx }) => (
                              <button
                                key={slide.id}
                                onClick={() => { setActiveSlideIndex(idx); setBlackout(false); setIsPlaying(true); }}
                                className="w-full text-left rounded-sm overflow-hidden border border-zinc-800 hover:border-zinc-600 bg-zinc-900/60 transition-colors"
                              >
                                <div className="relative aspect-video">
                                  <div className="absolute inset-0 pointer-events-none">
                                    <SlideRenderer slide={slide} item={activeItem} fitContainer={true} isThumbnail={true} />
                                  </div>
                                </div>
                                <div className="px-2 py-1.5 border-t border-zinc-800 bg-black/75">
                                  <div className="truncate text-[10px] font-mono text-zinc-200">{idx + 1}. {slide.label || `Slide ${idx + 1}`}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-bold">More In Queue</div>
                        <div className={`space-y-2 pr-1 custom-scrollbar ${presenterQueueCompact ? 'max-h-[40vh] overflow-y-auto' : ''}`}>
                          {presenterQueueRemaining.map(({ slide, idx }) => (
                            <button
                              key={slide.id}
                              onClick={() => { setActiveSlideIndex(idx); setBlackout(false); setIsPlaying(true); }}
                              className="w-full text-left rounded-sm border border-zinc-800 hover:border-zinc-600 bg-zinc-900/40 transition-colors overflow-hidden"
                            >
                              <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] items-stretch">
                                <div className="relative aspect-video border-r border-zinc-800">
                                  <div className="absolute inset-0 pointer-events-none">
                                    <SlideRenderer slide={slide} item={activeItem} fitContainer={true} isThumbnail={true} />
                                  </div>
                                </div>
                                <div className="p-2 min-w-0">
                                  <div className="truncate text-[10px] font-mono text-zinc-200">{idx + 1}. {slide.label || `Slide ${idx + 1}`}</div>
                                  <div className="mt-1 text-[10px] text-zinc-500 truncate">{slide.content || activeItem.title}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                          {presenterQueueRemaining.length === 0 && (
                            <div className="rounded-sm border border-dashed border-zinc-800 px-3 py-4 text-center text-[10px] uppercase tracking-widest text-zinc-600">
                              Queue clear after live slide
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-zinc-700 text-xs font-mono py-10 uppercase">NO_ACTIVE_ITEM</div>
                  )}
                </div>
              </div>
            </div>
      )}
          </>
        )}
        <RightDock
          isOpen={isRightDockOpen}
          machineMode={workspaceSettings.machineMode}
          onToggleMachineMode={() => setWorkspaceSettings(prev => ({ ...prev, machineMode: !prev.machineMode }))}
          onOpenConnect={(panel) => { setConnectPanel(panel); setIsConnectOpen(true); }}
          onOpenAI={() => setIsAIModalOpen(true)}
          hasElectronDisplayControl={hasElectronDisplayControl}
          onOpenDisplaySetup={handleOpenDisplaySetup}
          desktopServiceState={desktopServiceState}
        />
      </div>

      {
        isOutputLive && !(hasElectronDisplayControl && desktopServiceState.outputOpen) && (
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
              {(() => {
                const holdState = renderPresenterHoldState();
                if (holdState) return holdState;
                if (!activeItem || !activeSlide) {
                  return <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500 font-mono text-xs font-bold tracking-[0.2em]">WAITING_FOR_LIVE_CONTENT</div>;
                }
                return (
                  <SlideRenderer
                    slide={activeSlide}
                    item={activeItem}
                    fitContainer={true}
                    isPlaying={isPlaying}
                    seekCommand={seekCommand}
                    seekAmount={seekAmount}
                    seekTarget={seekTarget}
                    videoSyncEpoch={videoSyncEpoch}
                    isMuted={outputMuted}
                    isProjector={true}
                    lowerThirds={lowerThirdsEnabled}
                    showSlideLabel={true}
                    showProjectorHelper={false}
                    audienceOverlay={audienceDisplay}
                    projectedAudienceQr={audienceQrProjection}
                    branding={{ enabled: workspaceSettings.slideBrandingEnabled, churchName: workspaceSettings.churchName, seriesLabel: workspaceSettings.slideBrandingSeriesLabel, style: workspaceSettings.slideBrandingStyle, textOpacity: workspaceSettings.slideBrandingOpacity }}
                  />
                );
              })()}
            </div>
          </OutputWindow>
        )
      }

      {
        isStageDisplayLive && !(hasElectronDisplayControl && desktopServiceState.stageOpen) && (
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
            {renderPresenterHoldState() || (
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
                timerFlashActive={stageTimerFlash.active}
                timerFlashColor={stageTimerFlash.color}
                timerLayout={workspaceSettings.stageTimerLayout}
                onTimerLayoutChange={handleStageTimerLayoutChange}
                stageAlertLayout={workspaceSettings.stageAlertLayout}
                onStageAlertLayoutChange={handleStageAlertLayoutChange}
                profile={workspaceSettings.stageProfile}
                flowLayout={workspaceSettings.stageFlowLayout}
                audienceOverlay={audienceDisplay}
                stageAlert={stageAlert}
                stageMessageCenter={stageMessageCenter}
                branding={{ enabled: workspaceSettings.slideBrandingEnabled, churchName: workspaceSettings.churchName, seriesLabel: workspaceSettings.slideBrandingSeriesLabel, style: workspaceSettings.slideBrandingStyle, textOpacity: workspaceSettings.slideBrandingOpacity }}
              />
            )}
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
                <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                  <span className="font-semibold">EasyWorship (.ewsx)</span>
                  <input type="file" accept=".ewsx,.ewp" className="hidden" onChange={importEasyWorshipAsItem} disabled={isImportingDeck} />
                  <div className="text-[10px] text-zinc-500 mt-1">Import songs or presentations exported from EasyWorship.</div>
                </label>
                <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                  <span className="font-semibold">ProPresenter (.pro6 / .pro)</span>
                  <input type="file" accept=".pro6,.pro6x,.pro" className="hidden" onChange={importProPresenterAsItem} disabled={isImportingDeck} />
                  <div className="text-[10px] text-zinc-500 mt-1">ProPresenter 6 (.pro6) is fully supported. PP7 (.pro): export as .pro6 if text is missing.</div>
                </label>
                <label className="block border border-zinc-800 rounded px-3 py-2 bg-zinc-950 text-xs text-zinc-300 cursor-pointer hover:border-zinc-600 transition-colors">
                  <span className="font-semibold">OpenSong (.ofs / .xml)</span>
                  <input type="file" accept=".ofs,.xml,.opensong" className="hidden" onChange={importOpenSongAsItem} disabled={isImportingDeck} />
                  <div className="text-[10px] text-zinc-500 mt-1">Import songs exported from OpenSong. Supports verse/chorus/bridge markers.</div>
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
        <div className="pointer-events-none fixed inset-0 z-[130] p-3 md:p-4">
          <div
            ref={presetStudioCardRef}
            data-testid="speaker-preset-studio"
            className={`pointer-events-auto absolute w-full overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(34,211,238,0.16),transparent_32%),linear-gradient(180deg,rgba(24,24,27,0.98),rgba(9,9,11,0.99))] shadow-[0_32px_120px_rgba(0,0,0,0.45)] transition-[max-width] duration-300 ${presetStudioMinimized ? 'max-w-sm' : presetStudioShellWidthClass}`}
            style={presetStudioPosition
              ? { left: presetStudioPosition.x, top: presetStudioPosition.y, transform: 'none' }
              : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent_42%)]" />
            <div className="relative flex max-h-[88vh] flex-col">
              <div
                data-testid="speaker-preset-studio-drag-handle"
                onPointerDown={beginPresetStudioDrag}
                className={`flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/82 px-4 py-3 backdrop-blur-xl md:px-5 ${presetStudioDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <SparklesIcon className="h-3.5 w-3.5 shrink-0 text-cyan-200/70" />
                  <h3 className="truncate text-sm font-semibold tracking-tight text-white md:text-base">Speaker Timer Presets</h3>
                  {presetStudioMinimized && presetStudioSaveLabel && (
                    <div className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                      {presetStudioSaveLabel}
                    </div>
                  )}
                </div>
                <div data-no-preset-drag className="flex items-center gap-1.5">
                  {!presetStudioMinimized && (
                    <>
                      <div className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                        {speakerTimerPresets.length} saved
                      </div>
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-black/25 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <button
                          type="button"
                          data-testid="speaker-preset-width-standard"
                          aria-pressed={!presetStudioIsWide}
                          onClick={() => setPresetStudioWidthMode('standard')}
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition ${
                            presetStudioIsWide
                              ? 'text-zinc-400 hover:text-zinc-200'
                              : 'bg-white text-zinc-950 shadow-[0_10px_24px_rgba(255,255,255,0.18)]'
                          }`}
                        >
                          Std
                        </button>
                        <button
                          type="button"
                          data-testid="speaker-preset-width-wide"
                          aria-pressed={presetStudioIsWide}
                          onClick={() => setPresetStudioWidthMode('wide')}
                          className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] transition ${
                            presetStudioIsWide
                              ? 'bg-cyan-200 text-cyan-950 shadow-[0_10px_24px_rgba(34,211,238,0.22)]'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Wide
                        </button>
                      </div>
                      {presetStudioSaveLabel && (
                        <div
                          data-testid="speaker-preset-studio-status"
                          className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100"
                        >
                          {presetStudioSaveLabel}
                        </div>
                      )}
                      <button
                        onClick={openCreatePresetModal}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-semibold text-cyan-100 transition hover:border-cyan-300/50 hover:bg-cyan-500/15"
                      >
                        <PlusIcon className="h-3 w-3" />
                        New
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setPresetStudioMinimized((v) => !v)}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                    title={presetStudioMinimized ? 'Expand' : 'Minimize'}
                  >
                    {presetStudioMinimized ? <MaximizeIcon className="h-3.5 w-3.5" /> : <MinimizeIcon className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={closeSpeakerPresetStudio}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 p-1.5 text-zinc-300 transition hover:border-white/20 hover:bg-white/10"
                    title="Close"
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {!presetStudioMinimized && (<><div className={presetStudioBodyGridClass}>
                <aside className="min-h-0 overflow-y-auto border-b border-white/10 bg-black/20 p-3 custom-scrollbar md:p-4 xl:border-b-0 xl:border-r xl:border-white/10">
                  <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-[18px] border border-white/10 bg-zinc-950/80 px-3 py-2.5 backdrop-blur-xl">
                    <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-200/70">Library</div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
                      {presetTargetItemId ? 'Cue ready' : 'Browse'}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2 pr-1">
                    {speakerTimerPresets.map((preset, presetIdx) => {
                      const isLoaded = editingPresetId === preset.id;
                      const isSelected = activePresetCardId === preset.id;
                      const presetThresholds = normalizeSpeakerTimerThresholds(preset.amberPercent, preset.redPercent);
                      const amberRemainingSec = Math.max(1, Math.round(preset.durationSec * (presetThresholds.amberPercent / 100)));
                      const redRemainingSec = Math.max(1, Math.round(preset.durationSec * (presetThresholds.redPercent / 100)));
                      const ringRunway = Math.max(0, 100 - presetThresholds.amberPercent);
                      const ringAmber = Math.max(0, presetThresholds.amberPercent - presetThresholds.redPercent);
                      const ringRed = presetThresholds.redPercent;
                      const ringR = 13;
                      const ringC = 2 * Math.PI * ringR;
                      return (
                        <div
                          key={preset.id}
                          draggable
                          onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(presetIdx)); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
                            if (Number.isNaN(fromIdx) || fromIdx === presetIdx) return;
                            setWorkspaceSettings((prev) => {
                              const arr = [...(prev.speakerTimerPresets || [])];
                              const [moved] = arr.splice(fromIdx, 1);
                              if (moved) arr.splice(presetIdx, 0, moved);
                              return { ...prev, speakerTimerPresets: arr };
                            });
                          }}
                          className={`rounded-[18px] border p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.16)] transition cursor-grab active:cursor-grabbing ${
                            isSelected
                              ? 'border-cyan-300/40 bg-[linear-gradient(180deg,rgba(8,47,73,0.45),rgba(9,9,11,0.78))]'
                              : 'border-white/10 bg-[linear-gradient(180deg,rgba(39,39,42,0.7),rgba(9,9,11,0.88))] hover:border-white/20'
                          }`}
                        >
                          <button type="button" onClick={() => openEditPresetModal(preset)} className="w-full text-left">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <svg width="32" height="32" viewBox="0 0 32 32" className="shrink-0">
                                  <circle cx="16" cy="16" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                                  <circle cx="16" cy="16" r={ringR} fill="none" stroke="rgba(52,211,153,0.8)" strokeWidth="3"
                                    strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ringRunway / 100)}
                                    transform="rotate(-90 16 16)" strokeLinecap="round" />
                                  <circle cx="16" cy="16" r={ringR} fill="none" stroke="rgba(252,211,77,0.85)" strokeWidth="3"
                                    strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ringAmber / 100)}
                                    transform={`rotate(${-90 + ringRunway * 3.6} 16 16)`} strokeLinecap="round" />
                                  <circle cx="16" cy="16" r={ringR} fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="3"
                                    strokeDasharray={ringC} strokeDashoffset={ringC * (1 - ringRed / 100)}
                                    transform={`rotate(${-90 + (ringRunway + ringAmber) * 3.6} 16 16)`} strokeLinecap="round" />
                                </svg>
                                <div className="min-w-0">
                                  <div className="truncate text-[13px] font-semibold text-white">{preset.name}</div>
                                  <div className="truncate text-[11px] text-zinc-400">{preset.speakerName || 'Open slot'}</div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                {isLoaded && (
                                  <span className="rounded-full border border-cyan-400/30 bg-cyan-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-cyan-100">
                                    Edit
                                  </span>
                                )}
                                {selectedSpeakerPresetId === preset.id && (
                                  <span className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                                    Live
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 flex items-end justify-between gap-2">
                              <div className="text-2xl font-semibold tracking-tight text-white tabular-nums">{formatTimer(preset.durationSec)}</div>
                              <div className="text-right text-[10px] leading-4 text-zinc-500">
                                <div>{formatTimer(amberRemainingSec)} amb</div>
                                <div>{formatTimer(redRemainingSec)} red</div>
                              </div>
                            </div>
                            <div className="mt-2">{renderSpeakerPresetThresholdBar(presetThresholds.amberPercent, presetThresholds.redPercent, { compact: true })}</div>
                          </button>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedSpeakerPresetId(preset.id);
                                if (presetTargetItemId) applySpeakerPresetToItem(presetTargetItemId, preset.id);
                              }}
                              disabled={!presetTargetItemId}
                              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold text-emerald-100 transition hover:border-emerald-300/45 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <CheckIcon className="h-3 w-3" />
                              Apply
                            </button>
                            <button
                              onClick={() => duplicateSpeakerPresetDraft(preset)}
                              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
                            >
                              <CopyIcon className="h-3 w-3" />
                              Copy
                            </button>
                            <button
                              onClick={() => deleteSpeakerPreset(preset.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/10 px-2.5 py-1 text-[9px] font-semibold text-rose-100 transition hover:border-rose-300/45 hover:bg-rose-500/15"
                            >
                              <TrashIcon className="h-3 w-3" />
                              Del
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </aside>

                <div
                  data-testid="speaker-preset-studio-editor-scroll"
                  className="min-h-0 overflow-y-auto p-3 custom-scrollbar md:p-4 xl:p-4"
                >
                  <div className={presetStudioEditorGridClass}>
                    <div className="space-y-3">
                      <section
                        data-testid="speaker-preset-studio-hero"
                        className={`sticky top-0 z-20 overflow-hidden rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(9,9,11,0.98))] shadow-[0_24px_80px_rgba(0,0,0,0.26)] backdrop-blur-xl ${presetStudioHeroSectionPaddingClass}`}
                      >
                        <div className={presetStudioHeroGridClass}>
                          <div className="min-w-0">
                            <div className="text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-200/60">
                              {presetStudioHeroEyebrow}
                            </div>
                            <div
                              data-testid="speaker-preset-hero-timer"
                              className={presetStudioHeroTimerClass}
                            >
                              {formatTimer(presetDraftDurationSec)}
                            </div>
                            <div className="mt-0.5 break-words text-sm font-semibold leading-tight text-white sm:text-base">{presetDraftDisplayName}</div>
                            <div className="break-words text-xs text-zinc-400">{presetDraftSpeakerLabel}</div>
                          </div>
                          <div className={presetStudioHeroBehaviorCardClass}>
                            <div className="flex flex-wrap gap-1.5">
                              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-semibold text-zinc-100">
                                {presetDraft.autoStartNextDefault ? 'Auto-next' : 'Manual'}
                              </span>
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2 py-0.5 text-[9px] font-semibold text-cyan-100">
                                {presetDraftThresholds.amberPercent}% / {presetDraftThresholds.redPercent}%
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${(presetDraft.overtimeBehavior || 'count-up') === 'count-up' ? 'border border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border border-rose-400/20 bg-rose-500/10 text-rose-100'}`}>
                                {(presetDraft.overtimeBehavior || 'count-up') === 'count-up' ? 'OT: Count up' : (presetDraft.overtimeBehavior === 'stop' ? 'OT: Stop' : 'OT: Flash+Stop')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">{renderSpeakerPresetThresholdBar(presetDraftThresholds.amberPercent, presetDraftThresholds.redPercent)}</div>
                        {presetPreviewProgress !== null && (() => {
                          const pAmber = presetDraftThresholds.amberPercent / 100;
                          const pRed = presetDraftThresholds.redPercent / 100;
                          const pr = presetPreviewProgress;
                          const simSec = Math.round(pr * presetDraftDurationSec);
                          const zone = pr <= pRed ? 'red' : pr <= pAmber ? 'amber' : 'green';
                          const ringR = 20;
                          const ringC = 2 * Math.PI * ringR;
                          return (
                            <div className="mt-2 flex items-center gap-3 rounded-[14px] border border-white/10 bg-black/30 p-2.5">
                              <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
                                <circle cx="24" cy="24" r={ringR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
                                <circle cx="24" cy="24" r={ringR} fill="none"
                                  stroke={zone === 'red' ? 'rgba(248,113,113,0.9)' : zone === 'amber' ? 'rgba(252,211,77,0.9)' : 'rgba(52,211,153,0.85)'}
                                  strokeWidth="3.5" strokeDasharray={ringC} strokeDashoffset={ringC * (1 - clamp(pr, 0, 1))}
                                  strokeLinecap="round" transform="rotate(-90 24 24)"
                                  style={{ transition: 'stroke-dashoffset 250ms linear, stroke 250ms ease' }}
                                />
                              </svg>
                              <div className="min-w-0">
                                <div className={`font-mono font-black text-lg tabular-nums ${zone === 'red' ? 'text-red-400' : zone === 'amber' ? 'text-amber-300' : 'text-emerald-300'}`}
                                  style={{ transition: 'color 250ms ease' }}
                                >{formatTimer(simSec)}</div>
                                <div className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Preview</div>
                              </div>
                            </div>
                          );
                        })()}
                        <div className="mt-1.5 flex items-center gap-2">
                          <button
                            onClick={startPresetPreview}
                            disabled={presetPreviewProgress !== null}
                            className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition disabled:opacity-40"
                          >
                            {presetPreviewProgress !== null ? 'Previewing...' : 'Preview'}
                          </button>
                        </div>
                        <div className={presetStudioHeroSummaryGridClass}>
                          <div className={presetStudioHeroSummaryCardClass}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Runway</div>
                            <div className={presetStudioHeroSummaryValueClass}>{formatTimer(presetDraftRunwaySec)}</div>
                          </div>
                          <div className={presetStudioHeroSummaryCardClass}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Amber</div>
                            <div className={presetStudioHeroSummaryValueClass}>{formatTimer(presetDraftAmberWindowSec)}</div>
                          </div>
                          <div className={presetStudioHeroSummaryCardClass}>
                            <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-500">Red</div>
                            <div className={presetStudioHeroSummaryValueClass}>{formatTimer(presetDraftRedRemainingSec)}</div>
                          </div>
                        </div>
                      </section>

                      <section className="grid gap-3 md:grid-cols-2">
                        <label className="rounded-[18px] border border-white/10 bg-zinc-950/70 p-3.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Preset name</div>
                          <input
                            data-testid="speaker-preset-name-input"
                            value={presetDraft.name}
                            onChange={(e) => setPresetDraft((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Sunday message main"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/45"
                          />
                        </label>
                        <label className="rounded-[18px] border border-white/10 bg-zinc-950/70 p-3.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Speaker</div>
                          <input
                            value={presetDraft.speakerName || ''}
                            onChange={(e) => setPresetDraft((prev) => ({ ...prev, speakerName: e.target.value }))}
                            placeholder="Pastor Jordan"
                            className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-cyan-300/45"
                          />
                        </label>
                      </section>

                      <section className="rounded-[18px] border border-white/10 bg-zinc-950/70 p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Duration</div>
                          <div className="text-[9px] font-semibold text-zinc-500">Max 2h</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <label className="rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Hrs</div>
                            <input
                              type="number"
                              min={0}
                              max={2}
                              value={presetDraftHours}
                              onChange={(e) => updatePresetDurationSegment('hours', Number(e.target.value) || 0)}
                              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center text-xl font-semibold text-white outline-none transition focus:border-cyan-300/45"
                            />
                          </label>
                          <label className="rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Min</div>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={presetDraftMinutes}
                              onChange={(e) => updatePresetDurationSegment('minutes', Number(e.target.value) || 0)}
                              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center text-xl font-semibold text-white outline-none transition focus:border-cyan-300/45"
                            />
                          </label>
                          <label className="rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Sec</div>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              value={presetDraftSeconds}
                              onChange={(e) => updatePresetDurationSegment('seconds', Number(e.target.value) || 0)}
                              className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-center text-xl font-semibold text-white outline-none transition focus:border-cyan-300/45"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          {[300, 600, 900, 1200, 2100].map((durationSec) => (
                            <button
                              key={durationSec}
                              onClick={() => setPresetDraft((prev) => ({ ...prev, durationSec }))}
                              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                                presetDraftDurationSec === durationSec
                                  ? 'border-cyan-300/40 bg-cyan-500/15 text-cyan-100'
                                  : 'border-white/10 bg-white/5 text-zinc-200 hover:border-white/20 hover:bg-white/10'
                              }`}
                            >
                              {formatTimer(durationSec)}
                            </button>
                          ))}
                          <label className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300">
                            <input
                              type="number"
                              min={1}
                              max={120}
                              placeholder="min"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = Math.max(1, Math.min(120, Number((e.target as HTMLInputElement).value) || 5));
                                  setPresetDraft((prev) => ({ ...prev, durationSec: val * 60 }));
                                  (e.target as HTMLInputElement).value = '';
                                }
                              }}
                              className="w-10 bg-transparent text-center text-[10px] text-zinc-200 outline-none placeholder:text-zinc-600"
                            />
                            <span className="text-zinc-500">min</span>
                          </label>
                        </div>
                      </section>

                      <section className="rounded-[18px] border border-white/10 bg-zinc-950/70 p-3.5">
                        <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Thresholds</div>
                        <div className="mt-3 grid gap-3">
                          <div className="rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-amber-200/90">Amber</div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={presetDraftThresholds.amberPercent}
                                  onChange={(e) => updatePresetThresholdDraft('amber', Number(e.target.value) || 1)}
                                  className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-xs font-semibold text-white outline-none transition focus:border-amber-300/45"
                                />
                                <span className="text-[10px] text-zinc-500">%</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={99}
                              value={presetDraftThresholds.amberPercent}
                              onChange={(e) => updatePresetThresholdDraft('amber', Number(e.target.value) || 1)}
                              className="mt-2 w-full accent-amber-400"
                            />
                            <div className="mt-1 text-[10px] text-zinc-500">Starts at {formatTimer(presetDraftAmberRemainingSec)} left</div>
                          </div>

                          <div className="rounded-[14px] border border-white/10 bg-black/20 p-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs font-semibold text-rose-200/90">Red</div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  max={presetDraftThresholds.amberPercent}
                                  value={presetDraftThresholds.redPercent}
                                  onChange={(e) => updatePresetThresholdDraft('red', Number(e.target.value) || 1)}
                                  className="w-14 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-center text-xs font-semibold text-white outline-none transition focus:border-rose-300/45"
                                />
                                <span className="text-[10px] text-zinc-500">%</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={presetDraftThresholds.amberPercent}
                              value={presetDraftThresholds.redPercent}
                              onChange={(e) => updatePresetThresholdDraft('red', Number(e.target.value) || 1)}
                              className="mt-2 w-full accent-rose-400"
                            />
                            <div className="mt-1 text-[10px] text-zinc-500">Starts at {formatTimer(presetDraftRedRemainingSec)} left</div>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[18px] border border-white/10 bg-zinc-950/70 p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Cue behavior</div>
                          <label className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-100">
                            <input
                              type="checkbox"
                              checked={!!presetDraft.autoStartNextDefault}
                              onChange={(e) => setPresetDraft((prev) => ({ ...prev, autoStartNextDefault: e.target.checked }))}
                              className="h-3.5 w-3.5 accent-cyan-500"
                            />
                            Auto-start next
                          </label>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-white/8">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 mb-1.5">Audio chimes</div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <label className="inline-flex items-center gap-1.5 text-[10px] text-zinc-300">
                              <input type="checkbox" checked={presetDraft.chimeOnAmber !== false} onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnAmber: e.target.checked }))} className="h-3 w-3 accent-amber-500" />
                              Amber
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-[10px] text-zinc-300">
                              <input type="checkbox" checked={presetDraft.chimeOnRed !== false} onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnRed: e.target.checked }))} className="h-3 w-3 accent-rose-500" />
                              Red
                            </label>
                            <label className="inline-flex items-center gap-1.5 text-[10px] text-zinc-300">
                              <input type="checkbox" checked={presetDraft.chimeOnMilestones === true} onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnMilestones: e.target.checked }))} className="h-3 w-3 accent-cyan-500" />
                              30s/10s
                            </label>
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2.5 border-t border-white/8">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500 mb-1.5">Overtime</div>
                          <div className="flex flex-wrap gap-1">
                            {([
                              { value: 'count-up', label: 'Count up' },
                              { value: 'stop', label: 'Stop' },
                              { value: 'flash-and-stop', label: 'Flash+Stop' },
                            ] as const).map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => setPresetDraft((prev) => ({ ...prev, overtimeBehavior: opt.value === 'count-up' ? undefined : opt.value }))}
                                className={`px-2 py-0.5 text-[9px] font-bold rounded border transition-colors ${(presetDraft.overtimeBehavior || 'count-up') === opt.value ? 'border-blue-500/50 bg-blue-600/20 text-blue-200' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-zinc-200'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </section>
                    </div>

                    <div
                      data-testid="speaker-preset-studio-commit-rail"
                      className="space-y-3 xl:sticky xl:top-3 xl:self-start xl:flex xl:max-h-[calc(88vh-1.5rem)] xl:flex-col"
                    >
                      <div className="space-y-3 xl:min-h-0 xl:flex-1 xl:overflow-y-auto xl:pr-1 custom-scrollbar">
                        <section className="rounded-[18px] border border-white/10 bg-zinc-950/78 p-3">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Flight plan</div>
                          <div className="mt-2 space-y-1.5">
                            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-white/10 bg-black/20 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Amber at</div>
                              <div className="text-base font-semibold text-white">{formatTimer(presetDraftRunwaySec)}</div>
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-white/10 bg-black/20 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Red at</div>
                              <div className="text-base font-semibold text-white">{formatTimer(presetDraftRedStartSec)}</div>
                            </div>
                            <div className="flex items-center justify-between gap-2 rounded-[12px] border border-white/10 bg-black/20 px-3 py-2">
                              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500">Hard-stop</div>
                              <div className="text-base font-semibold text-white">{formatTimer(presetDraftRedRemainingSec)}</div>
                            </div>
                          </div>
                        </section>

                        <section className="rounded-[18px] border border-white/10 bg-zinc-950/78 px-3 py-2.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">Notes</div>
                          <div className="mt-1.5 text-[11px] leading-5 text-zinc-400">
                            {presetStudioOperatorNotes.map((note, index) => (
                              <p key={`${index}-${note}`}>{note}</p>
                            ))}
                          </div>
                        </section>
                      </div>

                      <section className="rounded-[18px] border border-cyan-400/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.46),rgba(9,9,11,0.92))] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.24)] xl:shrink-0">
                        <div className="flex items-center justify-between gap-2">
                          {presetStudioSaveLabel && (
                            <div className="rounded-full border border-emerald-400/25 bg-emerald-500/12 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-100">
                              {presetStudioSaveLabel}
                            </div>
                          )}
                        </div>
                        <div className="mt-1.5 space-y-1.5">
                          <button
                            data-testid="speaker-preset-save"
                            onClick={savePresetDraft}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/40 bg-[linear-gradient(180deg,rgba(34,211,238,0.28),rgba(8,145,178,0.26))] px-3 py-2 text-xs font-semibold text-cyan-50 transition hover:border-cyan-100/60 hover:bg-[linear-gradient(180deg,rgba(34,211,238,0.36),rgba(8,145,178,0.34))]"
                          >
                            <CheckIcon className="h-3.5 w-3.5" />
                            {editingPresetId ? 'Update' : 'Save'}
                          </button>
                          <button
                            data-testid="speaker-preset-new-draft"
                            onClick={openCreatePresetModal}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:border-white/20 hover:bg-white/10"
                          >
                            <EditIcon className="h-3.5 w-3.5" />
                            New draft
                          </button>
                          <button
                            onClick={closeSpeakerPresetStudio}
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-1.5 text-xs font-semibold text-zinc-400 transition hover:border-white/20 hover:bg-white/5"
                          >
                            <XIcon className="h-3.5 w-3.5" />
                            Close
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hidden border-r border-zinc-800 p-3 max-h-[65vh] overflow-y-auto custom-scrollbar space-y-2">
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
              <div className="hidden p-3 space-y-2">
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

                <div className="mt-2 pt-2 border-t border-zinc-800/60">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-black mb-1.5">Audio Chimes</div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={presetDraft.chimeOnAmber !== false}
                        onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnAmber: e.target.checked }))}
                        className="accent-amber-500"
                      />
                      Amber chime
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={presetDraft.chimeOnRed !== false}
                        onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnRed: e.target.checked }))}
                        className="accent-rose-500"
                      />
                      Red chime
                    </label>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={presetDraft.chimeOnMilestones === true}
                        onChange={(e) => setPresetDraft((prev) => ({ ...prev, chimeOnMilestones: e.target.checked }))}
                        className="accent-cyan-500"
                      />
                      Milestone pips (30s, 10s)
                    </label>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-zinc-800/60">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 font-black mb-1.5">Overtime Behavior</div>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { value: 'count-up', label: 'Count up', desc: 'Continue as -MM:SS' },
                      { value: 'stop', label: 'Stop', desc: 'Freeze at 00:00' },
                      { value: 'flash-and-stop', label: 'Flash + Stop', desc: 'Flash red, then stop' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPresetDraft((prev) => ({ ...prev, overtimeBehavior: opt.value === 'count-up' ? undefined : opt.value }))}
                        className={`px-2.5 py-1 text-[10px] font-bold rounded border transition-colors ${(presetDraft.overtimeBehavior || 'count-up') === opt.value ? 'border-blue-500/60 bg-blue-600/25 text-blue-200' : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'}`}
                        title={opt.desc}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end gap-2">
                  <button onClick={savePresetDraft} className="px-3 py-1.5 text-[10px] font-bold rounded border border-blue-600 bg-blue-600/30 text-blue-200">
                    Save Preset
                  </button>
                </div>
              </div>
              </>)}
            </div>
          </div>
        </div>
      )}

      {isStagePreviewEditorOpen && (
        <div className="fixed inset-0 z-[145] bg-black/85 backdrop-blur-sm p-4 md:p-6 flex items-center justify-center">
          <div className="w-full max-w-[1680px] rounded-2xl border border-zinc-800 bg-zinc-950 shadow-[0_32px_120px_rgba(0,0,0,0.48)] overflow-hidden">
            <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-4 py-3 backdrop-blur">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-purple-300">Stage Preview</div>
                  <div className="rounded-full border border-cyan-700/40 bg-cyan-950/25 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-cyan-200">
                    Live Sync
                  </div>
                  <div className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-zinc-400">
                    Esc closes
                  </div>
                </div>
                <div className="mt-1 text-sm font-semibold text-white">Edit pastor timer and alert from the control screen</div>
                <div className="mt-1 text-[11px] text-zinc-500">Changes apply to the real stage layout immediately, so the operator can correct issues without turning to the stage TV.</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-zinc-400">
                  {Math.round(stageEditorViewport.width)}x{Math.round(stageEditorViewport.height)}
                </div>
                <button
                  onClick={() => setIsStagePreviewEditorOpen(false)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/50 bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-emerald-500 shadow-[0_8px_24px_rgba(5,150,105,0.3)]"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                  Done / Back To Presenter
                </button>
                <button
                  onClick={() => setIsStagePreviewEditorOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                  aria-label="Close stage preview editor"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <div ref={stageEditorFrameRef} className="relative w-full aspect-[16/9] overflow-hidden rounded-2xl border border-zinc-800 bg-black">
                {blackout ? (
                  <HoldScreen view="blackout" />
                ) : holdScreenMode === 'clear' ? (
                  <HoldScreen view="clear" />
                ) : holdScreenMode === 'logo' ? (
                  <HoldScreen view="logo" churchName={workspaceSettings.churchName} />
                ) : (
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
                    timerFlashActive={stageTimerFlash.active}
                    timerFlashColor={stageTimerFlash.color}
                    timerLayout={workspaceSettings.stageTimerLayout}
                    onTimerLayoutChange={handleStageTimerLayoutChange}
                    stageAlertLayout={workspaceSettings.stageAlertLayout}
                    onStageAlertLayoutChange={handleStageAlertLayoutChange}
                    profile={workspaceSettings.stageProfile}
                    flowLayout={workspaceSettings.stageFlowLayout}
                    audienceOverlay={audienceDisplay}
                    stageAlert={stageAlert}
                    stageMessageCenter={stageMessageCenter}
                    embedded
                    viewportWidth={stageEditorViewport.width}
                    viewportHeight={stageEditorViewport.height}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-900 bg-zinc-950/75 px-3 py-3 text-[11px] text-zinc-500">
                <span>Changes here write back to the stage layout used by the live stage screen.</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Need to exit quickly?</span>
                  <button
                    onClick={() => setIsStagePreviewEditorOpen(false)}
                    className="rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-emerald-500"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none fixed bottom-6 right-6 z-[155] flex flex-col items-end gap-2">
            <div className="rounded-full border border-zinc-700/80 bg-zinc-950/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400 shadow-[0_8px_24px_rgba(0,0,0,0.28)]">
              Need to exit stage editor?
            </div>
            <button
              onClick={() => setIsStagePreviewEditorOpen(false)}
              className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-emerald-400/70 bg-emerald-500 px-5 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_12px_32px_rgba(16,185,129,0.35)] transition-transform transition-colors hover:scale-[1.02] hover:bg-emerald-400"
            >
              <CheckIcon className="h-4 w-4" />
              Done
            </button>
          </div>
        </div>
      )}

      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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
        onAetherStreamRequest={(action) => handleAetherStreamRequest(action, {
          target: 'program',
          sceneTarget: 'program',
          sceneName: resolveAetherSceneName('program'),
        }, {
          successLabel: action === 'start' ? 'Aether live start sent' : 'Aether live stop sent',
          failureLabel: action === 'start' ? 'Aether live start failed' : 'Aether live stop failed',
        })}
        aetherBridgeStatusTone={aetherBridgeStatus.tone}
        aetherBridgeStatusText={aetherBridgeStatus.text}
      />
      {hasElectronDisplayControl && (
        <DisplaySetupModal
          open={isDisplaySetupOpen}
          displays={desktopDisplayCards}
          detectedCount={desktopDisplays.length}
          validationErrors={desktopDisplayValidationErrors}
          statusText={desktopDisplayStatusText || (!desktopRoleAssignments.stage ? 'No stage screen assigned. Start Service will continue without stage.' : '')}
          onClose={() => setIsDisplaySetupOpen(false)}
          onRefresh={() => {
            void refreshDesktopDisplays();
          }}
          onAutoAssign={handleDesktopAutoAssign}
          onIdentifyAll={() => {
            void electronMachineApi?.identifyAllDisplays?.();
          }}
          onRoleChange={handleDesktopRoleChange}
          onTestDisplay={(displayId) => {
            void electronMachineApi?.testDisplay?.(displayId);
          }}
          onSaveMapping={handleSaveDesktopDisplayMapping}
          onStartService={() => {
            void handleStartDesktopService();
          }}
          ndiWindowOpen={desktopServiceState.outputOpen && !desktopRoleAssignments.audience}
          onLaunchNdiWindow={hasElectronDisplayControl ? () => {
            if (desktopServiceState.outputOpen && !desktopRoleAssignments.audience) {
              void electronMachineApi?.closeRoleWindow?.('audience').then((state) => {
                if (state) setDesktopServiceState(state);
              });
              return;
            }
            const primaryDisplay = desktopDisplays[0];
            if (!primaryDisplay) return;
            void electronMachineApi?.openRoleWindow?.({
              role: 'audience',
              displayId: primaryDisplay.id,
              windowed: true,
              workspaceId,
              sessionId: liveSessionId,
            }).then((result) => {
              if (result?.ok && result.state) {
                setDesktopServiceState(result.state);
                setIsOutputLive(true);
              }
            });
          } : undefined}
        />
      )}
      <AIModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onGenerate={handleAIItemGenerated} />
      {isProfileOpen && <ProfileSettings onClose={() => setIsProfileOpen(false)} onSave={handleWorkspaceSettingsSave} onLogout={handleLogout} currentSettings={workspaceSettings} currentUser={user} onSaveCcliApiCredentials={handleSaveCcliApiCredentials} ccliConnected={ccliConnected} />}
      {presenterContextMenu && presenterContextMenuActions.length > 0 && (
        <ContextMenu
          x={presenterContextMenu.x}
          y={presenterContextMenu.y}
          title={
            presenterContextMenu.type === 'schedule'
              ? 'Schedule Actions'
              : presenterContextMenu.type === 'preview-slide'
                ? 'Preview Slide'
                : 'Live Slide'
          }
          actions={presenterContextMenuActions}
          onClose={closePresenterContextMenu}
        />
      )}
      {
        isMotionLibOpen && (
          <MotionLibrary
            onClose={() => setIsMotionLibOpen(false)}
            onSelect={async (asset) => {
              // Alpha-channel overlay: update slides with alphaOverlayUrl, leave background theme alone
              if (asset.alphaOverlayUrl && selectedItem) {
                const resolvedAlphaUrl = await persistRemoteMotionLibraryAsset(asset.alphaOverlayUrl, 'video');
                updateItem({
                  ...selectedItem,
                  slides: selectedItem.slides.map((s) => ({ ...s, alphaOverlayUrl: resolvedAlphaUrl })),
                });
                logActivity(user?.uid, 'UPDATE_THEME', { type: 'ALPHA_OVERLAY', itemId: selectedItem.id });
                setMotionLibraryMode('selected-item');
                setIsMotionLibOpen(false);
                return;
              }
              const url = asset.url;
              const mediaType = asset.mediaType;
              const isMotion = mediaType === 'motion' || isMotionUrl(url);
              const resolvedMediaType = isMotion ? 'motion' as const : (mediaType === 'image' ? 'image' as const : 'video' as const);
              // motion:// URLs are canvas-rendered locally — no need to download/persist
              const resolvedUrl = isMotion ? url : await persistRemoteMotionLibraryAsset(url, resolvedMediaType as 'image' | 'video');

              // Persist as user's default background for all future slide creation
              setUserDefaultBackground({
                url: resolvedUrl,
                mediaType: resolvedMediaType,
                provider: asset.provider,
                category: asset.category,
                title: asset.name,
                sourceUrl: asset.sourceUrl || asset.url,
              });

              if (motionLibraryMode === 'new-item') {
                const itemTitle = isMotion ? 'Lumina Background' : (resolvedMediaType === 'image' ? 'Still Background' : 'Motion Background');
                const nextItem = finalizeGeneratedItemBackground({
                  id: `item-${Date.now()}`,
                  title: itemTitle,
                  type: ItemType.MEDIA,
                  slides: [{
                    id: `slide-${Date.now()}`,
                    label: 'Media Slide',
                    content: '',
                  }],
                  theme: {
                    backgroundUrl: resolvedUrl,
                    mediaType: resolvedMediaType,
                    fontFamily: 'sans-serif',
                    textColor: '#ffffff',
                    shadow: true,
                  },
                  metadata: {
                    source: 'manual',
                    backgroundProvider: asset.provider,
                    backgroundCategory: asset.category,
                    backgroundTitle: asset.name,
                    backgroundSourceUrl: asset.sourceUrl || asset.url,
                  },
                }, 'user');
                addItem(nextItem);
                setSelectedItemId(nextItem.id);
              } else if (selectedItem) {
                updateItem({
                  ...selectedItem,
                  theme: { ...selectedItem.theme, backgroundUrl: resolvedUrl, mediaType: resolvedMediaType },
                  metadata: {
                    ...selectedItem.metadata,
                    backgroundProvider: asset.provider,
                    backgroundCategory: asset.category,
                    backgroundTitle: asset.name,
                    backgroundSourceUrl: asset.sourceUrl || asset.url,
                  },
                });
                logActivity(user?.uid, 'UPDATE_THEME', { type: 'MOTION_BG', itemId: selectedItem.id, mediaType: resolvedMediaType });
              }
              setMotionLibraryMode('selected-item');
              setIsMotionLibOpen(false);
            }}
          />
        )
      }
      <SmartSlideEditor
        isOpen={isSlideEditorOpen}
        item={selectedItem}
        mode={editingSlide ? 'edit' : 'add'}
        initialSlideId={editingSlide?.id || null}
        onClose={() => {
          setIsSlideEditorOpen(false);
          setEditingSlide(null);
        }}
        onSaveSlides={handleSaveSlidesFromEditor}
        onImportPowerPointVisual={importPowerPointVisualSlidesForSlideEditor}
        onImportPowerPointText={importPowerPointTextSlidesForSlideEditor}
        workspaceId={workspaceId}
        user={user}
      />

      {/* Sermon recorder — persistent fixed overlay, survives tab switches */}
      {showSermonRecorder && (
        <div className="fixed top-16 right-4 z-[200] w-96 h-[85vh] overflow-hidden rounded-2xl shadow-2xl">
          <SermonRecorderPanel
            onClose={() => setShowSermonRecorder(false)}
            onFlashToScreen={handleSermonFlashToScreen}
            onSave={handleSermonSave}
          />
        </div>
      )}
    </div>
);
}

export default App;

