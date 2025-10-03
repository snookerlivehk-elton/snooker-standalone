// Centralized runtime configuration for frontend
// Socket URL resolution:
// - Use VITE_SOCKET_URL when provided
// - In dev, default to http://localhost:3000
// - In prod, default to window.location.origin (assuming same-origin backend)
const isDev = import.meta.env.DEV;
export const SOCKET_URL: string =
  (import.meta.env.VITE_SOCKET_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : window.location.origin);

// API base URL resolution
// - Use VITE_API_URL when provided
// - In dev, default to http://localhost:3000
// - In prod, default to window.location.origin (assuming same-origin backend)
export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (isDev ? 'http://localhost:3000' : window.location.origin);