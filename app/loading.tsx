export default function Loading() {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-white/10 bg-black/35 px-5 py-5 lg:h-screen lg:border-b-0 lg:border-r lg:px-6">
        <div className="h-4 w-28 animate-pulse rounded bg-teal-200/20" />
        <div className="mt-4 h-7 w-36 animate-pulse rounded bg-white/15" />
        <div className="mt-8 space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-12 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
            />
          ))}
        </div>
      </aside>

      <section className="min-w-0 px-5 py-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="border-b border-white/10 pb-6">
            <div className="h-4 w-48 animate-pulse rounded bg-teal-200/20" />
            <div className="mt-5 h-14 max-w-3xl animate-pulse rounded bg-white/15" />
            <div className="mt-3 h-14 max-w-2xl animate-pulse rounded bg-white/10" />
            <div className="mt-5 h-5 max-w-xl animate-pulse rounded bg-white/10" />
          </div>

          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-lg border border-white/10 bg-white/[0.04]"
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
