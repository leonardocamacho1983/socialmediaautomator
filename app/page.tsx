import {
  BookOpen,
  AlertTriangle,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CheckCircle2,
  Sparkles,
  Loader2,
  Upload,
  Send,
  Trash2,
} from "lucide-react";
import {
  createPostAction,
  createBrandReferenceAction,
  generateEditorialPlanAction,
  logoutAction,
  uploadBrandAssetAction,
  updateExistingPostAction,
} from "@/app/actions";
import { requireAdminPage } from "@/lib/auth";
import { getEditorialStatus, type EditorialStatus } from "@/lib/editorial-store";
import { getGroqConfigStatus } from "@/lib/groq";
import { getPexelsConfigStatus } from "@/lib/pexels";
import type { SocialAccount, ZernioPost } from "@/lib/types";
import {
  getReadableZernioError,
  getZernioConfigStatus,
  listPosts,
  listSupportedAccounts,
} from "@/lib/zernio";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

type LoadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function load<T>(promise: Promise<T>): Promise<LoadResult<T>> {
  try {
    return { ok: true, data: await promise };
  } catch (error) {
    return { ok: false, error: getReadableZernioError(error) };
  }
}

export default async function DashboardPage({ searchParams }: PageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const zernioConfig = getZernioConfigStatus();
  const groqConfig = getGroqConfigStatus();
  const pexelsConfig = getPexelsConfigStatus();
  const [accountsResult, postsResult] = await Promise.all([
    load(listSupportedAccounts()),
    load(listPosts({ limit: 50 })),
  ]);
  const editorialResult = await load(getEditorialStatus());

  const accounts = accountsResult.ok ? accountsResult.data.accounts : [];
  const posts = postsResult.ok ? postsResult.data.posts : [];
  const stats = getStats(posts);

  return (
    <main className="min-h-screen px-5 py-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col justify-between gap-5 rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.28em] text-cyan-200/70">
              Social Media Automator
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Instagram + LinkedIn via Zernio
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              Crie rascunhos, aprove manualmente, agende ou publique. Todas as
              chamadas à Zernio rodam no servidor e usam idempotência por
              request para reduzir risco de duplicata.
            </p>
          </div>
          <form action={logoutAction}>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/webhooks/zernio/self-test"
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-cyan-300/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
              >
                Testar webhook
              </a>
              <button
                type="submit"
                className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-white/10"
              >
                Sair
              </button>
            </div>
          </form>
        </header>

        {params.notice ? (
          <Banner tone="success">{decodeURIComponent(params.notice)}</Banner>
        ) : null}

        {params.error ? (
          <Banner tone="error">{decodeURIComponent(params.error)}</Banner>
        ) : null}

        {!zernioConfig.hasApiKey ? (
          <Banner tone="warning">
            ZERNIO_API_KEY não está configurada. O painel carrega, mas ações
            reais de conta/post não funcionarão até configurar a variável.
          </Banner>
        ) : null}

        {!accountsResult.ok ? (
          <Banner tone="error">
            Não consegui listar contas da Zernio: {accountsResult.error}
          </Banner>
        ) : null}

        {!postsResult.ok ? (
          <Banner tone="error">
            Não consegui listar posts da Zernio: {postsResult.error}
          </Banner>
        ) : null}

        {!editorialResult.ok ? (
          <Banner tone="error">
            Não consegui acessar o Supabase: {editorialResult.error}
          </Banner>
        ) : null}

        <section className="grid gap-4 md:grid-cols-5">
          <StatCard label="Rascunhos" value={stats.draft} />
          <StatCard label="Agendados" value={stats.scheduled} />
          <StatCard label="Publicando" value={stats.publishing} />
          <StatCard label="Publicados" value={stats.published} />
          <StatCard label="Falhas" value={stats.failed} tone="danger" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <CreatePostPanel accounts={accounts} />
          <AccountsPanel accounts={accounts} />
        </section>

        <EditorialPanel
          status={
            editorialResult.ok
              ? editorialResult.data
              : {
                  configured: false,
                  counts: {
                    brandProfiles: 0,
                    personas: 0,
                    contentPillars: 0,
                    calendarItems: 0,
                    postDrafts: 0,
                    mediaAssets: 0,
                    brandAssets: 0,
                    brandReferences: 0,
                    zernioEvents: 0,
                  },
                  recentEvents: [],
                  recentDrafts: [],
                  recentBrandAssets: [],
                  recentBrandReferences: [],
                }
          }
          groqReady={groqConfig.hasApiKey}
          pexelsReady={pexelsConfig.hasApiKey}
        />

        <PostsPanel posts={posts} />
      </div>
    </main>
  );
}

