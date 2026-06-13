import { resolveViewContext } from './api/viewContext';

const defaultChildUserId = 'child1';

export function getLocalViewContext() {
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return resolveViewContext(search, {
    role: import.meta.env.VITE_ROLE,
    childUserId: import.meta.env.VITE_CHILD_USER_ID || defaultChildUserId,
    userId: import.meta.env.VITE_USER_ID,
  });
}

export function getApiBaseUrl(): string {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window === 'undefined') return '';

  const path = window.location.pathname || '';
  const devPrefix = '/dev/schooltaskhelper';
  const prodPrefix = '/schooltaskhelper';
  if (path.startsWith(devPrefix)) return devPrefix;
  if (path.startsWith(prodPrefix)) return prodPrefix;
  return '';
}

// Test mode (Barnvy/Vuxenvy switch, reload, animation toggle) shows only while
// running the Vite dev server, or when explicitly opted in with `?dev=1`. A
// normal production build is therefore safe to share with a child — no test UI,
// regardless of host (localhost included).
export function isLocalDevMode(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('dev') === '1';
}
