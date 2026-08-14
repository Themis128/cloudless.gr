export const revalidate = 3600;

import type { Metadata } from "next";
import { listProjects } from "@/lib/appflowy-projects";
import type { Project } from "@/lib/appflowy-projects";
import { isAppFlowyConfigured } from "@/lib/appflowy";
import ProjectCard from "@/components/ProjectCard";
import ScrollReveal from "@/components/ScrollReveal";
import JsonLd from "@/components/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Our Work",
  description:
    "Client projects delivered by Cloudless — serverless migrations, analytics pipelines, and AI-powered marketing platforms.",
  alternates: {
    canonical: "https://cloudless.gr/work",
  },
};

async function loadClientProjects(): Promise<Project[]> {
  try {
    const ok = await isAppFlowyConfigured();
    if (!ok) return [];
    const all = await listProjects();
    return all.filter(
      (p) => p.type === "Client" && (p.status === "Completed" || p.status === "In Progress")
    );
  } catch {
    return [];
  }
}

export default async function WorkPage() {
  const projects = await loadClientProjects();
  const active = projects.filter((p) => p.status === "In Progress");
  const completed = projects.filter((p) => p.status === "Completed");

  return (
    <main className="bg-void relative min-h-screen overflow-x-hidden">
      <JsonLd data={getBreadcrumbSchema([{ name: "Work", url: "/work" }])} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-16">
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">OUR WORK</span>
        </div>
        <h1 className="font-heading text-4xl leading-tight font-bold text-white sm:text-5xl">
          Projects that <span className="text-neon-cyan">actually shipped</span>
        </h1>
        <p className="font-body mt-4 max-w-2xl text-slate-400">
          Serverless migrations, analytics pipelines, and AI-powered marketing platforms — built for
          teams that need to move fast.
        </p>
      </section>

      {/* Active projects */}
      {active.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-16">
          <h2 className="mb-6 font-mono text-xs font-semibold tracking-widest text-slate-500 uppercase">
            ▶ Active
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <ScrollReveal key={p.id}>
                <ProjectCard project={p} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* Completed projects */}
      {completed.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <h2 className="mb-6 font-mono text-xs font-semibold tracking-widest text-slate-500 uppercase">
            ✓ Completed
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((p) => (
              <ScrollReveal key={p.id}>
                <ProjectCard project={p} />
              </ScrollReveal>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {projects.length === 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="bg-void-light/30 rounded-xl border border-slate-800 p-16 text-center">
            <p className="font-mono text-slate-500">No client projects to show yet.</p>
            <p className="font-body mt-2 text-sm text-slate-600">
              Check back soon — we&apos;re always building.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}
