const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

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
