"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";

/* Shapes mirror the /api/admin/email/* routes. */

interface ACList {
  id: string;
  name: string;
  subscriber_count: string;
}

interface ACAutomation {
  id: string;
  name?: string;
  status?: string;
}

export default function EmailCampaignsPage() {
  const [totalSubscribers, setTotalSubscribers] = useState<number | null>(null);
  const [lists, setLists] = useState<ACList[]>([]);
  const [listsConfigured, setListsConfigured] = useState(true);
  const [automations, setAutomations] = useState<ACAutomation[]>([]);
  // /api/admin/email/campaigns deliberately returns 501 until the HubSpot
  // token gains the Marketing Emails "content" scope — surface that here.
  const [campaignsNotice, setCampaignsNotice] = useState<{
    text: string;
    setupUrl?: string;
    docsUrl?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, listsRes, autoRes, campRes] = await Promise.all([
        fetchWithAuth("/api/admin/email/stats"),
        fetchWithAuth("/api/admin/email/lists"),
        fetchWithAuth("/api/admin/email/automations"),
        fetchWithAuth("/api/admin/email/campaigns"),
      ]);
      if (statsRes.ok) {
        setTotalSubscribers((await statsRes.json()).totalSubscribers ?? null);
      }
      if (listsRes.ok) {
        setLists((await listsRes.json()).lists ?? []);
      } else if (listsRes.status === 503) {
        setListsConfigured(false);
      }
      if (autoRes.ok) setAutomations((await autoRes.json()).automations ?? []);
      if (!campRes.ok) {
        const body = (await campRes.json().catch(() => null)) as {
          error?: string;
          instructions?: string;
          setupUrl?: string;
          docsUrl?: string;
        } | null;
        setCampaignsNotice({
          text:
            body?.instructions ?? body?.error ?? `Campaigns unavailable (HTTP ${campRes.status})`,
          setupUrl: body?.setupUrl,
          docsUrl: body?.docsUrl,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/email" className="font-mono text-xs text-slate-500 hover:text-slate-300">
          ← Email
        </Link>
      </div>

      <div className="mb-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
          <span className="font-mono text-xs text-orange-400">EMAIL MARKETING</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Campaigns &amp; Audience</h1>
      </div>

      {loading && <Spinner />}
      {error && <ErrorMsg msg={error} />}

      {!loading && !error && (
        <div className="space-y-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <MetricCard
              label="Newsletter Subscribers"
              value={totalSubscribers === null ? "—" : totalSubscribers.toLocaleString()}
            />
            <MetricCard label="ActiveCampaign Lists" value={lists.length.toLocaleString()} />
            <MetricCard label="Automations" value={automations.length.toLocaleString()} />
          </div>

          {campaignsNotice && (
            <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-4">
              <p className="font-mono text-xs text-yellow-400">
                <span className="font-bold">Campaign history unavailable:</span>{" "}
                {campaignsNotice.text}
              </p>
              {(campaignsNotice.setupUrl || campaignsNotice.docsUrl) && (
                <p className="mt-2 font-mono text-xs text-yellow-300">
                  {campaignsNotice.setupUrl && (
                    <a
                      href={campaignsNotice.setupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-100"
                    >
                      Open HubSpot private-apps →
                    </a>
                  )}
                  {campaignsNotice.setupUrl && campaignsNotice.docsUrl && (
                    <span className="mx-2">·</span>
                  )}
                  {campaignsNotice.docsUrl && (
                    <a
                      href={campaignsNotice.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-yellow-100"
                    >
                      Marketing Emails API docs →
                    </a>
                  )}
                </p>
              )}
            </div>
          )}

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              ACTIVECAMPAIGN LISTS
            </h2>
            {!listsConfigured && (
              <div className="rounded-xl border border-yellow-900/30 bg-yellow-950/10 p-4">
                <p className="font-mono text-xs text-yellow-400">
                  ActiveCampaign is not configured. Add{" "}
                  <code className="text-yellow-300">ACTIVECAMPAIGN_API_URL</code> and{" "}
                  <code className="text-yellow-300">ACTIVECAMPAIGN_API_TOKEN</code> to AWS SSM.
                </p>
              </div>
            )}
            {listsConfigured && (
              <div className="overflow-hidden rounded-xl border border-slate-800">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">List</th>
                      <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                        Subscribers
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {lists.length === 0 && (
                      <tr>
                        <td
                          colSpan={2}
                          className="py-8 text-center font-mono text-sm text-slate-600"
                        >
                          No lists found.
                        </td>
                      </tr>
                    )}
                    {lists.map((l) => (
                      <tr key={l.id} className="transition-colors hover:bg-slate-800/30">
                        <td className="px-4 py-3 font-mono text-sm text-white">{l.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">
                          {Number.parseInt(l.subscriber_count, 10).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-mono text-xs font-medium tracking-wider text-slate-400">
              AUTOMATIONS
            </h2>
            <div className="overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="px-4 py-3 text-left font-mono text-xs text-slate-500">
                      Automation
                    </th>
                    <th className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {automations.length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-8 text-center font-mono text-sm text-slate-600">
                        No automations configured.
                      </td>
                    </tr>
                  )}
                  {automations.map((a) => (
                    <tr key={a.id} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-sm text-white">{a.name ?? a.id}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                        {a.status ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-void-light/50 rounded-xl border border-slate-800 p-3">
      <p className="font-mono text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center gap-3 text-slate-400">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
      <span className="font-mono text-sm">Loading...</span>
    </div>
  );
}

function ErrorMsg({ msg }: { readonly msg: string }) {
  return (
    <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3 font-mono text-sm text-red-400">
      {msg}
    </div>
  );
}
