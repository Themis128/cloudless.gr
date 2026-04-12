import Link from "next/link";

export default function NotFound() {
  return (
    <section className="bg-void flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <p className="text-neon-magenta glow-magenta animate-neon-pulse font-mono text-7xl font-bold">
          404
        </p>
        <h1 className="font-heading mt-4 text-3xl font-bold text-white">Page not found</h1>
        <p className="mt-3 font-mono text-sm text-slate-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 mt-8 inline-block rounded-lg border px-8 py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)]"
        >
          Back to Home
        </Link>
      </div>
    </section>
  );
}
