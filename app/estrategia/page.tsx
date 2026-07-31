import { Banner, StudioSidebar, load } from "@/app/page";
import { SocialOsDomainContent } from "@/app/social-os-ui";
import { requireAdminPage } from "@/lib/auth";
import { getSocialOsStatus } from "@/lib/social-os/foundation-store";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function StrategyPage({ searchParams }: PageProps) {
  await requireAdminPage();

  const params = await searchParams;
  const statusResult = await load(getSocialOsStatus());
  const status = statusResult.ok
    ? statusResult.data
    : {
        configured: false,
        migrationReady: false,
        errors: [statusResult.error],
        counts: {},
        legacyCounts: {},
        recentDecisionTraces: [],
      };

  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <StudioSidebar />
      <div className="min-w-0 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          {params.notice ? (
            <Banner tone="success">{decodeURIComponent(params.notice)}</Banner>
          ) : null}
          {params.error ? (
            <Banner tone="error">{decodeURIComponent(params.error)}</Banner>
          ) : null}
          {!statusResult.ok ? (
            <Banner tone="error">
              Nao consegui acessar a fundacao Social OS: {statusResult.error}
            </Banner>
          ) : null}
          <SocialOsDomainContent domain="strategy" status={status} />
        </div>
      </div>
    </main>
  );
}
