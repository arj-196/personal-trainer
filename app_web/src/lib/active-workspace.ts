/**
 * Active Workspace — the workspace the app treats as "mine" for navigation
 * (the Workout tab, Home's Today card). Client-persisted in a plain cookie so
 * server components can read it; never stored in the database.
 */
export const ACTIVE_WORKSPACE_COOKIE = 'pt_active_ws';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function rememberActiveWorkspace(slug: string): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(slug)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function readActiveWorkspaceFromDocument(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${ACTIVE_WORKSPACE_COOKIE}=`));
  if (!match) {
    return null;
  }
  const value = decodeURIComponent(match.slice(ACTIVE_WORKSPACE_COOKIE.length + 1));
  return value || null;
}

/** Resolve the active workspace against the real workspace list (server-side). */
export function resolveActiveWorkspace(
  cookieValue: string | null | undefined,
  workspaces: string[],
): string | null {
  if (cookieValue && workspaces.includes(cookieValue)) {
    return cookieValue;
  }
  return workspaces.length > 0 ? [...workspaces].sort()[0] : null;
}
