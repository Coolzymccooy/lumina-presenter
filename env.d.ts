/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PEXELS_API_KEY?: string;
  readonly VITE_PIXABAY_API_KEY?: string;
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

type ToolsCommand =
  | { type: 'ndi.toggle-active' }
  | { type: 'ndi.toggle-broadcast' }
  | { type: 'ndi.toggle-audio' }
  | { type: 'ndi.set-resolution'; value: ToolsNdiResolution }
  | { type: 'ndi.open-info' };

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

