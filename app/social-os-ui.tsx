import { bootstrapSocialOsFoundationAction } from "@/app/actions";
import { AppLink, FormPendingNotice, PendingSubmitButton } from "@/app/pending-ui";
import { SOCIAL_OS_PHASES } from "@/lib/social-os/constants";
import type { SocialOsStatus } from "@/lib/social-os/types";

type LegacySnapshot = {
  ideas: number;
  drafts: number;
  brandAssets: number;
  zernioEvents: number;
  scheduledPosts: number;
  accounts: number;
};

type SocialOsOverviewProps = {
  status: SocialOsStatus;
  legacy: LegacySnapshot;
  groqReady: boolean;
  pexelsReady: boolean;
  zernioReady: boolean;
};

export function SocialOsOverview({
  status,
  legacy,
  groqReady,
  pexelsReady,
  zernioReady,
}: SocialOsOverviewProps) {
  return (
    <>
      <section className="border-b border-white/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/80">
          Social Creative OS
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.6fr)]">
          <div>
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Inteligencia editorial, producao criativa e engajamento em um fluxo rastreavel.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
              A fase 1 cria a fundacao: marca, audiencia, estrategia,
              campanhas, conceitos, politicas e decision traces. Publicacao,
              webhooks e assets existentes seguem preservados.
            </p>
          </div>
          <FoundationStatusCard status={status} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Business" value={status.counts.business_profiles ?? 0} />
        <Metric label="Brand DNA" value={status.counts.brand_dna ?? 0} />
        <Metric label="Audiencias" value={status.counts.audience_segments ?? 0} />
        <Metric label="Campanhas" value={status.counts.campaigns ?? 0} />
        <Metric label="Variantes" value={status.counts.creative_variants ?? 0} />
        <Metric label="Traces" value={status.counts.decision_traces ?? 0} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.5fr)]">
        <div>
          <h2 className="text-xl font-semibold text-white">Fases do sistema</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {SOCIAL_OS_PHASES.map((phase) => (
              <AppLink
                key={phase.id}
                href={phase.route}
                pendingLabel={`Abrindo ${phase.label}`}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:border-teal-300/40 hover:bg-white/[0.07]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-white">{phase.label}</p>
                  <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-300">
                    {phase.status === "in_progress" ? "fase 1" : "preparado"}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {getPhaseDescription(phase.id)}
                </p>
              </AppLink>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">Operacao preservada</h2>
          <div className="mt-4 grid gap-3">
            <LegacyMetric label="Ideias legadas" value={legacy.ideas} href="/ideias" />
            <LegacyMetric label="Drafts legados" value={legacy.drafts} href="/criacao" />
            <LegacyMetric label="Assets da marca" value={legacy.brandAssets} href="/marca" />
            <LegacyMetric label="Webhooks Zernio" value={legacy.zernioEvents} href="/sistema" />
            <LegacyMetric label="Posts agendados" value={legacy.scheduledPosts} href="/publicacao" />
            <LegacyMetric label="Contas conectadas" value={legacy.accounts} href="/publicacao" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
        <IntegrationPanel
          groqReady={groqReady}
          pexelsReady={pexelsReady}
          zernioReady={zernioReady}
          migrationReady={status.migrationReady}
        />
        <DecisionTracePanel status={status} />
      </section>
    </>
  );
}

export function SocialOsDomainContent({
  domain,
  status,
}: {
  domain: "strategy" | "campaigns" | "concepts" | "production" | "engagement" | "learning";
  status: SocialOsStatus;
}) {
  const config = DOMAIN_CONFIG[domain];

  return (
    <>
      <section className="border-b border-white/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200/80">
          {config.eyebrow}
        </p>
        <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
          {config.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300">
          {config.description}
        </p>
      </section>

      {domain === "strategy" ? <FoundationBootstrapForm status={status} /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {config.modules.map((module) => (
          <div key={module.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="font-semibold text-white">{module.title}</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{module.body}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        {config.tables.map((table) => (
          <Metric key={table} label={table.replaceAll("_", " ")} value={status.counts[table] ?? 0} />
        ))}
      </section>
    </>
  );
}

function FoundationBootstrapForm({ status }: { status: SocialOsStatus }) {
  const missingFoundationTables = getMissingFoundationTables(status.counts);
  const hasBusinessProfile = (status.counts.business_profiles ?? 0) > 0;
  const isComplete = missingFoundationTables.length === 0;
  const isPartial = hasBusinessProfile && !isComplete;
  const canSubmit = status.configured && status.migrationReady && !isComplete;
  const statusLabel = isComplete
    ? "completa"
    : isPartial
      ? "parcial"
      : "pendente";

  if (isComplete) {
    return (
      <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Fundacao criada
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/80">
              Business Profile, Brand DNA, perfil de escrita, sistema visual,
              audiencia, estrategia, campanha piloto, politica de engajamento e
              decision trace ja existem.
            </p>
          </div>
          <span className="rounded-md border border-emerald-300/20 px-3 py-1 text-sm text-emerald-50">
            completa
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <AppLink
            href="/campanhas"
            pendingLabel="Abrindo Campanhas"
            className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-100"
          >
            Continuar para campanhas
          </AppLink>
          <AppLink
            href="/conceitos"
            pendingLabel="Abrindo Conceitos"
            className="rounded-lg border border-emerald-300/25 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-300/10"
          >
            Ver conceitos criativos
          </AppLink>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h2 className="text-lg font-semibold text-white">Bootstrap da fundacao</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Cria Business Profile, Brand DNA inicial, perfil de escrita,
            sistema visual, audiencia, estrategia, campanha piloto, politica de
            engajamento e primeiro decision trace.
          </p>
        </div>
        <span className="rounded-md border border-white/10 px-3 py-1 text-sm text-zinc-300">
          {statusLabel}
        </span>
      </div>

      {isPartial ? (
        <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
          A fundacao esta parcial. Ja existe Business Profile, mas ainda falta:
          {" "}
          {missingFoundationTables
            .map((table) => FOUNDATION_TABLE_LABELS[table] ?? table)
            .join(", ")}
          . O botao abaixo completa o que falta sem duplicar o que ja existe.
        </div>
      ) : null}

      <form action={bootstrapSocialOsFoundationAction} className="mt-5 grid gap-3 lg:grid-cols-2">
        <label className="grid gap-2 text-sm text-zinc-300">
          Nome do negocio
          <input name="businessName" className="input" placeholder="Falay" />
        </label>
        <label className="grid gap-2 text-sm text-zinc-300">
          Objetivo estrategico
          <select name="strategicObjective" className="input" defaultValue="conversation">
            <option value="awareness">Alcance</option>
            <option value="trust">Autoridade</option>
            <option value="conversation">Conversa</option>
            <option value="lead_capture">Captura de lead</option>
            <option value="conversion">Conversao</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm text-zinc-300 lg:col-span-2">
          Resumo do negocio
          <textarea name="businessSummary" className="input min-h-24" placeholder="O que a empresa faz, para quem e por que importa." />
        </label>
        <label className="grid gap-2 text-sm text-zinc-300">
          Proposta de valor
          <textarea name="valueProposition" className="input min-h-24" placeholder="Qual transformacao concreta a marca promete." />
        </label>
        <label className="grid gap-2 text-sm text-zinc-300">
          Audiencia principal
          <textarea name="targetAudience" className="input min-h-24" placeholder="Quem precisa reconhecer essa narrativa." />
        </label>
        <div className="lg:col-span-2">
          <PendingSubmitButton
            type="submit"
            className="rounded-lg border border-teal-300/30 bg-teal-300/10 px-4 py-3 text-sm font-semibold text-teal-100 transition hover:bg-teal-300/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit}
            pendingLabel={isPartial ? "Completando fundacao" : "Inicializando fundacao"}
          >
            {isPartial ? "Completar fundacao" : "Inicializar fundacao"}
          </PendingSubmitButton>
          <FormPendingNotice
            label={
              isPartial
                ? "Completando as partes faltantes da fundacao."
                : "Criando a fundacao no banco. Pode levar alguns segundos."
            }
          />
        </div>
      </form>
    </section>
  );
}

function FoundationStatusCard({ status }: { status: SocialOsStatus }) {
  const label = !status.configured
    ? "Supabase pendente"
    : status.migrationReady
      ? "Migration pronta"
      : "Migration pendente";

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        {status.migrationReady
          ? "As tabelas novas do Social Creative OS estao acessiveis."
          : "Aplique a migration de fase 1 antes de criar a fundacao no banco."}
      </p>
      {status.errors.length ? (
        <div className="mt-3 max-h-28 overflow-auto rounded-md border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-100">
          {status.errors.slice(0, 3).map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function IntegrationPanel({
  groqReady,
  pexelsReady,
  zernioReady,
  migrationReady,
}: {
  groqReady: boolean;
  pexelsReady: boolean;
  zernioReady: boolean;
  migrationReady: boolean;
}) {
  const integrations = [
    ["Supabase fase 1", migrationReady],
    ["Zernio", zernioReady],
    ["Groq", groqReady],
    ["Pexels auxiliar", pexelsReady],
  ] as const;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold text-white">Conectores</h2>
      <div className="mt-4 grid gap-2">
        {integrations.map(([label, ok]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2">
            <span className="text-sm text-zinc-300">{label}</span>
            <span className={ok ? "text-sm text-emerald-200" : "text-sm text-amber-200"}>
              {ok ? "ok" : "pendente"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionTracePanel({ status }: { status: SocialOsStatus }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h2 className="text-lg font-semibold text-white">Decision traces</h2>
      <div className="mt-4 grid gap-2">
        {status.recentDecisionTraces.length ? (
          status.recentDecisionTraces.map((trace) => (
            <div key={trace.id} className="rounded-md border border-white/10 px-3 py-2">
              <p className="text-sm font-medium text-white">{trace.engine}</p>
              <p className="mt-1 text-xs text-zinc-400">
                {trace.decision_key}: {trace.selected_value}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm leading-6 text-zinc-400">
            Nenhuma decisao registrada ainda. O primeiro trace nasce no bootstrap da fundacao.
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

function LegacyMetric({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <AppLink
      href={href}
      pendingLabel={`Abrindo ${label}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 transition hover:bg-white/[0.07]"
    >
      <span className="text-sm text-zinc-300">{label}</span>
      <span className="text-lg font-semibold text-white">{value}</span>
    </AppLink>
  );
}

function getPhaseDescription(id: string) {
  const descriptions: Record<string, string> = {
    foundation: "Business Profile, Brand DNA, audiencia, estrategia e politica inicial.",
    campaigns: "Narrativas mensais, hipoteses, objetivos e sequencia de campanha.",
    creative: "Conceitos, metaforas visuais, copy strategy e criterio de aprovacao.",
    production: "Layout spec, gramaticas visuais, render jobs e assets finais.",
    engagement: "Comentarios, DMs, keyword-to-DM, materiais e escalonamento humano.",
    learning: "Performance, insights e atualizacao de estrategia por evidencia.",
  };

  return descriptions[id] ?? "";
}

const DOMAIN_CONFIG = {
  strategy: {
    eyebrow: "Fundacao",
    title: "Estrategia antes de post.",
    description:
      "Aqui ficam Business Profile, Brand DNA, perfil de escrita, sistema visual, audiencia e tese estrategica. Esta e a primeira entrega executavel da reconstruacao.",
    tables: [
      "business_profiles",
      "brand_dna",
      "brand_writing_profiles",
      "brand_visual_systems",
      "audience_segments",
      "content_strategies",
      "decision_traces",
    ],
    modules: [
      {
        title: "Business Profile",
        body: "Contexto do negocio, proposta de valor, mercado, oferta e restricoes operacionais.",
      },
      {
        title: "Brand DNA",
        body: "Codigos verbais e visuais, inimigos, transformacao e padroes proibidos.",
      },
      {
        title: "Audience Intelligence",
        body: "Dores, desejos, objecoes, maturidade e linguagem do publico.",
      },
    ],
  },
  campaigns: {
    eyebrow: "Campanhas",
    title: "A campanha vira a unidade central.",
    description:
      "Posts deixam de ser a unidade principal. A campanha guarda narrativa, tensao, funil, hipoteses e politica de decisao.",
    tables: ["campaigns", "creative_concepts", "creative_pieces", "decision_traces"],
    modules: [
      {
        title: "Narrativa",
        body: "Qual historia a empresa deve contar no periodo.",
      },
      {
        title: "Hipoteses",
        body: "Cada campanha declara o que sera testado e como sera medido.",
      },
      {
        title: "Decision Policy",
        body: "O sistema escolhe formato, copy, CTA e automacao no background.",
      },
    ],
  },
  concepts: {
    eyebrow: "Direcao criativa",
    title: "Conceito antes de arte.",
    description:
      "Creative Concepts definem ideia central, gatilho, emocao, historia, metafora visual e composicao antes de qualquer renderizacao.",
    tables: ["creative_concepts", "creative_pieces", "creative_variants", "copy_evaluations"],
    modules: [
      {
        title: "Human Writing Engine",
        body: "Detector de artificios, perfil de escrita e reescrita adversarial.",
      },
      {
        title: "Creative Direction Engine",
        body: "Conceito, metafora, formato e direcao visual por campanha.",
      },
      {
        title: "Quality Gate",
        body: "Avalia artificialidade, marca, hierarquia, originalidade e risco.",
      },
    ],
  },
  production: {
    eyebrow: "Producao",
    title: "Renderizacao server-side sem Open Design.",
    description:
      "A IA produz layout spec. O renderer executa geometria em HTML/SVG, Sharp ou Remotion, salva assets e so depois prepara publicacao.",
    tables: ["creative_variants", "rendering_jobs", "rendered_assets", "publication_jobs"],
    modules: [
      {
        title: "Visual Grammar",
        body: "Familias como editorial tipografico, stat card, sequencia de prova e produto em contexto.",
      },
      {
        title: "Layout Engine",
        body: "Grid, margens, areas seguras, blocos e limites de texto deterministas.",
      },
      {
        title: "Rendering",
        body: "Jobs e assets finais versionados antes do envio para Zernio.",
      },
    ],
  },
  engagement: {
    eyebrow: "Engajamento",
    title: "Comentarios e DMs com politica de risco.",
    description:
      "A preparacao da Zernio Inbox cobre comentarios, DM, keyword-to-DM, entrega de materiais, contatos, conversas e escalonamento humano.",
    tables: [
      "engagement_policies",
      "contacts",
      "conversations",
      "social_interactions",
      "engagement_actions",
    ],
    modules: [
      {
        title: "Classificacao",
        body: "Intencao, sentimento, risco e sinal comercial antes de qualquer acao.",
      },
      {
        title: "Keyword-to-DM",
        body: "Gatilhos por palavra-chave para entregar materiais e iniciar conversa.",
      },
      {
        title: "Escalonamento",
        body: "Perguntas comerciais, criticas e temas sensiveis exigem revisao.",
      },
    ],
  },
  learning: {
    eyebrow: "Aprendizado",
    title: "Performance vira memoria operacional.",
    description:
      "Analytics e learning ligam cada resultado a campanha, variante, hipotese, formato, CTA, hook e decisao tomada.",
    tables: ["content_performance", "learning_insights", "decision_traces"],
    modules: [
      {
        title: "Experimentos",
        body: "Cada post nasce com hipotese e metrica primaria.",
      },
      {
        title: "Performance",
        body: "Resultados devem ser normalizados por alcance, formato e periodo.",
      },
      {
        title: "Learning Loop",
        body: "Insights aprovados atualizam estrategia e policy sem caixa-preta.",
      },
    ],
  },
} as const;

const FOUNDATION_REQUIRED_TABLES = [
  "business_profiles",
  "brand_dna",
  "brand_writing_profiles",
  "brand_visual_systems",
  "audience_segments",
  "content_strategies",
  "campaigns",
  "engagement_policies",
  "decision_traces",
] as const;

const FOUNDATION_TABLE_LABELS: Record<string, string> = {
  business_profiles: "Business Profile",
  brand_dna: "Brand DNA",
  brand_writing_profiles: "perfil de escrita",
  brand_visual_systems: "sistema visual",
  audience_segments: "audiencia",
  content_strategies: "estrategia",
  campaigns: "campanha piloto",
  engagement_policies: "politica de engajamento",
  decision_traces: "decision trace",
};

function getMissingFoundationTables(counts: Record<string, number>) {
  return FOUNDATION_REQUIRED_TABLES.filter((table) => (counts[table] ?? 0) === 0);
}
