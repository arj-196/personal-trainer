'use client';

import { useEffect } from 'react';

import { rememberActiveWorkspace } from '@/lib/active-workspace';

/** Records the visited workspace as the Active Workspace. Renders nothing. */
export function RememberWorkspace({ slug }: { slug: string }) {
  useEffect(() => {
    rememberActiveWorkspace(slug);
  }, [slug]);
  return null;
}
