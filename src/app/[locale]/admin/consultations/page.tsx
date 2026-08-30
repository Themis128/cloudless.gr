"use client";
import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useRef, useState } from "react";
import { Video, Calendar, Clock, User, Mail, ExternalLink } from "lucide-react";

interface Consultation {
  id: string;
  title: string;
  start: string;
  end: string;
  meetLink?: string;
  status: "upcoming" | "past";
}

const ATHENS_FMT: Intl.DateTimeFormatOptions = {
  timeZone: "Europe/Athens",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatAthens(iso: string) {
  return new Date(iso).toLocaleString("en-IE", ATHENS_FMT);
}

function extractClientName(title: string) {
  // "Cloudless Consultation — Alice" → "Alice"
  const m = title.match(/—\s*(.+)$/);
  return m ? m[1].trim() : title;
}

function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

function StatusPill({ start }: { start: string }) {
  const mins = minutesUntil(start);
  if (mins < 0)
    return (
      <span className="rounded-full bg-slate-700 px-2 py-0.5 font-mono text-[10px] text-slate-400">
        Past
      </span>
    );
  if (mins <= 60)
    return (
      <span className="rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-[10px] text-red-400">
        In {mins}m
      </span>
    );
  if (mins <= 1440)
    return (
      <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 font-mono text-[10px] text-yellow-400">
        Today
      </span>
    );
  return (
    <span className="rounded-full bg-green-500/20 px-2 py-0.5 font-mono text-[10px] text-green-400">
      Upcoming
    </span>
  );
}

export default function ConsultationsPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const knownIds = useRef<Set<string>>(new Set());
  const remindedIds = useRef<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadConsultations() {
    try {
      const res = await fetchWithAuth("/api/admin/consultations");
      if (!res.ok) return;
      const data = (await res.json()) as { consultations: Consultation[]; configured: boolean };
      setConfigured(data.configured);
      setConsultations(data.consultations ?? []);
      // detect new bookings for browser notification
      for (const c of data.consultations ?? []) {
        if (!knownIds.current.has(c.id)) {
          if (knownIds.current.size > 0 && notifPermission === "granted") {
            new Notification("New consultation booked", {
              body: `${extractClientName(c.title)} — ${formatAthens(c.start)} Athens`,
              icon: "/favicon.ico",
            });
          }
          knownIds.current.add(c.id);
        }
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifPermission(Notification.permission);
    }
    loadConsultations();
    // Poll every 60 seconds so new bookings surface in real time
    pollRef.current = setInterval(loadConsultations, 60_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-meeting popup reminders — fire once when a consultation is ~15 min away
  useEffect(() => {
    if (notifPermission !== "granted" || consultations.length === 0) return;

    function checkReminders() {
      const now = Date.now();
      for (const c of consultations) {
        const startMs = new Date(c.start).getTime();
        const minutesUntil = (startMs - now) / 60_000;
        if (minutesUntil > 0 && minutesUntil <= 15 && !remindedIds.current.has(c.id)) {
          new Notification("Consultation starting soon", {
            body: `${extractClientName(c.title)} — ${formatAthens(c.start)} Athens`,
            icon: "/favicon.ico",
          });
          remindedIds.current.add(c.id);
        }
      }
    }

    checkReminders();
    const reminderRef = setInterval(checkReminders, 60_000);
    return () => clearInterval(reminderRef);
  }, [consultations, notifPermission]);

  async function requestNotifPermission() {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  }

  // Calendar grid
  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else setMonth((m) => m + 1);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const consultationsByDate: Record<string, Consultation[]> = {};
  for (const c of consultations) {
    const d = new Date(c.start).toLocaleDateString("en-CA", { timeZone: "Europe/Athens" });
    if (!consultationsByDate[d]) consultationsByDate[d] = [];
    consultationsByDate[d].push(c);
  }

  const upcoming = consultations.filter((c) => c.status === "upcoming");

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-magenta/20 bg-neon-magenta/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-magenta h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-magenta font-mono text-xs">CONSULTATIONS</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Consultations</h1>
            <p className="font-body mt-1 text-slate-400">Upcoming bookings from Google Calendar.</p>
          </div>
          {notifPermission !== "granted" && typeof Notification !== "undefined" && (
            <button
              type="button"
              onClick={requestNotifPermission}
              className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 shrink-0 rounded-lg border px-4 py-2 font-mono text-xs transition-all"
            >
              Enable popup notifications
            </button>
          )}
          {notifPermission === "granted" && (
            <span className="font-mono text-xs text-green-400">Popup notifications on ✓</span>
          )}
        </div>
      </div>

      {!configured && (
        <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 font-mono text-sm text-yellow-400">
          Google Calendar is not configured. Set <code>GOOGLE_CLIENT_EMAIL</code> and{" "}
          <code>GOOGLE_PRIVATE_KEY</code> to enable booking.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* Mini calendar */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="px-2 font-mono text-slate-400 hover:text-white"
            >
              ‹
            </button>
            <h2 className="font-mono text-sm font-semibold text-white">
              {MONTHS[month]} {year}
            </h2>
            <button
              type="button"
              onClick={nextMonth}
              className="px-2 font-mono text-slate-400 hover:text-white"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-px bg-slate-800">
            {DAYS.map((d) => (
              <div
                key={d}
                className="bg-void-light py-1.5 text-center font-mono text-[9px] text-slate-500"
              >
                {d}
              </div>
            ))}
            {cells.map((day, idx) => {
              const dateStr = day
                ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                : null;
              const dayConsultations = dateStr ? (consultationsByDate[dateStr] ?? []) : [];
              const isToday =
                day === today.getDate() &&
                month === today.getMonth() &&
                year === today.getFullYear();
              return (
                <div key={idx} className="bg-void flex min-h-10 flex-col items-center p-1">
                  {day && (
                    <>
                      <p
                        className={`font-mono text-[10px] ${isToday ? "text-neon-magenta font-bold" : "text-slate-500"}`}
                      >
                        {day}
                      </p>
                      {dayConsultations.length > 0 && (
                        <span
                          className="bg-neon-magenta mt-0.5 h-1.5 w-1.5 rounded-full"
                          title={`${dayConsultations.length} consultation(s)`}
                        />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {loading && <p className="mt-3 font-mono text-[11px] text-slate-500">Loading…</p>}
        </div>

        {/* Consultation list */}
        <div className="bg-void-light/50 rounded-xl border border-slate-800 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-white">
              Upcoming ({upcoming.length})
            </h2>
            <span className="font-mono text-[10px] text-slate-500">
              Auto-refreshes every 60s · polling for new bookings
            </span>
          </div>

          {upcoming.length === 0 && !loading && (
            <p className="font-mono text-sm text-slate-500">No upcoming consultations.</p>
          )}

          <div className="space-y-3">
            {upcoming.map((c) => {
              const name = extractClientName(c.title);
              const mins = minutesUntil(c.start);
              const startLabel = formatAthens(c.start);
              const endLabel = new Date(c.end).toLocaleTimeString("en-IE", {
                timeZone: "Europe/Athens",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border p-4 transition-colors ${mins <= 60 ? "border-red-500/30 bg-red-500/5" : "border-slate-700 bg-slate-900/50"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <User className="text-neon-magenta h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-mono text-sm font-semibold text-white">
                          {name}
                        </span>
                        <StatusPill start={c.start} />
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span className="font-mono text-xs">
                          {startLabel}–{endLabel} Athens
                        </span>
                      </div>
                    </div>
                    {c.meetLink && (
                      <a
                        href={c.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-neon-magenta/10 border-neon-magenta/30 text-neon-magenta hover:bg-neon-magenta/20 flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all"
                      >
                        <Video className="h-3 w-3" />
                        Join Meet
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
