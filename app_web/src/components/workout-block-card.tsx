import { googleImagesSearchUrl, type WorkoutBlock } from '@/lib/workout-helpers';
import { cx } from '@/components/ui';

export type BlockCardState = 'done' | 'current' | 'pending';

type WorkoutBlockCardProps = {
  block: WorkoutBlock;
  state: BlockCardState;
  /** e.g. "Exercise · 2 of 3" for exercises, "Warm-up" otherwise. */
  kindLabel: string;
  /** "Set 2 of 4" while this exercise block is current. */
  setLabel?: string | null;
  /** Completed set count for the pip row (exercise blocks only). */
  completedSets?: number;
  isZoomed?: boolean;
  onToggleDone: () => void;
  onSelect: () => void;
  onToggleZoom?: () => void;
};

const KIND_CHIP_CLASSES: Record<WorkoutBlock['kind'], string> = {
  warmup: 'bg-teal-soft text-teal-deep',
  exercise: 'bg-ink text-onink',
  finisher: 'bg-gold-soft text-gold-deep',
  recovery: 'bg-vio-soft text-vio-deep',
};

const KIND_OUTLINE_CLASSES: Record<WorkoutBlock['kind'], string> = {
  warmup: 'border-teal text-teal',
  exercise: 'border-fnt text-fnt',
  finisher: 'border-gold text-gold-deep',
  recovery: 'border-vio text-vio-deep',
};

export function WorkoutBlockCard({
  block,
  state,
  kindLabel,
  setLabel,
  completedSets = 0,
  isZoomed = false,
  onToggleDone,
  onSelect,
  onToggleZoom,
}: WorkoutBlockCardProps) {
  if (state === 'done') {
    return (
      <button
        type="button"
        onClick={onToggleDone}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border-none bg-card px-3.5 py-2 text-left opacity-55"
      >
        <span className="flex h-[19px] w-[19px] flex-none items-center justify-center rounded-full bg-teal text-[10px] text-white">
          ✓
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-mut">
          {block.name}
          {block.prescription ? ` · ${block.prescription}` : ''}
        </span>
        <span className="text-[10px] text-fnt">done</span>
      </button>
    );
  }

  if (state === 'pending') {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full cursor-pointer items-center gap-2.5 rounded-[14px] border-none bg-card px-3.5 py-[11px] text-left"
      >
        <span
          className={cx(
            'whitespace-nowrap rounded-full border px-2 py-0.5 text-[9.5px] font-bold',
            KIND_OUTLINE_CLASSES[block.kind],
          )}
        >
          {kindLabel}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-ink">
          {block.name}
          {block.prescription ? ` · ${block.prescription}` : ''}
        </span>
      </button>
    );
  }

  return (
    <article className="theme-light flex flex-col gap-1.5 rounded-[16px] bg-bg p-1.5 pb-2 text-ink">
      <div className="flex items-center justify-between px-1 pt-0.5">
        <span
          className={cx(
            'whitespace-nowrap rounded-full px-2.5 py-1 text-[10.5px] font-bold tracking-[0.5px]',
            KIND_CHIP_CLASSES[block.kind],
          )}
        >
          {kindLabel}
        </span>
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={`Mark ${block.name} done`}
          className="h-[26px] w-[26px] cursor-pointer rounded-full border-[1.5px] border-ln2 bg-transparent"
        />
      </div>
      <h3 className="m-0 px-1 font-display text-[24px] font-extrabold leading-[1.05]">{block.name}</h3>
      {block.imageUrl ? (
        <>
          <button
            type="button"
            onClick={onToggleZoom}
            className={cx(
              'w-full cursor-pointer overflow-hidden rounded-[11px] border-none bg-card p-0 transition-[height]',
              isZoomed ? 'h-[370px]' : 'h-[214px]',
            )}
          >
            <img src={block.imageUrl} alt={block.name} className="h-full w-full object-contain" />
          </button>
          <div className="-mt-0.5 text-center text-[10px] text-fnt">tap image to enlarge</div>
        </>
      ) : null}
      <div className="flex items-baseline justify-between gap-2 px-1">
        <div className="text-[15px] font-bold leading-snug text-acc">{block.prescription}</div>
        {setLabel ? <div className="whitespace-nowrap text-[11.5px] text-fnt">{setLabel}</div> : null}
      </div>
      {block.notes ? (
        <p className="m-0 px-1 text-[12.5px] leading-relaxed text-mut">{block.notes}</p>
      ) : null}
      {block.kind === 'exercise' && block.setCount > 1 ? (
        <div className="flex gap-1 px-1 pb-0.5" aria-hidden>
          {Array.from({ length: block.setCount }, (_, index) => (
            <div
              key={index}
              className={cx(
                'h-[5px] flex-1 rounded-full',
                index < completedSets ? 'bg-ink' : 'bg-ln2',
              )}
            />
          ))}
        </div>
      ) : null}
      {block.kind === 'exercise' && !block.imageUrl && block.searchName ? (
        <a
          href={googleImagesSearchUrl(block.searchName)}
          target="_blank"
          rel="noreferrer"
          className="px-1 pb-0.5 text-[11px] text-fnt underline"
        >
          Find form pics on Google Images ↗
        </a>
      ) : null}
    </article>
  );
}
