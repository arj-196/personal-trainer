import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AthleteProfileEditor } from '@/components/athlete-profile-editor';
import { RememberWorkspace } from '@/components/remember-workspace';
import { WorkoutGenerationPanel } from '@/components/workout-generation-panel';
import { WorkspaceCheckIns } from '@/components/workspace-check-ins';
import { Chip, Display } from '@/components/ui';
import { listCheckIns, readAthleteProfile } from '@/lib/server/workspaces';
import { planMetaShort, readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const [profile, checkIns, plan] = await Promise.all([
    readAthleteProfile(workspace),
    listCheckIns(workspace),
    readWorkoutPlan(workspace),
  ]);

  if (!profile) {
    notFound();
  }
  const metaShort = plan ? planMetaShort(plan.meta) : null;

  return (
    <div className="flex flex-col gap-3.5 px-[18px] pb-6 pt-4">
      <RememberWorkspace slug={workspace} />

      <header className="flex items-center gap-2.5">
        <Link
          href="/"
          aria-label="Back to Home"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-ln2 bg-card text-ink"
        >
          ←
        </Link>
        <Display as="h1" className="flex-1 text-[24px]">
          {profile.name || workspace}
        </Display>
        <Chip className="bg-bg2 text-fnt">Workspace</Chip>
      </header>

      <AthleteProfileEditor workspace={workspace} profile={profile} />

      <WorkoutGenerationPanel
        workspace={workspace}
        planTitle={plan?.title ?? null}
        planMetaShort={metaShort}
      />

      <WorkspaceCheckIns
        workspace={workspace}
        checkIns={checkIns}
        hasPlan={plan !== null}
        defaultPlanned={profile.trainingDays}
      />
    </div>
  );
}
