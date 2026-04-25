/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PEXELS_API_KEY?: string;
  readonly VITE_PIXABAY_API_KEY?: string;
  readonly VITE_AI_WEB_LYRICS_FETCH?: string;
  readonly VITE_APP_STAGE?: 'uat' | 'prod' | string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface NdiSourceStatus {
  id: string;
  sourceName: string;
  fillKey: boolean;
  active: boolean;
  lastError?: string | null;
}

interface NdiAudioStats {
  framesSent: number;
  framesPerSecond: number;
  droppedFrames: number;
}

interface NdiStatus {
  active: boolean;
  broadcastMode: boolean;
  resolution: '720p' | '1080p' | '4k';
  width: number;
  height: number;
  audioEnabled: boolean;
  audio: NdiAudioStats | null;
  sources: NdiSourceStatus[];
}

type ToolsAspect = 'off' | '4:3' | '16:9' | '1:1';
type ToolsTestPattern = 'off' | 'smpte' | 'pluge' | 'black' | 'white' | 'gradient' | 'checkerboard';

interface ToolsSettings {
  overlays: {
    safeAreas: boolean;
    centerCross: boolean;
  };
  aspect: ToolsAspect;
  testPattern: ToolsTestPattern;
}

type ToolsSettingsPatch = {
  overlays?: Partial<ToolsSettings['overlays']>;
  aspect?: ToolsAspect;
  testPattern?: ToolsTestPattern;
};

type ToolsNdiResolution = '720p' | '1080p' | '4k';

interface ToolsNdiMenuState {
  active: boolean;
  broadcastMode: boolean;
  audioEnabled: boolean;
  resolution: ToolsNdiResolution;
}

type AppViewMode = 'PRESENTER' | 'BUILDER' | 'STAGE';
type AppRoutingMode = 'PROJECTOR' | 'STREAM' | 'LOBBY';
type AppShareTarget = 'audience' | 'obs' | 'clean' | 'stage' | 'remote';
type AppSidebarTab = 'SCHEDULE' | 'HYMNS' | 'AUDIO' | 'BIBLE' | 'AUDIENCE' | 'FILES' | 'MACROS';

interface AppMenuState {
  sessionActive: boolean;
  viewMode: AppViewMode;
  blackout: boolean;
  outputMuted: boolean;
  lowerThirdsEnabled: boolean;
  routingMode: AppRoutingMode;
  audienceWindowOpen: boolean;
  stageWindowOpen: boolean;
  lastSavedAt: number | null;
}

type ToolsCommand =
  // NDI submenu
  | { type: 'ndi.toggle-active' }
  | { type: 'ndi.toggle-broadcast' }
  | { type: 'ndi.toggle-audio' }
  | { type: 'ndi.set-resolution'; value: ToolsNdiResolution }
  | { type: 'ndi.open-info' }
  // File menu
  | { type: 'file.open-preferences' }
  | { type: 'file.open-profile' }
  | { type: 'file.open-connect' }
  | { type: 'file.copy-share-url'; which: AppShareTarget }
  | { type: 'file.save' }
  | { type: 'file.import-media' }
  | { type: 'file.import-pptx-visual' }
  | { type: 'file.import-pptx-text' }
  // View menu
  | { type: 'view.set-mode'; mode: AppViewMode }
  | { type: 'view.open-sidebar-tab'; tab: AppSidebarTab }
  | { type: 'view.open-motion-library' }
  | { type: 'view.open-timer-popout' }
  // Transport menu
  | { type: 'transport.next-slide' }
  | { type: 'transport.prev-slide' }
  | { type: 'transport.go-live' }
  | { type: 'transport.next-item' }
  | { type: 'transport.prev-item' }
  | { type: 'transport.toggle-play' }
  | { type: 'transport.stop' }
  | { type: 'transport.toggle-blackout' }
  | { type: 'transport.toggle-mute' }
  | { type: 'transport.toggle-lower-thirds' }
  | { type: 'transport.set-routing'; mode: AppRoutingMode }
  // Tools (non-NDI)
  | { type: 'tools.open-display-setup' }
  | { type: 'tools.toggle-sermon-recorder' }
  // Window
  | { type: 'window.open-audience' }
  | { type: 'window.close-audience' }
  | { type: 'window.open-stage' }
  | { type: 'window.close-stage' }
  // Help
  | { type: 'help.open-tours' }
  | { type: 'help.open-help' }
  | { type: 'help.open-shortcuts' }
  | { type: 'help.open-releases' }
  | { type: 'help.report-issue' }
  | { type: 'help.open-about' };

