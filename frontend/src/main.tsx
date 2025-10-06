import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

import { BrowserRouter, HashRouter } from 'react-router-dom';
import { APP_NAME } from './config';

// Set document title from configurable app name
document.title = APP_NAME;

// Handle GitHub Pages SPA fallback: if ?redirect= exists, rewrite the pathname before React mounts
(() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get('redirect');
    const base = (import.meta.env.BASE_URL || '/');
    if (redirect) {
      const normalized = redirect.startsWith('/') ? redirect.slice(1) : redirect;
      const newUrl = `${base}${normalized}`;
      // Remove the redirect param from query while preserving others
      params.delete('redirect');
      const qs = params.toString();
      const finalUrl = qs ? `${newUrl}?${qs}` : newUrl;
      window.history.replaceState(null, '', finalUrl);
    }
  } catch {}
})();

// Optional HashRouter fallback (use `?hash=true` or `?useHashRouter=true`)
const shouldUseHashRouter = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('hash') || params.get('useHashRouter');
    return flag === 'true';
  } catch {
    return false;
  }
})();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {shouldUseHashRouter ? (
      <HashRouter>
        <App />
      </HashRouter>
    ) : (
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    )}
  </React.StrictMode>,
)