import { googleImagesSearchUrl, type WorkoutBlock } from '@/lib/workout-helpers';

type WorkoutBlockCardProps = {
  block: WorkoutBlock;
  checked?: boolean;
  onToggle?: (blockId: string) => void;
  display?: 'compact' | 'start';
};

function blockLabel(kind: WorkoutBlock['kind']): string {
  switch (kind) {
    case 'warmup':
      return 'Warm-up';
    case 'finisher':
      return 'Finisher';
    case 'recovery':
      return 'Recovery';
    default:
      return 'Exercise';
  }
}

function ImageSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 5h16v10H4V5Zm2 2v6h12V7H6Zm1.5 5 2.5-3 2 2.5 1.5-2 2.5 3.5h-8.5Zm8-3.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM15.5 16.5l4 4-1.5 1.5-4-4v-1.5h1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

const gradientByKind: Record<WorkoutBlock['kind'], string> = {
  exercise: 'bg-gradient-to-b from-white/96 to-slate-50/92',
  warmup: 'bg-gradient-to-b from-cyan-100/90 to-white/92',
  finisher: 'bg-gradient-to-b from-amber-100/90 to-white/92',
  recovery: 'bg-gradient-to-b from-violet-100/85 to-white/92',
};

const artByKind: Record<WorkoutBlock['kind'], string> = {
  exercise: 'bg-gradient-to-br from-white/70 to-white/40',
  warmup: 'bg-gradient-to-br from-cyan-300/30 to-white/45',
  finisher: 'bg-gradient-to-br from-amber-300/30 to-white/45',
  recovery: 'bg-gradient-to-br from-violet-300/25 to-white/45',
};

export function WorkoutBlockCard({
  block,
  checked = false,
  onToggle,
  display = 'compact',
}: WorkoutBlockCardProps) {
  const isStartView = display === 'start';
  const isCollapsedComplete = isStartView && checked;

  return (
    <article
      className={[
        'overflow-hidden rounded-[1.5rem] border border-white/85 shadow-[0_18px_34px_rgba(43,52,61,0.08)] transition',
        gradientByKind[block.kind],
        checked ? 'border-cyan-500/40 shadow-[0_16px_28px_rgba(34,184,199,0.12)]' : '',
        isCollapsedComplete
          ? 'grid grid-cols-1 border-emerald-600/35 bg-emerald-50/85 opacity-75 shadow-[0_8px_16px_rgba(53,153,101,0.12)]'
          : 'grid',
      ].join(' ')}
    >
      {!isCollapsedComplete ? (
        <div className="min-h-40 bg-gradient-to-br from-amber-100/65 to-cyan-100/70">
          {block.imageUrl ? (
            <img className="aspect-[16/11] h-full w-full object-cover" src={block.imageUrl} alt={block.name} />
          ) : (
            <div className={`grid min-h-40 place-items-center p-4 text-center text-sm font-bold uppercase tracking-[0.08em] text-slate-600 ${artByKind[block.kind]}`}>
              <span>{blockLabel(block.kind)}</span>
            </div>
          )}
        </div>
      ) : null}
      <div className={isCollapsedComplete ? 'grid gap-2 p-3 sm:px-4' : 'grid gap-2.5 p-4'}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <span className={`block text-[0.72rem] uppercase tracking-[0.1em] ${checked ? 'text-emerald-600' : 'text-slate-500'}`}>
            {blockLabel(block.kind)}
          </span>
          {onToggle ? (
            <label className={[
              'inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold',
              checked ? 'bg-cyan-500/15 text-cyan-800' : 'bg-slate-900/6 text-slate-600',
            ].join(' ')}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(block.id)}
                className="accent-cyan-500"
              />
              <span>{checked ? 'Done' : 'Mark done'}</span>
            </label>
          ) : null}
        </div>
        <h3 className={`m-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] leading-none tracking-[-0.03em] ${isCollapsedComplete ? 'text-[1.08rem]' : 'text-[1.3rem]'}`}>
          {block.name}
        </h3>
        {!isCollapsedComplete ? (
          <>
            <p className="m-0 text-[0.98rem] font-bold leading-[1.42] text-slate-900">{block.prescription}</p>
            {block.notes ? <p className="m-0 text-sm leading-relaxed text-slate-500">{block.notes}</p> : null}
            <div className="mt-1 flex flex-wrap gap-2">
              {block.kind === 'exercise' && block.searchName ? (
                isStartView ? (
                  <a
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300/60 bg-white/75 px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:-translate-y-0.5"
                    href={googleImagesSearchUrl(block.searchName)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Images
                  </a>
                ) : (
                  <a
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/60 bg-white/80 text-slate-900 transition hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(43,52,61,0.1)]"
                    href={googleImagesSearchUrl(block.searchName)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Search Google Images for ${block.searchName}`}
                  >
                    <ImageSearchIcon />
                  </a>
                )
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}
