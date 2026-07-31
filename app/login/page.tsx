import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { FormPendingNotice, PendingSubmitButton } from "@/app/pending-ui";
import { isAdminAuthenticated, isAdminConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  if (!isAdminConfigured()) {
    redirect("/setup");
  }

  if (await isAdminAuthenticated()) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="mb-8">
          <p className="mb-3 text-sm uppercase tracking-[0.28em] text-cyan-200/70">
            Social Media Automator
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Entrar no painel
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            O acesso usa o valor seguro de <code>ADMIN_PASSWORD</code> nas
            Environment Variables da Vercel.
          </p>
        </div>

        {params.error ? (
          <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            Senha incorreta.
          </div>
        ) : null}

        <form action={loginAction} className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-200">
              Senha de admin
            </span>
            <input
              autoFocus
              required
              name="password"
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-cyan-300/70 focus:ring-4 focus:ring-cyan-300/10"
            />
          </label>

          <PendingSubmitButton
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            pendingLabel="Entrando"
          >
            Entrar
          </PendingSubmitButton>
          <FormPendingNotice label="Validando acesso." />
        </form>
      </section>
    </main>
  );
}
