'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { readActiveWorkspaceFromDocument } from '@/lib/active-workspace';

type TabId = 'home' | 'workout' | 'jeff' | 'saved';

function activeTabForPath(pathname: string): TabId | null {
  if (pathname === '/' || pathname.startsWith('/workspace/')) {
    return 'home';
  }
  if (pathname.startsWith('/workout/')) {
    return 'workout';
  }
  if (pathname.startsWith('/recipes')) {
    return 'jeff';
  }
  if (pathname.startsWith('/saved-recipes')) {
    return 'saved';
  }
  return null;
}

function isFullScreenPath(pathname: string): boolean {
  return (
    pathname === '/login' ||
    pathname === '/debug' ||
    /^\/workout\/[^/]+\/start/.test(pathname)
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9v11h13V9" />
    </svg>
  );
}

function WorkoutIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" />
    </svg>
  );
}

function JeffIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

function SavedIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[19px] w-[19px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 3.5h11V21l-5.5-3.5L6.5 21z" />
    </svg>
  );
}

const TAB_DEFS: Array<{ id: TabId; label: string; icon: () => React.ReactNode }> = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'workout', label: 'Workout', icon: WorkoutIcon },
  { id: 'jeff', label: 'Jeff', icon: JeffIcon },
  { id: 'saved', label: 'Saved', icon: SavedIcon },
];

function TabBar({ pathname }: { pathname: string }) {
  const [activeWorkspace, setActiveWorkspace] = useState<string | null>(null);

  useEffect(() => {
    setActiveWorkspace(readActiveWorkspaceFromDocument());
  }, [pathname]);

  const activeTab = activeTabForPath(pathname);
  const hrefFor = (id: TabId): string => {
    switch (id) {
      case 'home':
        return '/';
      case 'workout':
        return activeWorkspace ? `/workout/${encodeURIComponent(activeWorkspace)}` : '/';
      case 'jeff':
        return '/recipes';
      case 'saved':
        return '/saved-recipes';
    }
  };

  return (
    <nav
      aria-label="Main"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[480px] px-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]"
    >
      <div className="pointer-events-auto flex rounded-[18px] border border-ln bg-card px-1.5 py-2 shadow-[0_6px_24px_rgba(28,26,23,0.12)]">
        {TAB_DEFS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={hrefFor(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center gap-0.5 py-0.5',
                isActive ? 'opacity-100' : 'opacity-50',
              ].join(' ')}
            >
              <span className={isActive ? 'text-acc' : 'text-ink'}>
                <tab.icon />
              </span>
              <span className={['text-[10px] font-bold', isActive ? 'text-acc' : 'text-ink'].join(' ')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const fullScreen = isFullScreenPath(pathname);

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg text-ink sm:shadow-[0_0_60px_rgba(28,26,23,0.18)]">
      <main
        className={
          fullScreen
            ? 'flex min-h-dvh flex-1 flex-col'
            : 'flex-1 pb-[calc(86px+env(safe-area-inset-bottom))]'
        }
      >
        {children}
      </main>
      {fullScreen ? null : <TabBar pathname={pathname} />}
    </div>
  );
}
