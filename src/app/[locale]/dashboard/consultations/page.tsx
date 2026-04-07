"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

interface Consultation {
  id: string;
  title: string;
  start: string;
  end: string;
  meetLink?: string;
  status: "upcoming" | "past";
}

const statusClasses: Record<string, string> = {
  upcoming: "text-neon-green bg-neon-green/10",
  past: "text-slate-400 bg-slate-800/50",
};

export default function ConsultationsPage() {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);
  const { user } = useAuth();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch(
          `/api/user/consultations?email=${encodeURIComponent(user!.email!)}`,
        );
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();
        setConsultations(data.consultations ?? []);
        setConfigured(data.configured !== false);
      } catch {
        // silently fail — just show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const upcoming = consultations.filter((c) => c.status === "upcoming");
  const past = consultations.filter((c) => c.status === "past");
  const displayed = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      <div className="mb-8">
        <div className="bg-neon-cyan/10 border-neon-cyan/20 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">CONSULTATIONS</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">
          {t("dashboard.consultations", "Consultations")}
        </h1>
        <p className="font-body mt-1 text-slate-400">
          {t("dashboard.consultationsDesc", "Your booked and past consultation sessions.")}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Upcoming</p>
          <p className="font-heading text-neon-green mt-1 text-2xl font-bold">
            {loading ? "…" : upcoming.length}
          </p>
        </div>
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <p className="font-mono text-xs text-slate-500">Past Sessions</p>
          <p className="font-heading mt-1 text-2xl font-bold text-white">
            {loading ? "…" : past.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(["upcoming", "past"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`min-h-[36px] rounded-lg px-4 py-1.5 font-mono text-xs transition-all ${
              tab === t
                ? "bg-neon-cyan/10 text-neon-cyan border-neon-cyan/20 border"
                : "border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white"
            }`}
          >
            {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-void-light/50 flex items-center justify-center rounded-xl border border-slate-800 py-16">
          <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-12 text-center">
          <div className="bg-neon-cyan/10 border-neon-cyan/20 mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border text-2xl">
            📅
          </div>
          <h2 className="font-heading mb-2 font-semibold text-white">
            {tab === "upcoming" ? "No upcoming consultations" : "No past consultations"}
          </h2>
          <p className="font-body mx-auto max-w-md text-sm text-slate-500">
            {tab === "upcoming"
              ? "Book a free 30-minute consultation to discuss your cloud strategy."
              : "Your past consultation sessions will appear here."}
          </p>
          {tab === "upcoming" && (
            <Link
              href="/contact"
              className="bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/20 mt-6 inline-block min-h-11 rounded-lg border px-6 py-2.5 font-mono text-sm transition-all"
            >
              Book Consultation →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((c) => (
            <div
              key={c.id}
              className="bg-void-light/50 rounded-xl border border-slate-800 p-5 transition-all hover:border-neon-cyan/20"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                        statusClasses[c.status]
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-sm text-white">{c.title}</p>
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {new Date(c.start).toLocaleDateString("en-IE", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    at{" "}
                    {new Date(c.start).toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" – "}
                    {new Date(c.end).toLocaleTimeString("en-IE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {c.meetLink && c.status === "upcoming" && (
                  <a
                    href={c.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-neon-green/10 border-neon-green/20 text-neon-green hover:bg-neon-green/20 shrink-0 rounded-lg border px-4 py-2 font-mono text-xs transition-all"
                  >
                    Join Meet →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!configured && !loading && (
        <p className="mt-4 font-mono text-[10px] text-slate-600">
          Calendar integration is being set up. Consultations will sync automatically once configured.
        </p>
      )}
    </div>
  );
}
