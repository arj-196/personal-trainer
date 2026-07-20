import { DayProgressChip } from '@/components/day-progress-chip';
import { RememberWorkspace } from '@/components/remember-workspace';
import { WorkoutGenerationPanel } from '@/components/workout-generation-panel';
import { ButtonLink, Card, Chip, Display, EmptyState } from '@/components/ui';
import { buildWorkoutDayBlocks } from '@/lib/workout-helpers';
import { planMetaShort, readWorkoutPlan } from '@/lib/trainer-data';

export const dynamic = 'force-dynamic';

export default async function WorkoutPage({
  params,
}: {
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const plan = await readWorkoutPlan(workspace);

  if (!plan) {
    return (
      <div className="flex flex-col gap-3.5 px-[18px] pb-6 pt-4">
        <RememberWorkspace slug={workspace} />
        <Display as="h1" className="text-[26px]">
          Workout Plan
        </Display>
        <EmptyState
          emoji="🏋️"
          title="Nothing prescribed. Yet."
          action={
            <ButtonLink
              variant="accent"
              className="font-display text-[14px]"
              href={`/workspace/${encodeURIComponent(workspace)}`}
            >
              Generate a plan →
            </ButtonLink>
          }
        >
          The coach needs an Athlete Profile to work with. Set it up, then generate your first
          plan.
        </EmptyState>
        <WorkoutGenerationPanel workspace={workspace} />
      </div>
    );
  }

  const metaShort = planMetaShort(plan.meta);

  return (
    <div className="flex flex-col gap-3.5 px-[18px] pb-6 pt-4">
      <RememberWorkspace slug={workspace} />

      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Display as="h1" className="text-[25px]">
            {plan.title}
          </Display>
          <Chip className="bg-bg2 text-fnt">Current</Chip>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {plan.meta.map((item) => (
            <span
              key={item.label}
              className="rounded-full border border-ln bg-card px-2.5 py-1 text-[11.5px] font-semibold text-mut"
            >
              {item.label} <b className="text-ink">{item.value}</b>
            </span>
          ))}
        </div>
        {plan.summary ? (
          <p className="m-0 text-[13.5px] leading-relaxed text-mut">{plan.summary}</p>
        ) : null}
        {plan.progression ? (
          <div className="rounded-[14px] bg-teal-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-teal-deep">
            <b>Progression:</b> {plan.progression}
          </div>
        ) : null}
        {plan.nextCheckIn ? (
          <div className="rounded-[14px] bg-gold-soft px-3.5 py-3 text-[12.5px] leading-relaxed text-gold-deep">
            <b>Next check-in:</b> {plan.nextCheckIn}
          </div>
        ) : null}
      </header>

      <WorkoutGenerationPanel
        workspace={workspace}
        planTitle={plan.title}
        planMetaShort={metaShort}
      />

      {plan.days.map((day, index) => {
        const blockCount = buildWorkoutDayBlocks(day).length;
        return (
          <Card key={day.heading} className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <Display as="h2" className="text-[18px]">
                {day.heading}
              </Display>
              <DayProgressChip
                workspace={workspace}
                dayHeading={day.heading}
                blockCount={blockCount}
              />
            </div>
            {day.warmup ? (
              <div className="text-[12.5px] text-mut">
                <span className="font-bold text-teal-deep">Warm-up</span> · {day.warmup}
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              {day.exercises.map((exercise) => (
                <div
                  key={`${day.heading}-${exercise.name}`}
                  className="flex items-baseline justify-between gap-2 text-[13.5px]"
                >
                  <span className="font-semibold">{exercise.name}</span>
                  {exercise.prescription ? (
                    <span className="whitespace-nowrap font-bold text-acc">
                      {exercise.prescription}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            {day.finisher ? (
              <div className="text-[12.5px] text-mut">
                <span className="font-bold text-gold-deep">Finisher</span> · {day.finisher}
              </div>
            ) : null}
            {day.recovery ? (
              <div className="text-[12.5px] text-mut">
                <span className="font-bold text-vio-deep">Recovery</span> · {day.recovery}
              </div>
            ) : null}
            <ButtonLink
              variant="ink"
              className="mt-0.5 w-full font-display text-[14px]"
              href={`/workout/${encodeURIComponent(workspace)}/start?day=${index + 1}`}
            >
              Start workout →
            </ButtonLink>
          </Card>
        );
      })}
    </div>
  );
}
