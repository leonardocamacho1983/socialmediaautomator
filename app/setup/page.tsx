import Link from "next/link";
import { getAdminConfigStatus } from "@/lib/auth";
import { getZernioConfigStatus } from "@/lib/zernio";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const admin = getAdminConfigStatus();
  const zernio = getZernioConfigStatus();
  const ready = admin.hasAdminPassword && zernio.hasApiKey;

  return (
    <main className="min-h-screen px-6 py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/30 backdrop-blur">
        <p className="mb-3 text-sm uppercase tracking-[0.28em] text-cyan-200/70">
          Configuração
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Variáveis necessárias
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          O app só libera o painel quando existe uma senha de admin. A chave da
          Zernio fica sempre server-side.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <StatusCard
            label="ZERNIO_API_KEY"
            ok={zernio.hasApiKey}
            description="Chave server-side usada para chamar a API da Zernio."
          />
          <StatusCard
            label="ADMIN_PASSWORD"
            ok={admin.hasAdminPassword}
            description="Senha que protege o painel e as rotas internas."
          />
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
          <h2 className="font-medium text-white">Na Vercel</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
            <li>Abra o projeto na Vercel.</li>
            <li>Vá em Settings → Environment Variables.</li>
            <li>
              Adicione <code>ZERNIO_API_KEY</code> e{" "}
              <code>ADMIN_PASSWORD</code>.
            </li>
            <li>Faça redeploy.</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {ready ? (
            <Link
              href="/login"
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
            >
              Ir para login
            </Link>
          ) : null}
          <a
            href="https://docs.zernio.com/"
            target="_blank"
            rel="noreferrer"
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Docs da Zernio
          </a>
        </div>
      </section>
    </main>
  );
}

function StatusCard({
  label,
  ok,
  description,
}: {
  label: string;
  ok: boolean;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
      <div className="flex items-center justify-between gap-4">
        <code className="text-sm text-zinc-100">{label}</code>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            ok
              ? "bg-emerald-400/15 text-emerald-200"
              : "bg-amber-400/15 text-amber-200"
          }`}
        >
          {ok ? "configurada" : "pendente"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
    </div>
  );
}
