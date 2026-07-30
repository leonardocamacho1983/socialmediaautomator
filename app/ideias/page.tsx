import { EditorialPanel, StatusMessages, StudioSidebar, load } from "@/app/page";
import { requireAdminPage } from "@/lib/auth";
import { getEditorialStatus, type EditorialStatus } from "@/lib/editorial-store";
import { getGroqConfigStatus } from "@/lib/groq";
import { getPexelsConfigStatus } from "@/lib/pexels";
import { getZernioConfigStatus, listPosts, listSupportedAccounts } from "@/lib/zernio";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function IdeasPage({ searchParams }: PageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const zernioConfig = getZernioConfigStatus();
  const groqConfig = getGroqConfigStatus();
  const pexelsConfig = getPexelsConfigStatus();
  const [accountsResult, postsResult, editorialResult] = await Promise.all([
    load(listSupportedAccounts()),
    load(listPosts({ limit: 1 })),
    load(getEditorialStatus()),
  ]);

  const editorialStatus: EditorialStatus = editorialResult.ok
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
          brandKnowledge: 0,
          contentIdeas: 0,
          zernioEvents: 0,
        },
        recentEvents: [],
        recentIdeas: [],
        recentDrafts: [],
        recentBrandAssets: [],
        recentBrandReferences: [],
        latestBrandKnowledge: null,
      };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <StudioSidebar />
      <div className="min-w-0 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur lg:p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.28em] text-cyan-200/70">
              Ideias
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Gere ângulos antes de gerar posts.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              O objetivo desta etapa é separar ideia forte de conteúdo genérico.
              Só ideias aprovadas deveriam seguir para criação.
            </p>
          </section>
          <StatusMessages
            params={params}
            zernioConfig={zernioConfig}
            accountsResult={accountsResult}
            postsResult={postsResult}
            editorialResult={editorialResult}
          />
          <EditorialPanel
            status={editorialStatus}
            groqReady={groqConfig.hasApiKey}
            pexelsReady={pexelsConfig.hasApiKey}
            section="ideas"
          />
        </div>
      </div>
    </main>
  );
}
