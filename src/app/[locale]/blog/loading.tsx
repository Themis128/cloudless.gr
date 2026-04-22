export default function BlogLoading() {
  return (
    <div className="bg-void min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        {/* Header skeleton */}
        <div className="mb-12 text-center">
          <div className="bg-void-light/50 mx-auto mb-4 h-4 w-24 animate-pulse rounded" />
          <div className="bg-void-light/50 mx-auto mb-3 h-10 w-64 animate-pulse rounded" />
          <div className="bg-void-light/50 mx-auto h-4 w-96 animate-pulse rounded" />
        </div>

        {/* Search skeleton */}
        <div className="bg-void-light/50 mx-auto mb-12 h-12 max-w-xl animate-pulse rounded-xl" />

        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          {/* Posts skeleton */}
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-void-light/30 animate-pulse rounded-xl border border-slate-800 p-6"
              >
                <div className="bg-void-light/50 mb-3 h-4 w-20 rounded" />
                <div className="bg-void-light/50 mb-2 h-6 w-3/4 rounded" />
                <div className="bg-void-light/50 mb-1 h-4 w-full rounded" />
                <div className="bg-void-light/50 mb-4 h-4 w-2/3 rounded" />
                <div className="bg-void-light/50 h-3 w-24 rounded" />
              </div>
            ))}
          </div>

          {/* Sidebar skeleton */}
          <div className="hidden lg:block space-y-6">
            <div className="bg-void-light/30 animate-pulse rounded-xl border border-slate-800 p-6">
              <div className="bg-void-light/50 mb-4 h-4 w-24 rounded" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-void-light/50 mb-2 h-4 w-full rounded"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
