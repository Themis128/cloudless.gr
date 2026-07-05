"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import type { PortalStep, PortalComment } from "@/app/api/admin/client-portals/route";

interface PortalProject {
  id: string;
  name: string;
  status: string;
  progress?: number;
  updatedAt?: string;
}

interface PortalInvoice {
  id: string;
  number: string | null;
  amount: number;
  currency: string;
  status: string | null;
  created: number;
  pdfUrl: string | null;
}

interface PortalSubscription {
  id: string;
  status: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
}

interface PortalDeliverable {
  id: string;
  title: string;
  url?: string;
  description?: string;
  status: "in_review" | "approved" | "changes_requested";
  clientComment?: string;
  respondedAt?: string;
}

interface PortalPaymentLink {
  id: string;
  label: string;
  url: string;
  amountCents?: number;
  currency?: string;
  status: "open" | "paid" | "void";
  paidAt?: string;
}

interface PortalData {
  client: { name: string; email: string; label: string };
  steps: PortalStep[];
  deliverables: PortalDeliverable[];
  paymentLinks: PortalPaymentLink[];
  projects: PortalProject[];
  invoices: PortalInvoice[];
  subscriptions: PortalSubscription[];
}

function formatAmount(cents: number, currency: string) {
  return (cents / 100).toLocaleString("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  });
}

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

const STEP_CONFIG: Record<
  PortalStep["status"],
  {
    label: string;
    ring: string;
    bg: string;
    text: string;
    dot: string;
    line: string;
  }
> = {
  completed: {
    label: "Completed",
    ring: "border-neon-green",
    bg: "bg-neon-green/15",
    text: "text-neon-green",
    dot: "bg-neon-green",
    line: "bg-neon-green/50",
  },
  "in-progress": {
    label: "In Progress",
    ring: "border-neon-cyan",
    bg: "bg-neon-cyan/10",
    text: "text-neon-cyan",
    dot: "bg-neon-cyan animate-pulse",
    line: "bg-slate-700",
  },
  blocked: {
    label: "Blocked",
    ring: "border-yellow-500/60",
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
    line: "bg-slate-700",
  },
  pending: {
    label: "Pending",
    ring: "border-slate-700",
    bg: "bg-slate-800/40",
    text: "text-slate-500",
    dot: "bg-slate-600",
    line: "bg-slate-800",
  },
};

function StepIcon({ status }: Readonly<{ status: PortalStep["status"] }>) {
  if (status === "completed") {
    return (
      <svg
        className="text-neon-green h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "in-progress") {
    return <span className="bg-neon-cyan h-2.5 w-2.5 animate-pulse rounded-full" />;
  }
  if (status === "blocked") {
    return (
      <svg
        className="h-4 w-4 text-yellow-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        />
      </svg>
    );
  }
  return <span className="h-2 w-2 rounded-full bg-slate-600" />;
}

function CommentCard({ comment }: Readonly<{ comment: PortalComment }>) {
  return (
    <div className="flex gap-3">
      <div className="bg-void-lighter flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-700 font-mono text-[10px] text-slate-400 uppercase">
        {comment.author.slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-xs font-semibold text-slate-300">{comment.author}</span>
          <span className="font-mono text-[10px] text-slate-600">
            {formatRelative(comment.createdAt)}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-400">
          {comment.text}
        </p>
      </div>
    </div>
  );
}

function ReplyForm({
  token,
  stepId,
  onSent,
}: Readonly<{ token: string; stepId: string; onSent: (c: PortalComment) => void }>) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/portal/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId, text: text.trim() }),
      });
      if (res.ok) {
        const { comment } = ((await res.json()) as any);
        onSent(comment);
        setText("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a reply..."
        className="bg-void focus:border-neon-cyan/50 flex-1 rounded-lg border border-slate-700 px-3 py-2 font-mono text-sm text-white placeholder:text-slate-600 focus:outline-none"
      />
      <button
        type="submit"
        disabled={sending || !text.trim()}
        className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-4 py-2 font-mono text-xs font-semibold transition-all disabled:opacity-40"
      >
        {sending ? "..." : "Send"}
      </button>
    </form>
  );
}

