"use client";

import { Link } from "@/i18n/navigation";
import type {
  Contact360,
  Contact360Attribution,
  Contact360Event,
  Contact360Note,
  Contact360Related,
} from "@/lib/crm-contact-360-shared";
import { contactDisplayName } from "@/lib/crm-contact-360-shared";

const CARD = "bg-void-light/50 rounded-xl border border-slate-800 p-4";
const LABEL = "font-mono text-[10px] uppercase tracking-wide text-slate-500";
const ATHENS = { timeZone: "Europe/Athens" } as const;

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short", ...ATHENS });
}

function formatMoney(amount: number | null, currency = "EUR"): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

function Empty({ children }: { children: string }) {
  return <p className="font-mono text-xs text-slate-600">{children}</p>;
}

function RelatedList({
  rows,
  empty,
  showAmount,
}: {
  rows: Contact360Related[];
  empty: string;
  showAmount?: boolean;
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="divide-y divide-slate-800/80">
      {rows.map((row) => (
        <li key={row.id} className="flex items-start justify-between gap-3 py-2">
          <div>
            <p className="text-sm text-white">{row.name || "—"}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {row.status || "—"} · {formatDate(row.createdAt)}
            </p>
          </div>
          {showAmount ? (
            <p className="font-mono text-xs text-slate-300">{formatMoney(row.amount)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function NotesList({ notes }: { notes: Contact360Note[] }) {
  if (notes.length === 0) return <Empty>No stream notes</Empty>;
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="bg-void/40 rounded-lg border border-slate-800/80 p-3">
          <p className="font-body text-sm whitespace-pre-wrap text-slate-300">{note.post || "—"}</p>
          <p className="mt-2 font-mono text-[10px] text-slate-600">{formatDate(note.createdAt)}</p>
        </li>
      ))}
    </ul>
  );
}

function EventsList({ events }: { events: Contact360Event[] }) {
  if (events.length === 0) return <Empty>No D1 events for this email</Empty>;
  return (
    <ul className="divide-y divide-slate-800/80">
      {events.map((event) => (
        <li key={event.id} className="flex items-start justify-between gap-3 py-2">
          <div>
            <p className="text-neon-cyan font-mono text-xs">{event.event}</p>
            <p className="font-mono text-[10px] text-slate-500">
              {event.page || "—"} · {event.source || "direct"}
            </p>
          </div>
          <p className="font-mono text-[10px] text-slate-600">{formatDate(event.date)}</p>
        </li>
      ))}
    </ul>
  );
}

function AttributionBlock({ attribution }: { attribution: Contact360Attribution }) {
  const { firstTouch, goldMatches } = attribution;
  if (!firstTouch && goldMatches.length === 0) {
    return <Empty>No UTM match for this email in D1 or gold attribution</Empty>;
  }
  return (
    <div className="space-y-3">
      {firstTouch ? (
        <p className="font-mono text-xs text-slate-300">
          First touch: {firstTouch.source || "(direct)"} / {firstTouch.medium || "(none)"} /{" "}
          {firstTouch.campaign || "(none)"}
        </p>
      ) : null}
      {goldMatches.length > 0 ? (
        <ul className="divide-y divide-slate-800/80">
          {goldMatches.map((row) => (
            <li
              key={`${row.utmSource}|${row.utmMedium}|${row.utmCampaign}`}
              className="flex justify-between gap-3 py-2 font-mono text-xs"
            >
              <span className="text-slate-300">
                {row.utmSource} · {row.utmMedium} · {row.utmCampaign}
              </span>
              <span className="text-slate-500">
                {row.sessions} sess · {row.purchases} buy
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No matching gold attribution row</Empty>
      )}
    </div>
  );
}

export function Contact360View({ data }: { data: Contact360 }) {
  const { contact, stripe, account } = data;
  const name = contactDisplayName(contact);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/crm"
          className="hover:text-neon-magenta font-mono text-xs text-slate-500 transition-colors"
        >
          ← Contacts
        </Link>
        <div className="bg-neon-magenta/10 border-neon-magenta/20 mt-4 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CRM · 360</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">{name}</h1>
        <p className="text-neon-cyan mt-1 font-mono text-sm">{contact.email || "No email"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={CARD}>
          <p className={LABEL}>Company</p>
          <p className="mt-1 text-white">{contact.company || "—"}</p>
        </div>
        <div className={CARD}>
          <p className={LABEL}>Phone</p>
          <p className="mt-1 font-mono text-sm text-white">{contact.phone || "—"}</p>
        </div>
        <div className={CARD}>
          <p className={LABEL}>Lead source</p>
          <p className="mt-1 text-white">{contact.leadSource || "—"}</p>
        </div>
      </div>

      <section className={CARD}>
        <h2 className="font-heading mb-3 text-sm font-semibold text-white">Attribution</h2>
        <AttributionBlock attribution={data.attribution} />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">D1 account</h2>
          {account ? (
            <dl className="space-y-2 font-mono text-xs text-slate-300">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">User</dt>
                <dd>{account.name || account.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Created</dt>
                <dd>{formatDate(account.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            <Empty>No D1 user with this email</Empty>
          )}
        </section>

        <section className={CARD}>
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">Stripe</h2>
          {!stripe.configured ? (
            <Empty>Stripe not configured</Empty>
          ) : stripe.customer ? (
            <div className="space-y-3">
              <p className="font-mono text-xs text-slate-400">{stripe.customer.id}</p>
              <ul className="divide-y divide-slate-800/80">
                {stripe.purchases.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2 font-mono text-xs">
                    <span className="text-slate-300">
                      {p.status} · {formatDate(p.date)}
                    </span>
                    <span className="text-white">{formatMoney(p.amount, p.currency)}</span>
                  </li>
                ))}
              </ul>
              {stripe.purchases.length === 0 ? <Empty>No checkout sessions</Empty> : null}
              {stripe.subscriptions.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {stripe.subscriptions.map((sub) => (
                    <li key={sub.id} className="font-mono text-[10px] text-slate-400">
                      {sub.id} · {sub.status}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Empty>No Stripe customer for this email</Empty>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className={CARD}>
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">Opportunities</h2>
          <RelatedList rows={data.opportunities} empty="No opportunities" showAmount />
        </section>
        <section className={CARD}>
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">Cases</h2>
          <RelatedList rows={data.cases} empty="No cases" />
        </section>
      </div>

      <section className={CARD}>
        <h2 className="font-heading mb-3 text-sm font-semibold text-white">Notes</h2>
        <NotesList notes={data.notes} />
      </section>

      <section className={CARD}>
        <h2 className="font-heading mb-3 text-sm font-semibold text-white">D1 events</h2>
        <EventsList events={data.events} />
      </section>

      {contact.description ? (
        <section className={CARD}>
          <h2 className="font-heading mb-3 text-sm font-semibold text-white">Description</h2>
          <p className="font-body text-sm whitespace-pre-wrap text-slate-300">
            {contact.description}
          </p>
        </section>
      ) : null}
    </div>
  );
}
