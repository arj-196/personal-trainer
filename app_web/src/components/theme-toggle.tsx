'use client';

import { useEffect, useState } from 'react';

import { rememberTheme } from '@/lib/theme';

const THEME_COLORS = { light: '#f6f1e8', dark: '#1c1a17' } as const;

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', THEME_COLORS[theme]);
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    rememberTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full border border-ln2 bg-card text-[15px]"
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}
