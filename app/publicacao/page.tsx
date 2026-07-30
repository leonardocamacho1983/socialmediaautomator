import {
  AccountsPanel,
  CreatePostPanel,
  StatusMessages,
  StudioSidebar,
  load,
} from "@/app/page";
import { requireAdminPage } from "@/lib/auth";
import { getEditorialStatus } from "@/lib/editorial-store";
import { getZernioConfigStatus, listPosts, listSupportedAccounts } from "@/lib/zernio";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function PublicationPage({ searchParams }: PageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const zernioConfig = getZernioConfigStatus();
  const [accountsResult, postsResult, editorialResult] = await Promise.all([
    load(listSupportedAccounts()),
    load(listPosts({ limit: 50 })),
    load(getEditorialStatus()),
  ]);
  const accounts = accountsResult.ok ? accountsResult.data.accounts : [];

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <StudioSidebar />
      <div className="min-w-0 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur lg:p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.28em] text-cyan-200/70">
              Publicação
            </p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Envio controlado para a Zernio.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">
              Crie rascunhos finais, agende ou publique nas contas conectadas.
            </p>
          </section>
          <StatusMessages
            params={params}
            zernioConfig={zernioConfig}
            accountsResult={accountsResult}
            postsResult={postsResult}
            editorialResult={editorialResult}
          />
          <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
            <CreatePostPanel accounts={accounts} />
            <AccountsPanel accounts={accounts} />
          </section>
        </div>
      </div>
    </main>
  );
}