function ProjectTimeline({ steps, token }: Readonly<{ steps: PortalStep[]; token: string }>) {
  const [expanded, setExpanded] = useState<string | null>(() => {
    const active = steps.find((s) => s.status === "in-progress" || s.status === "blocked");
    return active?.id ?? null;
  });

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const pct = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <section>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-mono text-xs tracking-widest text-slate-500 uppercase">
          Project Progress
        </h2>
        <span className="font-mono text-xs text-slate-400">
          {completedCount}/{steps.length} steps
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="mb-8">
        <div className="mb-1.5 flex justify-between font-mono text-xs text-slate-500">
          <span>Overall completion</span>
          <span className="text-neon-cyan">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="from-neon-cyan to-neon-green h-full rounded-full bg-gradient-to-r transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Horizontal step bubbles — desktop */}
      <div className="relative mb-8 hidden sm:block">
        {/* Connector track */}
        <div className="absolute top-5 right-0 left-0 h-px bg-slate-800" />
        <div
          className="from-neon-cyan to-neon-green absolute top-5 left-0 h-px bg-gradient-to-r transition-all duration-700"
          style={{ width: `${pct}%` }}
        />

        <div className="relative flex justify-between">
          {steps.map((step, idx) => {
            const cfg = STEP_CONFIG[step.status];
            const isActive = expanded === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setExpanded(isActive ? null : step.id)}
                className="group flex flex-col items-center gap-2 focus:outline-none"
                style={{ width: `${100 / steps.length}%` }}
                aria-expanded={isActive}
              >
                {/* Circle */}
                <div
                  className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200 ${cfg.ring} ${cfg.bg} group-hover:scale-110`}
                >
                  <StepIcon status={step.status} />
                  {step.comments.length > 0 && (
                    <span className="bg-neon-magenta absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px] text-white">
                      {step.comments.length}
                    </span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={`text-center font-mono text-[10px] leading-tight transition-colors ${
                    isActive ? cfg.text : "text-slate-500 group-hover:text-slate-300"
                  }`}
                  style={{ maxWidth: "6rem" }}
                >
                  {idx + 1}. {step.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Vertical step list — always visible on mobile, step detail on all sizes */}
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const cfg = STEP_CONFIG[step.status];
          const isActive = expanded === step.id;

          return (
            <div key={step.id}>
              {/* Step row */}
              <button
                type="button"
                onClick={() => setExpanded(isActive ? null : step.id)}
                aria-expanded={isActive}
                className={`group w-full rounded-xl border text-left transition-all duration-200 ${
                  isActive ? `${cfg.ring} ${cfg.bg}` : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-4 px-4 py-3.5">
                  {/* Index + status dot */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${cfg.ring} ${cfg.bg}`}
                  >
                    <StepIcon status={step.status} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 font-mono text-xs text-slate-600`}>
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="font-heading truncate text-sm font-semibold text-white">
                        {step.name}
                      </span>
                    </div>
                    {step.completedAt && (
                      <p className="mt-0.5 font-mono text-[10px] text-slate-600">
                        Completed {formatRelative(step.completedAt)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {step.comments.length > 0 && (
                      <span className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                          />
                        </svg>
                        {step.comments.length}
                      </span>
                    )}
                    <span
                      className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${cfg.ring} ${cfg.text} bg-transparent`}
                    >
                      {cfg.label}
                    </span>
                    <svg
                      className={`h-4 w-4 text-slate-600 transition-transform duration-200 ${isActive ? "rotate-90" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>

              {/* Comments panel */}
              {isActive && (
                <div className="bg-void-light/20 mt-1 rounded-xl border border-slate-800 px-4 py-4">
                  {step.comments.length === 0 ? (
                    <p className="py-4 text-center font-mono text-xs text-slate-600">
                      No updates yet for this step.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {step.comments.map((comment) => (
                        <CommentCard key={comment.id} comment={comment} />
                      ))}
                    </div>
                  )}
                  <ReplyForm
                    token={token}
                    stepId={step.id}
                    onSent={(c) => {
                      step.comments.push(c);
                      setExpanded(step.id);
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const DELIVERABLE_BADGE: Record<PortalDeliverable["status"], { label: string; cls: string }> = {
  in_review: {
    label: "Awaiting your review",
    cls: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  },
  approved: { label: "Approved", cls: "border-green-900/40 bg-green-950/20 text-green-400" },
  changes_requested: {
    label: "Changes requested",
    cls: "border-yellow-500/40 bg-yellow-500/10 text-yellow-400",
  },
};

function DeliverableCard({
  deliverable,
  token,
  onUpdated,
}: Readonly<{
  deliverable: PortalDeliverable;
  token: string;
  onUpdated: (d: PortalDeliverable) => void;
}>) {
  const [busy, setBusy] = useState(false);
  const [askingChanges, setAskingChanges] = useState(false);
  const [comment, setComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(action: "approve" | "request_changes") {
    setBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/portal/${token}/deliverables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliverableId: deliverable.id,
          action,
          comment: comment.trim() || undefined,
        }),
      });
      const body = ((await res.json()) as any).catch(() => null);
      if (!res.ok) {
        setActionError(body?.error ?? "Something went wrong — please try again.");
        return;
      }
      onUpdated(body.deliverable as PortalDeliverable);
      setAskingChanges(false);
    } catch {
      setActionError("Could not reach the server — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const badge = DELIVERABLE_BADGE[deliverable.status];

  return (
    <div className="bg-void-light/30 rounded-xl border border-slate-800 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {deliverable.url ? (
            <a
              href={deliverable.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-heading text-neon-cyan font-semibold hover:underline"
            >
              {deliverable.title} ↗
            </a>
          ) : (
            <span className="font-heading font-semibold text-white">{deliverable.title}</span>
          )}
          {deliverable.description && (
            <p className="mt-1 text-sm text-slate-400">{deliverable.description}</p>
          )}
          {deliverable.clientComment && deliverable.status !== "in_review" && (
            <p className="mt-2 border-l-2 border-slate-700 pl-3 font-mono text-xs text-slate-500">
              Your feedback: {deliverable.clientComment}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {deliverable.status === "in_review" && (
        <div className="mt-4 space-y-3">
          {askingChanges && (
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="What would you like us to change?"
              className="focus:border-neon-cyan/60 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-600"
            />
          )}
          {actionError && (
            <p role="alert" className="font-mono text-xs text-red-400">
              {actionError}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {askingChanges ? (
              <>
                <button
                  type="button"
                  disabled={busy || !comment.trim()}
                  onClick={() => respond("request_changes")}
                  className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 font-mono text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20 disabled:opacity-40"
                >
                  {busy ? "Sending…" : "Send change request"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAskingChanges(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => respond("approve")}
                  className="border-neon-green/40 bg-neon-green/10 text-neon-green hover:bg-neon-green/20 rounded-lg border px-4 py-2 font-mono text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  {busy ? "Sending…" : "Approve ✓"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setAskingChanges(true)}
                  className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-2 font-mono text-xs font-semibold text-yellow-400 transition-colors hover:bg-yellow-500/20 disabled:opacity-40"
                >
                  Request changes
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PAYMENT_BADGE: Record<PortalPaymentLink["status"], { label: string; cls: string }> = {
  open: { label: "Open", cls: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan" },
  paid: { label: "Paid", cls: "border-green-900/40 bg-green-950/20 text-green-400" },
  void: { label: "Void", cls: "border-slate-700 text-slate-500" },
};

export default function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/${token}`);
        if (res.status === 404) throw new Error("This portal link is invalid or has been revoked.");
        if (!res.ok) throw new Error("Failed to load your portal. Please try again later.");
        setData(((await res.json()) as any));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  return (
    <div className="bg-void min-h-screen">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
            <span className="font-mono text-sm text-white">cloudless.gr</span>
          </div>
          <span className="font-mono text-xs text-slate-500">Client Portal</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {loading && (
          <div className="space-y-4">
            <div className="bg-void-light/40 h-10 w-64 animate-pulse rounded-lg" />
            {["s1", "s2", "s3", "s4"].map((k) => (
              <div
                key={k}
                className="bg-void-light/30 h-16 animate-pulse rounded-xl border border-slate-800"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-900/30 bg-red-950/10 px-6 py-12 text-center">
            <div className="mb-3 text-4xl">🔒</div>
            <p className="font-heading text-base text-red-400">{error}</p>
            <p className="mt-2 font-mono text-xs text-slate-600">
              Contact your project manager for a new link.
            </p>
          </div>
        )}

        {data && (
          <div className="space-y-10">
            {/* Welcome */}
            <div>
              <p className="font-mono text-xs text-slate-500">Welcome back,</p>
              <h1 className="font-heading mt-1 text-3xl font-bold text-white">
                {data.client.name}
              </h1>
              <p className="mt-1 font-mono text-sm text-slate-400">{data.client.label}</p>
            </div>

            {/* Project Timeline — the main view */}
            {data.steps.length > 0 && (
              <div className="bg-void-light/20 rounded-2xl border border-slate-800 p-6">
                <ProjectTimeline steps={data.steps} token={token} />
              </div>
            )}

            {/* Deliverables — review & approve */}
            {data.deliverables.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-500 uppercase">
                  Deliverables
                </h2>
                <div className="space-y-3">
                  {data.deliverables.map((deliverable) => (
                    <DeliverableCard
                      key={deliverable.id}
                      deliverable={deliverable}
                      token={token}
                      onUpdated={(updated) =>
                        setData((prev) =>
                          prev
                            ? {
                                ...prev,
                                deliverables: prev.deliverables.map((d) =>
                                  d.id === updated.id ? updated : d
                                ),
                              }
                            : prev
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Payment links */}
            {data.paymentLinks.filter((l) => l.status !== "void").length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-500 uppercase">
                  Payments
                </h2>
                <div className="space-y-2">
                  {data.paymentLinks
                    .filter((l) => l.status !== "void")
                    .map((link) => (
                      <div
                        key={link.id}
                        className="bg-void-light/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-3"
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-sm text-white">{link.label}</span>
                          {typeof link.amountCents === "number" && (
                            <span className="font-mono text-sm font-semibold text-white">
                              {formatAmount(link.amountCents, link.currency ?? "EUR")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${PAYMENT_BADGE[link.status].cls}`}
                          >
                            {PAYMENT_BADGE[link.status].label}
                          </span>
                          {link.status === "open" && (
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-4 py-1.5 font-mono text-xs font-semibold transition-colors"
                            >
                              Pay now →
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Active subscriptions */}
            {data.subscriptions.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-500 uppercase">
                  Active Plan
                </h2>
                <div className="space-y-3">
                  {data.subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="bg-void-light/30 rounded-xl border border-slate-800 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <span className="font-heading font-semibold text-white">
                            {sub.planName}
                          </span>
                          <span className="ml-3 font-mono text-sm text-slate-400">
                            {formatAmount(sub.amount, sub.currency)}/{sub.interval}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                              sub.status === "active"
                                ? "border-green-900/40 bg-green-950/20 text-green-400"
                                : sub.status === "trialing"
                                  ? "border-neon-blue/30 bg-neon-blue/10 text-neon-blue"
                                  : "border-slate-700 text-slate-400"
                            }`}
                          >
                            {sub.status}
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {sub.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                            {formatDate(sub.currentPeriodEnd)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Notion projects (secondary, if Notion is connected) */}
            {data.projects.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-500 uppercase">
                  Linked Projects
                </h2>
                <div className="space-y-3">
                  {data.projects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-void-light/30 rounded-xl border border-slate-800 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-heading block truncate font-semibold text-white">
                            {project.name}
                          </span>
                          {typeof project.progress === "number" && (
                            <div className="mt-3">
                              <div className="mb-1 flex justify-between">
                                <span className="font-mono text-xs text-slate-500">Progress</span>
                                <span className="font-mono text-xs text-white">
                                  {project.progress}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="bg-neon-blue h-full rounded-full transition-all"
                                  style={{ width: `${project.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                          {project.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Invoices */}
            {data.invoices.length > 0 && (
              <section>
                <h2 className="mb-3 font-mono text-xs tracking-widest text-slate-500 uppercase">
                  Invoices
                </h2>
                <div className="space-y-2">
                  {data.invoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-void-light/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-sm text-white">
                          {inv.number ?? inv.id.slice(0, 12)}
                        </span>
                        <span className="font-mono text-xs text-slate-500">
                          {formatDate(inv.created)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-semibold text-white">
                          {formatAmount(inv.amount, inv.currency)}
                        </span>
                        <span className="rounded-full border border-green-900/40 bg-green-950/20 px-2 py-0.5 font-mono text-[10px] text-green-400">
                          paid
                        </span>
                        {inv.pdfUrl && (
                          <a
                            href={inv.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neon-blue font-mono text-xs hover:underline"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="pt-4 text-center font-mono text-xs text-slate-700">
              Questions? Contact your project manager at cloudless.gr
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