function getStats(posts: ZernioPost[]) {
  return posts.reduce(
    (acc, post) => {
      if (post.status in acc) {
        acc[post.status as keyof typeof acc] += 1;
      }

      return acc;
    },
    {
      draft: 0,
      scheduled: 0,
      publishing: 0,
      published: 0,
      failed: 0,
      partial: 0,
      cancelled: 0,
    },
  );
}

function Banner({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "error";
}) {
  const styles = {
    success: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    warning: "border-amber-400/30 bg-amber-500/10 text-amber-100",
    error: "border-red-400/30 bg-red-500/10 text-red-100",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5">
      <p
        className={`text-sm ${
          tone === "danger" ? "text-red-200/80" : "text-zinc-400"
        }`}
      >
        {label}
      </p>
      <p className="mt-4 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function CreatePostPanel({ accounts }: { accounts: SocialAccount[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Novo post</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Use URLs públicas de mídia. Upload direto para a Zernio pode entrar na
          próxima etapa.
        </p>
      </div>

      <form action={createPostAction} className="space-y-4">
        <Field label="Título interno">
          <input
            name="title"
            placeholder="Ex: Post sobre lançamento"
            className="input"
          />
        </Field>

        <Field label="Texto / legenda">
          <textarea
            required
            name="content"
            rows={7}
            placeholder="Escreva o conteúdo principal..."
            className="input"
          />
        </Field>

        <Field label="URLs de mídia, uma por linha">
          <textarea
            name="mediaUrls"
            rows={3}
            placeholder="https://..."
            className="input"
          />
        </Field>

        <Field label="Primeiro comentário opcional">
          <textarea
            name="firstComment"
            rows={2}
            placeholder="Bom para links no LinkedIn e Instagram."
            className="input"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Agendamento">
            <input name="scheduledFor" type="datetime-local" className="input" />
          </Field>
          <Field label="Timezone">
            <input
              name="timezone"
              defaultValue="America/Sao_Paulo"
              className="input"
            />
          </Field>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-zinc-200">Contas</p>
          {accounts.length ? (
            <div className="space-y-2">
              {accounts.map((account) => (
                <label
                  key={account._id}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-200 transition hover:bg-white/10"
                >
                  <input
                    name="targets"
                    type="checkbox"
                    value={`${account.platform}:${account._id}`}
                    className="size-4 accent-cyan-300"
                  />
                  <PlatformIcon platform={account.platform} />
                  <span className="flex-1">
                    {account.displayName || account.username || account._id}
                  </span>
                  <span className="text-xs text-zinc-500">{account.platform}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              Nenhuma conta Instagram/LinkedIn conectada foi encontrada na
              Zernio.
            </p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <SubmitButton intent="draft" label="Salvar rascunho" />
          <SubmitButton intent="schedule" label="Agendar" />
          <SubmitButton intent="publish" label="Publicar agora" strong />
        </div>
      </form>
    </section>
  );
}

function AccountsPanel({ accounts }: { accounts: SocialAccount[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Contas conectadas</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            A lista vem de <code>GET /v1/accounts</code> e filtra Instagram +
            LinkedIn.
          </p>
        </div>
        <span className="rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          {accounts.length} contas
        </span>
      </div>

      {accounts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {accounts.map((account) => (
            <article
              key={account._id}
              className="rounded-2xl border border-white/10 bg-black/25 p-4"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-white/10">
                  <PlatformIcon platform={account.platform} />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-white">
                    {account.displayName || account.username || "Conta sem nome"}
                  </h3>
                  <p className="truncate text-xs text-zinc-500">{account._id}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill ok={account.isActive}>
                  {account.isActive ? "ativa" : "inativa"}
                </StatusPill>
                {account.needsReconnection ? (
                  <StatusPill ok={false}>reconectar</StatusPill>
                ) : null}
                {typeof account.followersCount === "number" ? (
                  <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300">
                    {account.followersCount.toLocaleString("pt-BR")} seguidores
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Conecte as contas na Zernio"
          description="Depois do OAuth, elas aparecem aqui automaticamente."
        />
      )}
    </section>
  );
}

function EditorialPanel({
  status,
  groqReady,
  pexelsReady,
}: {
  status: EditorialStatus;
  groqReady: boolean;
  pexelsReady: boolean;
}) {
  return (
    <section id="motor-editorial" className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Motor editorial
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Fluxo prático: primeiro organize a base da marca, depois gere
            calendário/drafts, revise e só então publique pela Zernio.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill ok={status.configured}>
            {status.configured ? "Supabase conectado" : "Supabase pendente"}
          </StatusPill>
          <StatusPill ok={groqReady}>
            {groqReady ? "Groq conectado" : "Groq pendente"}
          </StatusPill>
          <StatusPill ok={pexelsReady}>
            {pexelsReady ? "Pexels conectado" : "Pexels pendente"}
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
        <MiniMetric label="Perfis" value={status.counts.brandProfiles} />
        <MiniMetric label="Personas" value={status.counts.personas} />
        <MiniMetric label="Pilares" value={status.counts.contentPillars} />
        <MiniMetric label="Calendário" value={status.counts.calendarItems} />
        <MiniMetric label="Drafts" value={status.counts.postDrafts} />
        <MiniMetric label="Marca" value={status.counts.brandAssets} />
        <MiniMetric label="Links" value={status.counts.brandReferences} />
        <MiniMetric label="Mídia" value={status.counts.mediaAssets} />
        <MiniMetric label="Webhooks" value={status.counts.zernioEvents} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <a href="#base-marca" className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/10">
          <p className="text-sm font-semibold text-white">1. Base da marca</p>
          <p className="mt-1 text-xs text-zinc-500">Arquivos e links.</p>
        </a>
        <a href="#gerar-calendario" className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/10">
          <p className="text-sm font-semibold text-white">2. Gerar posts</p>
          <p className="mt-1 text-xs text-zinc-500">Briefing → drafts.</p>
        </a>
        <a href="#drafts-gerados" className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/10">
          <p className="text-sm font-semibold text-white">3. Revisar</p>
          <p className="mt-1 text-xs text-zinc-500">Últimos drafts.</p>
        </a>
        <a href="#zernio-eventos" className="rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:bg-white/10">
          <p className="text-sm font-semibold text-white">4. Publicação</p>
          <p className="mt-1 text-xs text-zinc-500">Eventos Zernio.</p>
        </a>
      </div>

      <div id="base-marca" className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 scroll-mt-6">
        <h3 className="font-medium text-white">Base da marca</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Suba arquivos proprietários ou salve links externos como design
          system, Figma, Canva, site e brand book.
        </p>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <form
          action={uploadBrandAssetAction}
          className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
          encType="multipart/form-data"
        >
          <div>
            <h4 className="font-medium text-white">Subir arquivo</h4>
            <p className="mt-1 text-xs text-zinc-500">
              Aceita imagens, vídeos, PDF e HTML.
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
            <Field label="Arquivo">
              <input
                required
                name="file"
                type="file"
                accept="image/*,video/mp4,video/quicktime,application/pdf,text/html,.html,.htm"
                className="input"
              />
            </Field>
            <Field label="Tipo">
              <select name="type" defaultValue="photo" className="input">
                <option value="logo">Logo</option>
                <option value="photo">Foto</option>
                <option value="product">Produto</option>
                <option value="screenshot">Screenshot</option>
                <option value="template">Template</option>
                <option value="background">Fundo</option>
                <option value="reference">Referência</option>
                <option value="other">Outro</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Título">
              <input
                name="title"
                placeholder="Ex: Logo principal, foto fundador, capa carrossel..."
                className="input"
              />
            </Field>
            <Field label="Tags separadas por vírgula">
              <input
                name="tags"
                placeholder="logo, claro, institucional"
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Descrição">
              <textarea
                name="description"
                rows={3}
                placeholder="O que é este asset."
                className="input"
              />
            </Field>
            <Field label="Notas de uso">
              <textarea
                name="usageNotes"
                rows={3}
                placeholder="Quando usar, quando evitar, restrições."
                className="input"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <Upload className="size-4" />
            Subir asset da marca
          </button>
        </form>

        <form
          action={createBrandReferenceAction}
          className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div>
            <h4 className="font-medium text-white">Adicionar link</h4>
            <p className="mt-1 text-xs text-zinc-500">
              Melhor opção para design system publicado, Figma, Canva ou site.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
            <Field label="URL">
              <input
                required
                name="url"
                type="url"
                placeholder="https://..."
                className="input"
              />
            </Field>
            <Field label="Tipo">
              <select name="type" defaultValue="design_system" className="input">
                <option value="design_system">Design system</option>
                <option value="brand_book">Brand book</option>
                <option value="figma">Figma</option>
                <option value="canva">Canva</option>
                <option value="landing_page">Landing page</option>
                <option value="site">Site</option>
                <option value="reference">Referência</option>
                <option value="other">Outro</option>
              </select>
            </Field>
          </div>

          <Field label="Título">
            <input
              name="title"
              placeholder="Ex: Design system oficial"
              className="input"
            />
          </Field>

          <Field label="Tags separadas por vírgula">
            <input
              name="tags"
              placeholder="design-system, identidade, componentes"
              className="input"
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Descrição">
              <textarea name="description" rows={3} className="input" />
            </Field>
            <Field label="Notas de uso">
              <textarea name="usageNotes" rows={3} className="input" />
            </Field>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10"
          >
            <BookOpen className="size-4" />
            Salvar link de referência
          </button>
        </form>
        </div>

        {status.recentBrandAssets.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {status.recentBrandAssets.map((asset) => (
              <article
                key={asset.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300">
                    {asset.type}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {formatDate(asset.created_at)}
                  </span>
                </div>
                <h4 className="line-clamp-2 font-medium text-white">
                  {asset.title}
                </h4>
                <p className="mt-2 truncate font-mono text-xs text-zinc-600">
                  {asset.storage_path}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-zinc-400">
            Nenhum asset proprietário salvo ainda.
          </p>
        )}

        {status.recentBrandReferences.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {status.recentBrandReferences.map((reference) => (
              <a
                key={reference.id}
                href={reference.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-cyan-300/10 bg-cyan-300/[0.04] p-4 transition hover:bg-cyan-300/10"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                    {reference.type}
                  </span>
                  <span className="text-xs text-zinc-600">
                    {formatDate(reference.created_at)}
                  </span>
                </div>
                <h4 className="line-clamp-2 font-medium text-white">
                  {reference.title}
                </h4>
                <p className="mt-2 truncate text-xs text-zinc-500">
                  {reference.url}
                </p>
              </a>
            ))}
          </div>
        ) : null}
      </div>

      <div id="gerar-calendario" className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 scroll-mt-6">
        <h3 className="font-medium text-white">Gerar calendário automático</h3>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Salva o briefing, cria itens de calendário e drafts no Supabase. Não
          publica nada automaticamente.
        </p>

        <form action={generateEditorialPlanAction} className="mt-5 grid gap-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Nome do negócio">
              <input
                required
                name="businessName"
                placeholder="Ex: Aurora, Aplify, consultoria..."
                className="input"
              />
            </Field>
            <Field label="Início do calendário">
              <input
                name="startDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="input"
              />
            </Field>
          </div>

          <Field label="Ideia do negócio">
            <textarea
              required
              name="businessIdea"
              rows={3}
              placeholder="O que é, para quem existe e por que importa."
              className="input"
            />
          </Field>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Proposta de valor">
              <textarea
                required
                name="valueProposition"
                rows={4}
                placeholder="Qual transformação você entrega."
                className="input"
              />
            </Field>
            <Field label="Produto / escopo">
              <textarea
                name="productScope"
                rows={4}
                placeholder="O que está dentro e fora da oferta."
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Público-alvo">
              <textarea
                required
                name="targetAudience"
                rows={4}
                placeholder="Quem queremos atrair."
                className="input"
              />
            </Field>
            <Field label="Personas">
              <textarea
                name="personas"
                rows={4}
                placeholder="Perfis, desejos, objeções, linguagem."
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Dores e remédio">
              <textarea
                name="painsAndRemedies"
                rows={4}
                placeholder="Dores específicas e como o produto resolve."
                className="input"
              />
            </Field>
            <Field label="Design system / tom visual">
              <textarea
                name="designSystem"
                rows={4}
                placeholder="Cores, estilo, estética, restrições visuais."
                className="input"
              />
            </Field>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
            <Field label="Tom de voz">
              <input
                name="toneOfVoice"
                placeholder="Ex: direto, sofisticado, provocativo, humano..."
                className="input"
              />
            </Field>
            <Field label="Quantidade">
              <input
                name="postsCount"
                type="number"
                min={1}
                max={14}
                defaultValue={6}
                className="input"
              />
            </Field>
          </div>

          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-100"
          >
            <Sparkles className="size-4" />
            Gerar calendário e drafts
          </button>
        </form>
      </div>

      <div id="drafts-gerados" className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 scroll-mt-6">
        <h3 className="font-medium text-white">Últimos drafts gerados</h3>
        {status.recentDrafts.length ? (
          <div className="mt-4 divide-y divide-white/10">
            {status.recentDrafts.map((draft) => (
              <div
                key={draft.id}
                className="grid gap-2 py-3 text-sm text-zinc-300 lg:grid-cols-[1fr_120px_120px_180px]"
              >
                <span className="font-medium text-white">{draft.title}</span>
                <span>{draft.platform}</span>
                <PostStatusPill status={draft.status} />
                <span className="text-zinc-500">
                  {formatDate(draft.created_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Nenhum draft gerado ainda.
          </p>
        )}
      </div>

      <div id="zernio-eventos" className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4 scroll-mt-6">
        <h3 className="font-medium text-white">Últimos eventos da Zernio</h3>
        {status.recentEvents.length ? (
          <div className="mt-4 divide-y divide-white/10">
            {status.recentEvents.map((event) => (
              <div
                key={event.id}
                className="grid gap-2 py-3 text-sm text-zinc-300 lg:grid-cols-[180px_1fr_180px]"
              >
                <span className="font-medium text-white">{event.event_type}</span>
                <span className="truncate font-mono text-xs text-zinc-500">
                  {event.zernio_post_id || event.event_id || event.id}
                </span>
                <span className="text-zinc-500">
                  {formatDate(event.received_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-400">
            Nenhum evento persistido ainda. O botão “Testar webhook” deve gravar
            o primeiro registro.
          </p>
        )}
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function PostsPanel({ posts }: { posts: ZernioPost[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Posts na Zernio</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Rascunhos, agendados, publicados e falhas. Ações destrutivas só
          aparecem quando a Zernio permite editar/remover aquele status.
        </p>
      </div>

      {posts.length ? (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="hidden grid-cols-[1fr_150px_180px_190px] border-b border-white/10 bg-white/[0.04] px-4 py-3 text-xs uppercase tracking-[0.18em] text-zinc-500 lg:grid">
            <span>Post</span>
            <span>Status</span>
            <span>Agendamento</span>
            <span>Ações</span>
          </div>
          <div className="divide-y divide-white/10">
            {posts.map((post) => (
              <PostRow key={post._id} post={post} />
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Nenhum post encontrado"
          description="Crie um rascunho ou agende o primeiro post pelo painel."
        />
      )}
    </section>
  );
}

function PostRow({ post }: { post: ZernioPost }) {
  const canPublish = ["draft", "failed", "partial"].includes(post.status);
  const canDelete = ["draft", "scheduled", "failed"].includes(post.status);

  return (
    <article className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_150px_180px_190px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium text-white">
            {post.title || "Post sem título"}
          </h3>
          {post.platforms?.map((target) => (
            <span
              key={`${post._id}-${target.platform}-${target.accountId}`}
              className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300"
            >
              <PlatformIcon platform={target.platform} small />
              {target.platform}
            </span>
          ))}
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
          {post.content || "Sem texto."}
        </p>
        <p className="mt-2 font-mono text-xs text-zinc-600">{post._id}</p>
      </div>

      <div>
        <PostStatusPill status={post.status} />
      </div>

      <div className="text-sm text-zinc-400">
        {post.scheduledFor ? formatDate(post.scheduledFor) : "—"}
      </div>

      <div className="flex flex-col gap-2">
        {canPublish ? (
          <form action={updateExistingPostAction} className="grid gap-2">
            <input type="hidden" name="postId" value={post._id} />
            <input
              name="scheduledFor"
              type="datetime-local"
              className="input !px-3 !py-2 text-xs"
            />
            <input
              type="hidden"
              name="timezone"
              value={post.timezone || "America/Sao_Paulo"}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                name="intent"
                value="schedule"
                className="action-button"
              >
                <CalendarClock className="size-3.5" />
                Agendar
              </button>
              <button
                type="submit"
                name="intent"
                value="publish"
                className="action-button"
              >
                <Send className="size-3.5" />
                Publicar
              </button>
            </div>
          </form>
        ) : null}

        {canDelete ? (
          <form action={updateExistingPostAction}>
            <input type="hidden" name="postId" value={post._id} />
            <button
              type="submit"
              name="intent"
              value="delete"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/20 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" />
              Remover
            </button>
          </form>
        ) : null}
      </div>
    </article>
  );
}

function SubmitButton({
  intent,
  label,
  strong = false,
}: {
  intent: string;
  label: string;
  strong?: boolean;
}) {
  return (
    <button
      type="submit"
      name="intent"
      value={intent}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
        strong
          ? "bg-white text-zinc-950 hover:bg-cyan-100"
          : "border border-white/10 text-white hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-200">
        {label}
      </span>
      {children}
    </label>
  );
}

function PlatformIcon({
  platform,
  small = false,
}: {
  platform: string;
  small?: boolean;
}) {
  const className = small ? "size-3.5" : "size-5";

  if (platform === "instagram") {
    return <Camera className={className} />;
  }

  if (platform === "linkedin") {
    return <BriefcaseBusiness className={className} />;
  }

  return <Send className={className} />;
}

function PostStatusPill({ status }: { status: string }) {
  const style =
    status === "published"
      ? "bg-emerald-400/15 text-emerald-200"
      : status === "failed"
        ? "bg-red-400/15 text-red-200"
        : status === "scheduled"
          ? "bg-cyan-400/15 text-cyan-200"
          : status === "publishing"
            ? "bg-violet-400/15 text-violet-200"
            : "bg-white/10 text-zinc-300";

  const icon =
    status === "published" ? (
      <CheckCircle2 className="size-3.5" />
    ) : status === "failed" ? (
      <AlertTriangle className="size-3.5" />
    ) : status === "publishing" ? (
      <Loader2 className="size-3.5" />
    ) : null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${style}`}
    >
      {icon}
      {status}
    </span>
  );
}

function StatusPill({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        ok
          ? "bg-emerald-400/15 text-emerald-200"
          : "bg-red-400/15 text-red-200"
      }`}
    >
      {children}
    </span>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400">{description}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
