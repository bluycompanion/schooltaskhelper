import type { LocalViewContext, Role } from './api/apiClient';

const defaultChildUserId = 'child1';
const validRoles: Role[] = ['child', 'parent', 'agent'];

function roleFromEnv(value: string | undefined): Role {
  return validRoles.includes(value as Role) ? (value as Role) : 'child';
}

export function getLocalViewContext(): LocalViewContext {
  const childUserId = import.meta.env.VITE_CHILD_USER_ID || defaultChildUserId;
  const role = roleFromEnv(import.meta.env.VITE_ROLE);
  const userId = import.meta.env.VITE_USER_ID || (role === 'child' ? childUserId : role);

  return { role, childUserId, userId };
}

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || '';
}
