"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  formatAthensSlotDay,
  formatAthensSlotTimeRange,
  MAX_DAYS_AHEAD,
} from "@/lib/booking-slots";
import { translate } from "@/lib/i18n";
import { useCurrentLocale } from "@/lib/use-locale";

interface TimeSlot {
  start: string;
  end: string;
}

const LABEL_CLASS = "mb-2 block font-mono text-xs font-medium tracking-wider text-slate-400";
const INPUT_CLASS =
  "border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]";
const TEXTAREA_CLASS =
  "border-neon-cyan/20 bg-void-light focus:border-neon-cyan/60 w-full resize-y rounded-lg border px-4 py-3 font-mono text-sm text-white transition-all outline-none placeholder:text-slate-600 focus:shadow-[0_0_10px_rgba(0,255,245,0.1)]";

const FIELD_NAME = "name";
const FIELD_EMAIL = "email";
const FIELD_NOTES = "notes";

const AVAIL_LOADING = "loading" as const;
const AVAIL_READY = "ready" as const;
const AVAIL_UNAVAILABLE = "unavailable" as const;
type AvailState = typeof AVAIL_LOADING | typeof AVAIL_READY | typeof AVAIL_UNAVAILABLE;

const BOOK_IDLE = "idle" as const;
const BOOK_SENDING = "sending" as const;
const BOOK_DONE = "done" as const;
const BOOK_ERROR = "error" as const;
type BookStatus = typeof BOOK_IDLE | typeof BOOK_SENDING | typeof BOOK_DONE | typeof BOOK_ERROR;

/**
 * Public booking widget for /consultation — live slot picker over
 * GET /api/calendar/availability + POST /api/calendar/book (cal.com-backed).
 */
