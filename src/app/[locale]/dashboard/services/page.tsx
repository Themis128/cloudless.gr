"use client";

import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/context/AuthContext";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { PLAN_LABELS } from "@/lib/plans";

interface PortalStatus {
  status: "none" | "waiting" | "approved";
  portalToken?: string;
  plan?: string;
  planLabel?: string;
  submittedAt?: string;
  approvedAt?: string;
}

interface PortalData {
  label: string;
  steps: { id: string; name: string; status: string; completedAt?: string }[];
  deliverables?: { id: string; title: string; status: string }[];
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  none: { label: "No active service", cls: "border-slate-700 text-slate-500" },
  waiting: { label: "Pending setup", cls: "border-yellow-500/40 text-yellow-400" },
  approved: { label: "Active", cls: "border-neon-green/40 text-neon-green" },
};

const STEP_STATUS_DOT: Record<string, string> = {
  completed: "bg-neon-green",
  "in-progress": "bg-neon-cyan animate-pulse",
  blocked: "bg-red-400",
  pending: "bg-slate-600",
};

export default function ServicesPage() {
  const { user } = useAuth();
  const [portalStatus, setPortalStatus] = useState<PortalStatus | null>(null);
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchWithAuth("/api/portal/me");
        if (res.ok) {
          const data: PortalStatus = ((await res.json()) as any);
          setPortalStatus(data);
          if (data.status === "approved" && data.portalToken) {
            const portalRes = await fetch(`/api/portal/${data.portalToken}`);
            if (portalRes.ok) setPortalData(((await portalRes.json()) as any));
          }
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }
    if (user) load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
      </div>
    );
  }

  const status = portalStatus?.status ?? "none";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.none;

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">SERVICES</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Your Services</h1>
        <p className="font-body mt-1 text-slate-400">Active plans and project progress.</p>
      </div>

      {/* Status card */}
      <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-slate-500">Current Plan</p>
            <p className="font-heading mt-1 text-lg font-semibold text-white">
              {portalStatus?.planLabel ?? PLAN_LABELS[portalStatus?.plan ?? ""] ?? "None"}
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 font-mono text-xs ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        {portalStatus?.submittedAt && (
          <p className="mt-3 font-mono text-xs text-slate-500">
            Enrolled:{" "}
            {new Date(portalStatus.submittedAt).toLocaleDateString("en-IE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}
      </div>

      {/* Actions */}
      {status === "none" && (
        <div className="bg-void-light/30 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="mb-4 text-slate-400">You don&rsquo;t have an active service yet.</p>
          <Link
            href="/services"
            className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 font-mono text-sm font-semibold transition-all"
          >
            Browse Services
          </Link>
        </div>
      )}

      {status === "waiting" && (
        <div className="bg-void-light/30 rounded-xl border border-yellow-500/20 p-6">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
            <p className="font-mono text-sm text-yellow-400">Your portal is being prepared</p>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            We&rsquo;re setting up your project. You&rsquo;ll be notified when it&rsquo;s ready.
          </p>
          <Link
            href="/portal/waiting"
            className="text-neon-cyan mt-4 inline-block font-mono text-xs underline underline-offset-4"
          >
            View waiting room →
          </Link>
        </div>
      )}

      {status === "approved" && portalData && (
        <>
          {/* Project progress */}
          <div className="bg-void-light/50 mb-6 rounded-xl border border-slate-800 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-heading font-semibold text-white">{portalData.label}</h2>
              <a
                href={`/portal/${portalStatus!.portalToken}`}
                className="text-neon-cyan font-mono text-xs hover:underline"
              >
                Open Portal →
              </a>
            </div>

            {/* Steps */}
            <div className="space-y-2">
              {portalData.steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  <span
                    className={`h-2 w-2 rounded-full ${STEP_STATUS_DOT[step.status] ?? "bg-slate-600"}`}
                  />
                  <span className="flex-1 font-mono text-sm text-slate-300">{step.name}</span>
                  <span className="font-mono text-[10px] text-slate-500 capitalize">
                    {step.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Progress bar */}
            {portalData.steps.length > 0 && (
              <div className="mt-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="from-neon-cyan to-neon-green h-full rounded-full bg-gradient-to-r transition-all"
                    style={{
                      width: `${Math.round((portalData.steps.filter((s) => s.status === "completed").length / portalData.steps.length) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {portalData.steps.filter((s) => s.status === "completed").length}/
                  {portalData.steps.length} steps completed
                </p>
              </div>
            )}
          </div>

          {/* Deliverables summary */}
          {portalData.deliverables && portalData.deliverables.length > 0 && (
            <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
              <h2 className="font-heading mb-3 font-semibold text-white">Deliverables</h2>
              <div className="space-y-2">
                {portalData.deliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 px-4 py-2"
                  >
                    <span className="font-mono text-sm text-slate-300">{d.title}</span>
                    <span className="font-mono text-[10px] text-slate-500 capitalize">
                      {d.status.replace("_", " ")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
