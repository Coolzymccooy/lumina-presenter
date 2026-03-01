/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PEXELS_API_KEY?: string;
  readonly VITE_PIXABAY_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

