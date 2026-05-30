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

export function isLocalDevMode(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}
