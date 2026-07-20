/**
 * Shared UI primitives for the Personal Trainer design system.
 * All colors come from the tokens in globals.css — never hard-code hexes in
 * screens; add a token or a variant here instead.
 */
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ---------------------------------- text --------------------------------- */

/** Uppercase section label, e.g. "TODAY", "WORKSPACES". */
export function Kicker({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('text-[11px] font-bold uppercase tracking-[1px] text-fnt', className)}>
      {children}
    </div>
  );
}

/** Display heading in Bricolage Grotesque. */
export function Display({
  className,
  children,
  as: Tag = 'h2',
}: {
  className?: string;
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'div';
}) {
  return <Tag className={cx('m-0 font-display font-extrabold leading-[1.05]', className)}>{children}</Tag>;
}

/* ---------------------------------- card ---------------------------------- */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cx('rounded-[20px] border border-ln bg-card', className)}>{children}</section>
  );
}

/* --------------------------------- buttons -------------------------------- */

export type ButtonVariant = 'ink' | 'accent' | 'soft' | 'outline' | 'ghost' | 'danger';

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  ink: 'bg-ink text-onink border border-transparent',
  accent: 'bg-acc text-white border border-transparent',
  soft: 'bg-acc-soft text-acc-deep border border-transparent',
  outline: 'bg-transparent text-ink border border-ln2',
  ghost: 'bg-transparent text-fnt border border-transparent underline',
  danger: 'bg-err text-white border border-transparent',
};

export function buttonClass(variant: ButtonVariant, extra?: string): string {
  return cx(
    'inline-flex cursor-pointer items-center justify-center rounded-full font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
    BUTTON_VARIANT_CLASSES[variant],
    extra,
  );
}

type ButtonBaseProps = {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
};

const BUTTON_SIZE_CLASSES = {
  sm: 'h-[34px] px-3.5 text-[12px]',
  md: 'h-[44px] px-4 text-[13.5px]',
  lg: 'h-[48px] px-5 font-display text-[15px]',
} as const;

export function Button({
  variant = 'ink',
  size = 'md',
  className,
  ...props
}: ButtonBaseProps & ComponentProps<'button'>) {
  return (
    <button
      {...props}
      className={buttonClass(variant, cx(BUTTON_SIZE_CLASSES[size], className))}
    />
  );
}

export function ButtonLink({
  variant = 'ink',
  size = 'md',
  className,
  ...props
}: ButtonBaseProps & ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={buttonClass(variant, cx(BUTTON_SIZE_CLASSES[size], className))}
    />
  );
}

/* ---------------------------------- chips --------------------------------- */

export type ChipTone = 'neutral' | 'accent' | 'teal' | 'gold' | 'vio' | 'err';

const CHIP_TONE_CLASSES: Record<ChipTone, string> = {
  neutral: 'bg-bg2 text-mut',
  accent: 'bg-acc-soft text-acc-deep',
  teal: 'bg-teal-soft text-teal-deep',
  gold: 'bg-gold-soft text-gold-deep',
  vio: 'bg-vio-soft text-vio-deep',
  err: 'bg-err-soft text-err',
};

export function Chip({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: ChipTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold',
        CHIP_TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ---------------------------------- forms --------------------------------- */

export const inputClass =
  'h-[42px] w-full rounded-[11px] border border-ln bg-bg2 px-3 text-[13.5px] text-ink placeholder:text-fnt';

export const textareaClass =
  'w-full resize-y rounded-[11px] border border-ln bg-bg2 px-3 py-2 text-[13.5px] text-ink placeholder:text-fnt';

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-[11.5px] font-semibold text-mut">{children}</div>;
}

/* ------------------------------ status pieces ----------------------------- */

/** Slim spinner ring used for in-flight states. */
export function Spinner({ tone = 'accent', className }: { tone?: 'accent' | 'gold'; className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'h-[18px] w-[18px] flex-none animate-spin-slim rounded-full border-[2.5px] border-t-transparent',
        tone === 'gold' ? 'border-gold' : 'border-acc',
        className,
      )}
    />
  );
}

/** Skeleton loading bar (shimmer). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'animate-skeleton rounded-[20px] border border-ln bg-[linear-gradient(90deg,var(--pt-card)_25%,var(--pt-bg2)_50%,var(--pt-card)_75%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

/** Standard error banner with optional retry — the app-wide error pattern. */
export function ErrorBanner({
  children,
  onRetry,
  retryLabel = 'Retry',
  className,
}: {
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cx(
        'flex items-center gap-2.5 rounded-[14px] border border-err-line bg-err-soft px-3.5 py-3',
        className,
      )}
    >
      <div className="flex-1 text-[12.5px] leading-snug text-err">{children}</div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-full border-none bg-ink px-3 py-1.5 text-[11px] font-bold text-onink"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

/** Dashed empty-state card. */
export function EmptyState({
  emoji,
  title,
  children,
  action,
  className,
}: {
  emoji?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center gap-2 rounded-[20px] border border-dashed border-ln2 bg-card px-5 py-6 text-center',
        className,
      )}
    >
      {emoji ? <div className="text-[26px]">{emoji}</div> : null}
      <Display as="div" className="text-[17px] font-bold">
        {title}
      </Display>
      {children ? <div className="text-[13px] leading-relaxed text-mut">{children}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
