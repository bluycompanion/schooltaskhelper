import type { LocalViewContext, Role } from './apiClient';

const validRoles: Role[] = ['child', 'parent', 'agent'];

export interface ViewContextDefaults {
  role?: string;
  childUserId?: string;
  userId?: string;
}

export function normalizeRole(value: string | null | undefined, fallback: Role = 'child'): Role {
  return validRoles.includes(value as Role) ? (value as Role) : fallback;
}

export function resolveViewContext(search: string, defaults: ViewContextDefaults = {}): LocalViewContext {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const defaultRole = normalizeRole(defaults.role, 'child');
  const role = normalizeRole(params.get('role'), defaultRole);
  const childUserId = params.get('child_user_id') || defaults.childUserId || 'child1';
  const userId = params.get('user_id') || defaults.userId || (role === 'child' ? childUserId : `${role}1`);

  return { role, childUserId, userId };
}

export function buildViewHref(role: Role, childUserId: string, userId?: string): string {
  const params = new URLSearchParams();
  params.set('role', role);
  params.set('child_user_id', childUserId);
  params.set('user_id', userId || (role === 'child' ? childUserId : `${role}1`));
  return `?${params.toString()}`;
}
