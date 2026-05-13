import { redirect } from 'next/navigation';

import { isAuthenticated } from '@/lib/server/auth';

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
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_20px_45px_rgba(41,51,64,0.08)] backdrop-blur-xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#ff6359]">Private Access</p>
        <h1 className='m-0 font-["Avenir_Next_Condensed","Arial_Narrow",sans-serif] text-[clamp(2rem,10vw,3rem)] leading-[0.95] tracking-[-0.03em]'>
          Personal Trainer
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">
          Sign in with the shared app credentials defined in the environment.
        </p>
        {params.error ? (
          <p className="mt-4 rounded-2xl bg-[#ffe4df] px-4 py-3 text-sm text-[#8f2d1f]">{params.error}</p>
        ) : null}
        <form action="/api/login" method="post" className="mt-5 grid gap-4">
          <input type="hidden" name="next" value={params.next ?? '/'} />
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Username
            <input className="rounded-2xl border border-slate-300/70 px-4 py-3 font-normal" name="username" type="text" required />
          </label>
          <label className="grid gap-2 text-sm font-bold text-slate-800">
            Password
            <input className="rounded-2xl border border-slate-300/70 px-4 py-3 font-normal" name="password" type="password" required />
          </label>
          <button className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-gradient-to-br from-[#ff6a60] to-[#ff7f5d] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_24px_rgba(255,99,89,0.24)]" type="submit">
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}
