// Centralized runtime configuration for frontend
// No-backend mode toggle: when false, sockets and API calls are disabled.
// Allow URL param overrides for zero-config cloud usage (e.g. OBS Browser Source).
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const envEnableSocket = (import.meta.env.VITE_ENABLE_SOCKET as string | undefined) === 'true';
const enableSocketParam = params?.get('enableSocket');
export const ENABLE_SOCKET: boolean = enableSocketParam != null
  ? (enableSocketParam === 'true' || enableSocketParam === '1')
  : envEnableSocket;

// Simple mode: single scoreboard + single overlay, fixed room id
const simpleParam = params?.get('simple');
export const SIMPLE_MODE: boolean = simpleParam === 'true' || simpleParam === '1';
const defaultRoomOverride = params?.get('room') || params?.get('defaultRoom') || undefined;
export const DEFAULT_ROOM_ID: string =
  defaultRoomOverride ||
  (import.meta.env.VITE_DEFAULT_ROOM_ID as string | undefined) ||
  'default';

const isDev = import.meta.env.DEV;
const prodDefaultBackend = (() => {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'snookerlivehk-elton.github.io') {
    return 'https://snooker-backend-production.up.railway.app';
  }
  if (host.endsWith('.up.railway.app')) {
    return 'https://snooker-backend-production.up.railway.app';
  }
  if (host.endsWith('snookerhk.live')) {
    return 'https://api.snookerhk.live';
  }
  return window.location.origin;
})();

// Socket URL resolution:
// - Use VITE_SOCKET_URL when provided
// - In dev, default to http://localhost:3000
// - In prod, default to prodDefaultBackend (Railway / custom domain)
const socketUrlOverride = params?.get('socketUrl') || params?.get('socket') || undefined;
export const SOCKET_URL: string =
  socketUrlOverride ||
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : prodDefaultBackend);

// Socket path resolution (for proxies/custom paths)
// - Allow URL param `socketPath`/`path`
// - Use `VITE_SOCKET_PATH` when provided
// - Default to '/socket.io'
const socketPathOverride = params?.get('socketPath') || params?.get('path') || undefined;
export const SOCKET_PATH: string =
  socketPathOverride ||
  (import.meta.env.VITE_SOCKET_PATH as string | undefined) ||
  '/socket.io';

const apiUrlOverride = params?.get('apiUrl') || params?.get('api') || undefined;
export const API_URL: string =
  apiUrlOverride ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : prodDefaultBackend);

// App display name (UI + document.title)
export const APP_NAME: string = (import.meta.env.VITE_APP_NAME as string | undefined) || 'Snooker Standalone';

const googleClientIdOverride = params?.get('googleClientId') || params?.get('google_client_id') || undefined;
export const GOOGLE_CLIENT_ID: string =
  googleClientIdOverride ||
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ||
  '277887232996-5lfubeh4be5pnrd458buc489uq0h0e1g.apps.googleusercontent.com';

// Supabase configuration (optional for simple-mode realtime without self-hosted backend)
const supabaseUrlOverride = params?.get('supabaseUrl') || undefined;
const supabaseKeyOverride = params?.get('supabaseKey') || undefined;
export const SUPABASE_URL: string | undefined =
  supabaseUrlOverride || (import.meta.env.VITE_SUPABASE_URL as string | undefined);
export const SUPABASE_ANON_KEY: string | undefined =
  supabaseKeyOverride || (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

// Enable Supabase when credentials exist and either simple mode is on or sockets are disabled
export const ENABLE_SUPABASE: boolean = !!SUPABASE_URL && !!SUPABASE_ANON_KEY && (!ENABLE_SOCKET || SIMPLE_MODE);
