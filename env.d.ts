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

