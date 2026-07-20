import Link from 'next/link';
import { cookies } from 'next/headers';

import { createWorkspaceAction, logoutAction } from './actions';
import { ACTIVE_WORKSPACE_COOKIE, resolveActiveWorkspace } from '@/lib/active-workspace';
import {
  getCurrentCommitHash,
  getCurrentEnvVariables,
  isDebugEnabled,
} from '@/lib/debug-info';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';
import { listCheckIns } from '@/lib/server/workspaces';
import {
  listWorkspaces,
  planMetaShort,
  readUserProfileSummary,
  readWorkoutPlan,
} from '@/lib/trainer-data';
import { Button, ButtonLink, Card, Display, EmptyState, Kicker, inputClass } from '@/components/ui';
import { ThemeToggle } from '@/components/theme-toggle';
import { TodayCard, type TodayDaySummary } from '@/components/today-card';

export const dynamic = 'force-dynamic';

function greetingForHour(hour: number): string {
  if (hour < 12) {
    return 'Morning,';
  }
  if (hour < 18) {
    return 'Afternoon,';
  }
  return 'Evening,';
}

export default async function HomePage() {
  const workspaces = await listWorkspaces();
  const cookieStore = await cookies();
  const activeWorkspace = resolveActiveWorkspace(
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null,
    workspaces,
  );

  const plan = activeWorkspace ? await readWorkoutPlan(activeWorkspace) : null;
  const profile = activeWorkspace ? await readUserProfileSummary(activeWorkspace) : null;

  const workspaceCards = await Promise.all(
    workspaces.map(async (slug) => {
      const wsPlan = slug === activeWorkspace ? plan : await readWorkoutPlan(slug);
      const checkIns = await listCheckIns(slug);
      return {
        slug,
        sub: wsPlan
          ? `${wsPlan.title} · ${checkIns.length} check-in${checkIns.length === 1 ? '' : 's'}`
          : 'No plan yet — set up the athlete profile',
      };
    }),
  );

  const todayDays: TodayDaySummary[] = plan
    ? plan.days.map((day, index) => ({
        dayNumber: index + 1,
        heading: day.heading,
        blockCount: buildWorkoutDayBlocks(day).length,
      }))
    : [];

  const greetingName = profile?.name?.trim() || activeWorkspace || 'athlete';
  const showDebugPanel = isDebugEnabled();

  return (
    <div className="flex flex-col gap-4 px-[18px] pb-6 pt-[22px]">
      <header className="flex items-start justify-between">
        <Display as="h1" className="text-[30px] leading-[1.02]">
          {greetingForHour(new Date().getHours())}
          <br />
          <span className="text-acc">{greetingName}.</span>
        </Display>
        <ThemeToggle />
      </header>

      <section className="flex flex-col gap-2">
        <Kicker>Today</Kicker>
        {plan && activeWorkspace ? (
          <TodayCard
            workspace={activeWorkspace}
            planTitle={plan.title}
            metaShort={planMetaShort(plan.meta)}
            nextCheckIn={plan.nextCheckIn}
            days={todayDays}
          />
        ) : (
          <EmptyState
            title="No plan yet."
            action={
              activeWorkspace ? (
                <ButtonLink variant="ink" size="sm" className="h-[40px] px-[18px] text-[13px]" href={`/workspace/${encodeURIComponent(activeWorkspace)}`}>
                  Set up {activeWorkspace} →
                </ButtonLink>
              ) : null
            }
          >
            Fill the athlete profile, then let the coach draft your first multi-week plan.
          </EmptyState>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <Kicker>Workspaces</Kicker>
        {workspaceCards.map((workspace) => (
          <Link
            key={workspace.slug}
            href={`/workspace/${encodeURIComponent(workspace.slug)}`}
            className={[
              'flex items-center gap-3 rounded-[16px] border bg-card px-4 py-3.5',
              workspace.slug === activeWorkspace ? 'border-acc' : 'border-ln',
            ].join(' ')}
          >
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-acc-soft font-display text-[16px] font-extrabold text-acc-deep">
              {workspace.slug[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold">{workspace.slug}</div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-fnt">
                {workspace.sub}
              </div>
            </div>
            <div className="text-fnt">›</div>
          </Link>
        ))}
        <form action={createWorkspaceAction} className="flex gap-2">
          <input
            className={`${inputClass} h-[44px] rounded-full border-ln2 bg-card px-4 text-[13px]`}
            name="workspace"
            placeholder="New workspace name…"
            required
          />
          <Button variant="outline" type="submit" className="bg-card px-4 text-[13px]">
            Create
          </Button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <Kicker>Kitchen</Kicker>
        <Link
          href="/recipes"
          className="flex items-center gap-3 rounded-[20px] border border-gold bg-gold-soft px-[18px] py-4"
        >
          <div className="text-[24px]">🎙</div>
          <div className="flex-1">
            <Display as="div" className="text-[16px] font-bold text-ink">
              Jeff the Cook
            </Display>
            <div className="text-[12.5px] text-mut">Say what&apos;s in the fridge. Get 3 recipes.</div>
          </div>
          <div className="text-fnt">›</div>
        </Link>
      </section>

      {showDebugPanel ? (
        <Card className="p-4">
          <Kicker className="mb-2">Debug</Kicker>
          <p className="m-0 break-all font-mono text-[12px] text-mut">{getCurrentCommitHash()}</p>
          <div className="mt-2 grid gap-1">
            {getCurrentEnvVariables().map((item) => (
              <code key={item.key} className="break-all text-[11px] text-fnt">
                {item.key}={item.value}
              </code>
            ))}
          </div>
        </Card>
      ) : null}

      <form action={logoutAction} className="self-center">
        <button
          type="submit"
          className="cursor-pointer border-none bg-transparent p-1.5 text-[13px] text-fnt underline"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
