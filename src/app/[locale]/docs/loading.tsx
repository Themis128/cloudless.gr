export default function DocsLoading() {
  return (
    <div className="bg-void min-h-screen text-white">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="flex gap-10">
          {/* Sidebar skeleton */}
          <aside className="hidden w-56 flex-none lg:block">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-void-light/50 h-4 animate-pulse rounded" />
              ))}
            </div>
          </aside>
          {/* Content skeleton */}
          <main className="flex-1 space-y-4">
            <div className="bg-void-light/50 h-8 w-1/2 animate-pulse rounded" />
            <div className="bg-void-light/50 h-4 w-full animate-pulse rounded" />
            <div className="bg-void-light/50 h-4 w-3/4 animate-pulse rounded" />
            <div className="bg-void-light/50 h-4 w-5/6 animate-pulse rounded" />
          </main>
        </div>
      </div>
    </div>
  );
}