interface Window {
  electron?: {
    isElectron?: boolean;
    copyText?: (text: string) => Promise<boolean>;
    machine?: {
      listDisplays?: () => Promise<Array<{
        id: number;
        key: string;
        name: string;
        isPrimary: boolean;
        isInternal: boolean;
        scaleFactor: number;
        rotation: number;
        bounds: { x: number; y: number; width: number; height: number };
        workArea: { x: number; y: number; width: number; height: number };
      }>>;
      testDisplay?: (displayId: number) => Promise<boolean>;
      identifyAllDisplays?: () => Promise<boolean>;
      startService?: (payload: {
        workspaceId: string;
        sessionId: string;
        controlDisplayId?: number | null;
        audienceDisplayId?: number | null;
        stageDisplayId?: number | null;
      }) => Promise<{
        ok: boolean;
        state: {
          controlDisplayId: number | null;
          audienceDisplayId: number | null;
          stageDisplayId: number | null;
          outputOpen: boolean;
          stageOpen: boolean;
        };
      }>;
      openRoleWindow?: (payload: {
        role: 'audience' | 'stage';
        displayId: number;
        workspaceId: string;
        sessionId: string;
        windowed?: boolean;
      }) => Promise<{
        ok: boolean;
        error?: string;
        state: {
          controlDisplayId: number | null;
          audienceDisplayId: number | null;
          stageDisplayId: number | null;
          outputOpen: boolean;
          stageOpen: boolean;
        };
      }>;
      closeRoleWindow?: (role: 'audience' | 'stage') => Promise<{
        controlDisplayId: number | null;
        audienceDisplayId: number | null;
        stageDisplayId: number | null;
        outputOpen: boolean;
        stageOpen: boolean;
      }>;
      getServiceState?: () => Promise<{
        controlDisplayId: number | null;
        audienceDisplayId: number | null;
        stageDisplayId: number | null;
        outputOpen: boolean;
        stageOpen: boolean;
      }>;
      onDisplaysChanged?: (callback: (payload: Array<{
        id: number;
        key: string;
        name: string;
        isPrimary: boolean;
        isInternal: boolean;
        scaleFactor: number;
        rotation: number;
        bounds: { x: number; y: number; width: number; height: number };
        workArea: { x: number; y: number; width: number; height: number };
      }>) => void) => (() => void);
      onServiceState?: (callback: (payload: {
        controlDisplayId: number | null;
        audienceDisplayId: number | null;
        stageDisplayId: number | null;
        outputOpen: boolean;
        stageOpen: boolean;
      }) => void) => (() => void);
    };
    ndi?: {
      start?: (payload: {
        workspaceId?: string;
        sessionId?: string;
        broadcastMode?: boolean;
        resolution?: '720p' | '1080p' | '4k';
        audioEnabled?: boolean;
      }) => Promise<{ ok: boolean; error?: string; state?: NdiStatus }>;
      stop?: () => Promise<{ ok: boolean }>;
      getStatus?: () => Promise<NdiStatus>;
      onState?: (callback: (state: NdiStatus) => void) => (() => void);
      sendAudioFrame?: (payload: { pcm: ArrayBuffer; sampleRate: number; channels: number; samples: number }) => void;
      sendAudioWarning?: (payload: { code: string; src?: string }) => void;
      onAudioWarning?: (callback: (payload: { code: string; src?: string }) => void) => (() => void);
    };
    tools?: {
      getSettings?: () => Promise<ToolsSettings>;
      setSettings?: (patch: ToolsSettingsPatch) => Promise<ToolsSettings>;
      onState?: (callback: (settings: ToolsSettings) => void) => (() => void);
      setNdiMenuState?: (payload: ToolsNdiMenuState) => void;
      setAppMenuState?: (payload: AppMenuState) => void;
      onCommand?: (callback: (cmd: ToolsCommand) => void) => (() => void);
    };
    updates?: {
      getStatus?: () => Promise<{
        state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
        version?: string | null;
        progress?: number;
        message?: string;
        releaseName?: string | null;
      }>;
      checkNow?: () => Promise<{
        state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
        version?: string | null;
        progress?: number;
        message?: string;
        releaseName?: string | null;
      }>;
      installNow?: () => Promise<boolean>;
      openReleases?: () => Promise<boolean>;
      onStatus?: (callback: (payload: {
        state: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
        version?: string | null;
        progress?: number;
        message?: string;
        releaseName?: string | null;
      }) => void) => (() => void);
    };
  };
}

