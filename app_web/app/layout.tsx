import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import { cookies } from 'next/headers';

import './globals.css';
import { AppShell } from '@/components/app-shell';
import { THEME_COOKIE } from '@/lib/theme';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
});

const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Personal Trainer',
  description: 'Workout workspace and Jeff the Cook recipe generator.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trainer',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f6f1e8',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme lives in a cookie so the server can render the right theme with no
  // flash and no client bootstrap script.
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value === 'dark' ? 'dark' : 'light';

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={theme}
      className={`${bricolage.variable} ${instrument.variable}`}
    >
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
