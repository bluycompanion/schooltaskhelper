export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const BUILD_ID = import.meta.env.VITE_STH_BUILD_ID || 'dev-local';
export const BUILT_AT = import.meta.env.VITE_STH_BUILD_AT || '';

export function buildInfoLabel(): string {
  return [
    `v${APP_VERSION}`,
    `build ${BUILD_ID}`,
    BUILT_AT ? `built ${BUILT_AT}` : null,
  ].filter(Boolean).join(' · ');
}