export default function ConsultationBooking({ locale }: { locale: string }) {
  const [locale] = useCurrentLocale();
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  const [avail, setAvail] = useState<AvailState>(AVAIL_LOADING);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selected, setSelected] = useState<TimeSlot | null>(null);
  const [status, setStatus] = useState<BookStatus>(BOOK_IDLE);
  const [meetingLink, setMeetingLink] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/calendar/availability?days=${MAX_DAYS_AHEAD}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) setAvail(AVAIL_UNAVAILABLE);
          return;
        }
        const data = (await res.json()) as { slots?: TimeSlot[] };
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setAvail(AVAIL_READY);
      } catch {
        if (!cancelled) setAvail(AVAIL_UNAVAILABLE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byDay = useMemo(() => {
    const groups = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const day = formatAthensSlotDay(slot.start, locale);
      const list = groups.get(day) ?? [];
      list.push(slot);
      groups.set(day, list);
    }
    return [...groups.entries()];
  }, [slots, locale]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setStatus(BOOK_SENDING);

    const form = e.currentTarget;
    const payload = {
      name: (form.elements.namedItem(FIELD_NAME) as HTMLInputElement).value,
      email: (form.elements.namedItem(FIELD_EMAIL) as HTMLInputElement).value,
      notes: (form.elements.namedItem(FIELD_NOTES) as HTMLTextAreaElement).value || undefined,
      consent: true,
      start: selected.start,
      end: selected.end,
    };

    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => null)) as {
          meetingLink?: string;
        } | null;
        setMeetingLink(data?.meetingLink ?? null);
        setStatus(BOOK_DONE);
      } else {
        setStatus(BOOK_ERROR);
        // The slot may have just been taken — refresh availability and
        // drop the selection if it is no longer offered.
        const res2 = await fetch(`/api/calendar/availability?days=${MAX_DAYS_AHEAD}`, {
          cache: "no-store",
        }).catch(() => null);
        if (res2?.ok) {
          // Refresh the picker so a just-taken slot is no longer offered.
          // Keep `selected` — clearing it would unmount the form and lose
          // the visitor's typed name/email plus this error alert.
          const fresh = ((await res2.json()) as { slots?: TimeSlot[] }).slots ?? [];
          setSlots(fresh);
        }
      }
    } catch {
      setStatus(BOOK_ERROR);
    }
  }

  if (status === BOOK_DONE) {
    return (
      <div
        className="neon-border bg-void-light rounded-lg p-10 text-center"
        data-testid="booking-success"
      >
        <div className="text-neon-cyan mb-4 font-mono text-4xl">✓</div>
        <h2 className="font-heading text-2xl font-bold text-white">
          {t("consultation.confirmed", "You're booked!")}
        </h2>
        <p className="mt-2 text-slate-400">
          {t("consultation.confirmedDesc", "A calendar invite is on its way to your inbox.")}
        </p>
        {meetingLink && (
          <a
            href={meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neon-cyan mt-6 inline-block font-mono text-sm font-semibold hover:underline"
          >
            {t("consultation.viewBooking", "View booking details →")}
          </a>
        )}
      </div>
    );
  }

  if (avail === AVAIL_UNAVAILABLE) {
    return (
      <div
        className="neon-border bg-void-light rounded-lg p-10 text-center"
        data-testid="booking-unavailable"
      >
        <p className="text-slate-300">
          {t("consultation.unavailable", "Online booking isn't available right now.")}
        </p>
        <Link
          href="/contact"
          className="text-neon-cyan mt-4 inline-block font-mono text-sm font-semibold hover:underline"
        >
          {t("consultation.unavailableCta", "Message us instead →")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Slot picker */}
      <div className="neon-border bg-void-light rounded-lg p-6 md:p-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-heading text-lg font-bold text-white">
            {t("consultation.pickSlot", "Choose a time")}
          </h2>
          <p className="font-mono text-[10px] text-slate-500">
            {t("consultation.timezoneNote", "All times shown in Athens time (EET).")}
          </p>
        </div>

        {avail === AVAIL_LOADING ? (
          <div
            className="flex items-center justify-center py-16"
            data-testid="slots-loading"
            aria-label={t("consultation.loading", "Loading availability…")}
          >
            <div className="border-neon-cyan h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : byDay.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400" data-testid="slots-empty">
            {t(
              "consultation.noSlots",
              "No open slots in the next two weeks — try the contact form and we'll find a time manually."
            )}
          </p>
        ) : (
          <div className="space-y-5" data-testid="slot-grid">
            {byDay.map(([day, daySlots]) => (
              <div key={day}>
                <p className="mb-2 font-mono text-xs font-semibold tracking-wider text-slate-400">
                  {day}
                </p>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => {
                    const isSelected = selected?.start === slot.start;
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => {
                          setSelected(slot);
                          setStatus(BOOK_IDLE);
                        }}
                        disabled={status === BOOK_SENDING}
                        aria-pressed={isSelected}
                        className={`min-h-11 rounded-lg border px-4 py-2 font-mono text-sm transition-all ${
                          isSelected
                            ? "bg-neon-cyan/20 border-neon-cyan text-neon-cyan shadow-[0_0_15px_rgba(0,255,245,0.2)]"
                            : "bg-void hover:border-neon-cyan/40 border-slate-800 text-slate-300 hover:text-white"
                        }`}
                      >
                        {formatAthensSlotTimeRange(slot.start, slot.end)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details form — appears once a slot is picked */}
      {selected && (
        <form
          data-testid="booking-form"
          onSubmit={handleSubmit}
          className="neon-border bg-void-light space-y-5 rounded-lg p-6 md:p-8"
        >
          <p className="font-mono text-xs text-slate-400">
            <span className="text-neon-cyan">
              {formatAthensSlotDay(selected.start)}{" "}
              {formatAthensSlotTimeRange(selected.start, selected.end)} Athens
            </span>
          </p>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor={FIELD_NAME} className={LABEL_CLASS}>
                {t("consultation.name", "Name")} *
              </label>
              <input
                id={FIELD_NAME}
                name={FIELD_NAME}
                type="text"
                required
                placeholder="Jane Doe"
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor={FIELD_EMAIL} className={LABEL_CLASS}>
                {t("consultation.email", "Email")} *
              </label>
              <input
                id={FIELD_EMAIL}
                name={FIELD_EMAIL}
                type="email"
                required
                placeholder="jane@company.com"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor={FIELD_NOTES} className={LABEL_CLASS}>
              {t("consultation.notes", "What should we prepare for? (optional)")}
            </label>
            <textarea
              id={FIELD_NOTES}
              name={FIELD_NOTES}
              rows={3}
              placeholder={t(
                "consultation.notesPlaceholder",
                "e.g. slow dashboards, rising cloud bill, marketing automation…"
              )}
              className={TEXTAREA_CLASS}
            />
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="consultation-consent"
              name="privacyConsent"
              required
              className="border-neon-cyan/30 bg-void mt-0.5 h-5 w-5 shrink-0 rounded border accent-cyan-400"
            />
            <label
              htmlFor="consultation-consent"
              className="text-sm leading-relaxed text-slate-400"
            >
              {t(
                "consultation.consent",
                "I agree that my details will be used to arrange this consultation, as described in the"
              )}{" "}
              <Link href="/privacy" className="text-neon-cyan underline underline-offset-2">
                {t("legal.privacyTitle", "Privacy Policy")}
              </Link>
              . *
            </label>
          </div>

          {status === BOOK_ERROR && (
            <p role="alert" className="text-neon-magenta font-mono text-sm">
              {t("consultation.error", "Something went wrong. Please try again or email")}{" "}
              <a href="mailto:tbaltzakis@cloudless.gr" className="text-neon-cyan underline">
                tbaltzakis@cloudless.gr
              </a>
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={status === BOOK_SENDING}
              className="bg-neon-cyan/10 border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/20 rounded-lg border px-8 py-3 font-mono font-semibold transition-all duration-300 hover:shadow-[0_0_25px_rgba(0,255,245,0.2)] disabled:opacity-40"
            >
              {status === BOOK_SENDING
                ? t("consultation.sending", "Booking…")
                : t("consultation.submit", "Confirm booking")}
            </button>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="font-mono text-sm text-slate-400 transition-colors hover:text-white"
            >
              {t("consultation.back", "← Back to slots")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
