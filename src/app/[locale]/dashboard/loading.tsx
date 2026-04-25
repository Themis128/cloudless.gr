export default function DashboardLoading() {
  return (
    <section className="bg-void flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full [animation-delay:150ms]" />
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full [animation-delay:300ms]" />
        </div>
        <p className="mt-4 font-mono text-sm text-slate-500">
          Loading dashboard...
        </p>
      </div>
    </section>
  );
}
