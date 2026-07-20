/** Theme preference — cookie-persisted so the server renders it flash-free. */
export const THEME_COOKIE = 'pt_theme';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function rememberTheme(theme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
