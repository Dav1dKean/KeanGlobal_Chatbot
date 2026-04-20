const ENV_API_BASE_URL = import.meta.env.VITE_API_URL?.trim();
const DEFAULT_DEV_API_BASE_URLS = ["http://127.0.0.1:8000", "http://localhost:8000"];

export const API_BASE_URLS = ENV_API_BASE_URL
  ? [ENV_API_BASE_URL]
  : (import.meta.env.DEV ? DEFAULT_DEV_API_BASE_URLS : [""]);

export const API_BASE_URL = API_BASE_URLS[0];
