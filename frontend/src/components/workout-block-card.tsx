import Link from 'next/link';

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

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 5.5A2.5 2.5 0 0 1 8.5 3H19v15H8.5A2.5 2.5 0 0 0 6 20.5V5.5Zm0 15a2.5 2.5 0 0 1 2.5-2.5H19V21H8.5A2.5 2.5 0 0 1 6 18.5v2Z"
        fill="currentColor"
      />
    </svg>
  );
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

export function WorkoutBlockCard({
  block,
  checked = false,
  onToggle,
  display = 'compact',
}: WorkoutBlockCardProps) {
  const libraryHref = block.kind === 'exercise' ? `/library?q=${encodeURIComponent(block.name)}` : null;
  const isStartView = display === 'start';
  const isCollapsedComplete = isStartView && checked;

  return (
    <article
      className={[
        'workout-block-card',
        `workout-block-${block.kind}`,
        `workout-block-display-${display}`,
        checked ? 'is-complete' : '',
        isCollapsedComplete ? 'is-complete-collapsed' : '',
      ].join(' ')}
    >
      {!isCollapsedComplete ? (
        <div className="workout-block-media">
          {block.imageUrl ? (
            <img className="workout-block-image" src={block.imageUrl} alt={block.name} />
          ) : (
            <div className={`workout-block-art workout-block-art-${block.kind}`}>
              <span>{blockLabel(block.kind)}</span>
            </div>
          )}
        </div>
      ) : null}
      <div className="workout-block-body">
        <div className="workout-block-topline">
          <span className="workout-block-eyebrow">{blockLabel(block.kind)}</span>
          {onToggle ? (
            <label className={`completion-toggle ${checked ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(block.id)}
              />
              <span>{checked ? 'Done' : 'Mark done'}</span>
            </label>
          ) : null}
        </div>
        <h3 className="workout-block-title">{block.name}</h3>
        {!isCollapsedComplete ? (
          <>
            <p className="workout-block-prescription">{block.prescription}</p>
            {block.notes ? <p className="workout-block-notes">{block.notes}</p> : null}
            <div className="workout-block-actions">
              {libraryHref ? (
                isStartView ? (
                  <Link className="soft-action" href={libraryHref}>
                    Open library
                  </Link>
                ) : (
                  <Link className="compact-icon-action" href={libraryHref} aria-label={`Open ${block.name} in library`}>
                    <LibraryIcon />
                  </Link>
                )
              ) : null}
              {block.kind === 'exercise' && block.searchName ? (
                isStartView ? (
                  <a
                    className="soft-action"
                    href={googleImagesSearchUrl(block.searchName)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Images
                  </a>
                ) : (
                  <a
                    className="compact-icon-action"
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
