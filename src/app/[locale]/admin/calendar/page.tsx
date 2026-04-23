"use client";

import { fetchWithAuth } from "@/lib/fetch-with-auth";
import { useEffect, useState } from "react";
import type {
  CalendarItem,
  CalendarItemType,
  CalendarPlatform,
} from "@/lib/content-calendar";
import { CALENDAR_ITEM_COLORS, PLATFORM_LABELS } from "@/lib/content-calendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    type: "social_post" as CalendarItemType,
    platform: "meta" as CalendarPlatform,
    status: "draft" as CalendarItem["status"],
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);
    const firstDay = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
    try {
      const res = await fetchWithAuth(
        `/api/admin/calendar?from=${firstDay}&to=${lastDay}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadItems();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/admin/calendar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date: selectedDate }),
      });
      if (!res.ok) return;
      setShowForm(false);
      setForm({ title: "", type: "social_post", platform: "meta", status: "draft", notes: "" });
      await loadItems();
    } catch { /* silent */ }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetchWithAuth(`/api/admin/calendar/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const itemsByDate: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    const d = item.date.slice(0, 10);
    if (!itemsByDate[d]) itemsByDate[d] = [];
    itemsByDate[d].push(item);
  }

  return (
    <div>
      <div className="mb-8">
        <div className="border-neon-cyan/20 bg-neon-cyan/10 mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5">
          <span className="bg-neon-cyan h-2 w-2 animate-pulse rounded-full" />
          <span className="text-neon-cyan font-mono text-xs">CONTENT CALENDAR</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-white">Content Calendar</h1>
        <p className="font-body mt-1 text-slate-400">
          Schedule and manage content across all channels.
        </p>
      </div>

      <div className="bg-void-light/50 rounded-xl border border-slate-800 p-6">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="font-mono text-slate-400 hover:text-white transition-colors px-2">
            ‹
          </button>
          <h2 className="font-mono text-sm font-semibold text-white">
            {MONTHS[month]} {year}
          </h2>
          <button type="button" onClick={nextMonth} className="font-mono text-slate-400 hover:text-white transition-colors px-2">
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-slate-800">
          {DAYS.map((d) => (
            <div key={d} className="bg-void-light py-2 text-center font-mono text-[10px] text-slate-500">
              {d}
            </div>
          ))}
          {cells.map((day, idx) => {
            const dateStr = day
              ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              : null;
            const dayItems = dateStr ? (itemsByDate[dateStr] ?? []) : [];
            const isToday =
              day === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();

            return (
              <div
                key={idx}
                className={`bg-void min-h-[80px] p-1.5 ${day ? "cursor-pointer hover:bg-slate-800/30 transition-colors" : ""}`}
                onClick={() => {
                  if (!day || !dateStr) return;
                  setSelectedDate(dateStr);
                  setShowForm(true);
                }}
              >
                {day && (
                  <>
                    <p
                      className={`mb-1 font-mono text-[10px] ${
                        isToday
                          ? "text-neon-cyan font-bold"
                          : "text-slate-500"
                      }`}
                    >
                      {day}
                    </p>
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="mb-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-[9px]"
                        style={{
                          backgroundColor: `${CALENDAR_ITEM_COLORS[item.type]}20`,
                          color: CALENDAR_ITEM_COLORS[item.type],
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete "${item.title}"?`)) {
                            handleDelete(item.id);
                          }
                        }}
                        title={`${item.title} — click to delete`}
                      >
                        <span className="truncate font-mono">{item.title}</span>
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <p className="font-mono text-[9px] text-slate-600">
                        +{dayItems.length - 3} more
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-slate-500">
            <div className="border-neon-cyan h-3 w-3 animate-spin rounded-full border-2 border-t-transparent" />
            <span className="font-mono text-xs">Loading...</span>
          </div>
        )}
      </div>

      {showForm && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-void w-full max-w-md rounded-xl border border-slate-700 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono text-sm font-semibold text-white">
                New Item — {selectedDate}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="font-mono text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Title</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-white focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as CalendarItemType }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:outline-none"
                  >
                    <option value="social_post">Social Post</option>
                    <option value="email_campaign">Email Campaign</option>
                    <option value="blog_post">Blog Post</option>
                    <option value="consultation">Consultation</option>
                    <option value="ad_campaign">Ad Campaign</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-mono text-xs text-slate-400">Platform</label>
                  <select
                    value={form.platform}
                    onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as CalendarPlatform }))}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:outline-none"
                  >
                    {(Object.keys(PLATFORM_LABELS) as CalendarPlatform[]).map((p) => (
                      <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs text-slate-400">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white focus:border-slate-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 flex-1 rounded-lg border px-4 py-2 font-mono text-xs transition-all disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Add to Calendar"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 font-mono text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
