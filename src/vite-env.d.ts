/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** Set only by the same-domain build (vite.config.ts): the API's real address for the long-lived streams. */
  readonly VITE_STREAM_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
