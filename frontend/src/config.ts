// Centralized runtime configuration for frontend
// No-backend mode toggle: when false, sockets and API calls are disabled.
// Allow URL param overrides for zero-config cloud usage (e.g. OBS Browser Source).
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const envEnableSocket = (import.meta.env.VITE_ENABLE_SOCKET as string | undefined) === 'true';
const enableSocketParam = params?.get('enableSocket');
export const ENABLE_SOCKET: boolean = enableSocketParam != null
  ? (enableSocketParam === 'true' || enableSocketParam === '1')
  : envEnableSocket;

// Socket URL resolution:
// - Use VITE_SOCKET_URL when provided
// - In dev, default to http://localhost:3000
// - In prod, default to window.location.origin (assuming same-origin backend)
const isDev = import.meta.env.DEV;
const socketUrlOverride = params?.get('socketUrl') || params?.get('socket') || undefined;
export const SOCKET_URL: string =
  socketUrlOverride ||
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : window.location.origin);

// Socket path resolution (for proxies/custom paths)
// - Allow URL param `socketPath`/`path`
// - Use `VITE_SOCKET_PATH` when provided
// - Default to '/socket.io'
const socketPathOverride = params?.get('socketPath') || params?.get('path') || undefined;
export const SOCKET_PATH: string =
  socketPathOverride ||
  (import.meta.env.VITE_SOCKET_PATH as string | undefined) ||
  '/socket.io';

// API base URL resolution
// - Use VITE_API_URL when provided
// - In dev, default to http://localhost:3000
// - In prod, default to window.location.origin (assuming same-origin backend)
const apiUrlOverride = params?.get('apiUrl') || params?.get('api') || undefined;
export const API_URL: string =
  apiUrlOverride ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : window.location.origin);

// App display name (UI + document.title)
export const APP_NAME: string = (import.meta.env.VITE_APP_NAME as string | undefined) || 'Snooker Standalone';