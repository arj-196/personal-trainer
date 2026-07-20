import { redirect } from 'next/navigation';

import { isAuthenticated } from '@/lib/server/auth';
import { Display, inputClass } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  if (await isAuthenticated()) {
    redirect('/');
  }

  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col justify-center gap-5 px-7 py-8">
      <div className="flex flex-col gap-1.5">
        <Display as="h1" className="text-[38px] leading-none">
          Personal
          <br />
          Trainer<span className="text-acc">.</span>
        </Display>
        <p className="m-0 text-[14px] text-mut">One athlete. One kitchen. No excuses.</p>
      </div>

      {params.error ? (
        <div
          role="alert"
          className="rounded-[14px] border border-err-line bg-err-soft px-3.5 py-3 text-[13px] leading-snug text-err"
        >
          That&apos;s not the shared login. Both fields, exactly as agreed.
        </div>
      ) : null}

      <form action="/api/login" method="post" className="flex flex-col gap-2.5">
        <input type="hidden" name="next" value={params.next ?? '/'} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-ink">Username</span>
          <input
            className={`${inputClass} h-12 rounded-[12px] border-ln2 bg-card px-3.5 text-[15px]`}
            name="username"
            type="text"
            placeholder="shared username"
            autoComplete="username"
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-ink">Password</span>
          <input
            className={`${inputClass} h-12 rounded-[12px] border-ln2 bg-card px-3.5 text-[15px]`}
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          type="submit"
          className="mt-1.5 h-[52px] cursor-pointer rounded-full border-none bg-ink font-display text-[16px] font-bold text-onink"
        >
          Let me in →
        </button>
        <p className="m-0 text-center text-[12px] text-fnt">
          Shared credentials — no signup, no strangers.
        </p>
      </form>
    </div>
  );
}
