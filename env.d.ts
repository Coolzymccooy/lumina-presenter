/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PEXELS_API_KEY?: string;
  readonly VITE_PIXABAY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

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

