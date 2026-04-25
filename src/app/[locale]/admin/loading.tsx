export default function AdminLoading() {
  return (
    <div className="bg-void min-h-screen">
      <div className="border-neon-magenta/20 bg-neon-magenta/5 border-b">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 sm:px-6 lg:px-8">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">
            ADMIN PANEL
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar skeleton */}
          <aside className="shrink-0 lg:w-64">
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
              <div className="mb-4 border-b border-slate-800 pb-4">
                <div className="bg-void-light/50 mb-1 h-3 w-12 animate-pulse rounded" />
                <div className="bg-void-light/50 h-4 w-32 animate-pulse rounded" />
              </div>
              <div className="space-y-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-void-light/30 h-10 animate-pulse rounded-lg"
                  />
                ))}
              </div>
            </div>
          </aside>

          {/* Content skeleton */}
          <main className="min-w-0 flex-1 space-y-6">
            <div className="bg-void-light/30 h-8 w-48 animate-pulse rounded" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-void-light/30 h-28 animate-pulse rounded-xl border border-slate-800"
                />
              ))}
            </div>
            <div className="bg-void-light/30 h-64 animate-pulse rounded-xl border border-slate-800" />
          </main>
        </div>
      </div>
    </div>
  );
}
