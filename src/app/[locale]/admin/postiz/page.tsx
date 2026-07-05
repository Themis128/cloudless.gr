"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  postIdentifier,
  type PostizIntegration,
  type PostizPost,
  type CreatePostBody,
} from "@/lib/postiz";

/** Accept attribute for file picker — matches Postiz `/upload` MIME allowlist
 *  per docs.postiz.com (jpeg, png, gif, webp, avif, bmp, tiff, mp4).
 *  Anything else is rejected by the backend with a 400. */
const POSTIZ_FILE_ACCEPT =
  "image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp,image/tiff,video/mp4";

/**
 * Postiz admin page — /[locale]/admin/postiz
 *
 * Read-and-write surface over the Postiz Public API. Talks ONLY to the local
 * /api/admin/postiz/* proxy routes — POSTIZ_API_KEY never leaves the server.
 *
 * Routes used:
 *   GET    /api/admin/postiz/integrations  → connected channels
 *   GET    /api/admin/postiz/posts         → scheduled + published window
 *   POST   /api/admin/postiz/posts         → create / schedule a post
 *   PUT    /api/admin/postiz/posts/:id     → edit a scheduled / draft post
 *   DELETE /api/admin/postiz/posts/:id     → delete a post
 *   POST   /api/admin/postiz/upload        → upload media by URL
 *   POST   /api/admin/postiz/upload-file   → multipart file upload
 *   GET    /api/admin/postiz/slot?id=...   → next free time slot
 *   POST   /api/admin/ai/generate          → AI-draft a post
 */

type Tab = "compose" | "schedule" | "calendar" | "channels";

interface ImageRef {
  id: string;
  path: string;
}

/** A draft being edited in the Compose tab. `id` set ⇒ PUT; unset ⇒ POST. */
interface ComposeDraft {
  id: string | null;
  content: string;
  selectedIds: string[];
  scheduleAt: string;
  images: ImageRef[];
  /** Per-channel settings overrides keyed by integration id. */
  settingsOverrides: Record<string, Record<string, unknown>>;
}

const EMPTY_DRAFT: ComposeDraft = {
  id: null,
  content: "",
  selectedIds: [],
  scheduleAt: "",
  images: [],
  settingsOverrides: {},
};

export default function PostizAdminPage() {
  const [tab, setTab] = useState<Tab>("compose");
  const [integrations, setIntegrations] = useState<PostizIntegration[] | null>(null);
  const [posts, setPosts] = useState<PostizPost[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ComposeDraft>(EMPTY_DRAFT);

  // Concurrent reloads race against `configured` — once a 503 is observed,
  // Postiz is definitively unconfigured and the success path of the other
  // request must NOT flip the flag back to `true`. Use the functional setter
  // so `false` is sticky; `null` (initial) → `true` is the only upgrade.
  const markConfigured = useCallback(() => {
    setConfigured((cur) => (cur === false ? false : true));
  }, []);

  const reloadIntegrations = useCallback(async () => {
    const res = await fetch("/api/admin/postiz/integrations");
    if (res.status === 503) {
      setConfigured(false);
      return;
    }
    markConfigured();
    if (!res.ok) {
      setError(`integrations: ${res.status}`);
      return;
    }
    const data = (((((await res.json()) as any)) as any)) as { integrations: PostizIntegration[] };
    setIntegrations(data.integrations ?? []);
    setError(null);
  }, [markConfigured]);

  const reloadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/postiz/posts");
    if (res.status === 503) {
      setConfigured(false);
      return;
    }
    markConfigured();
    if (!res.ok) {
      setError(`posts: ${res.status}`);
      return;
    }
    const data = (((((await res.json()) as any)) as any)) as { posts: PostizPost[] };
    setPosts(data.posts ?? []);
    setError(null);
  }, [markConfigured]);

  useEffect(() => {
    // reloadIntegrations / reloadPosts are async; the setState calls inside
    // them happen after the fetch resolves, not synchronously in the effect
    // body. The new react-hooks/set-state-in-effect rule can't tell the
    // difference. Matches the existing pattern in AuthContext.tsx:199.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadIntegrations();
    void reloadPosts();
  }, [reloadIntegrations, reloadPosts]);

  /** Switch to Compose tab populated from an existing scheduled / draft post. */
  const editPost = useCallback((post: PostizPost) => {
    setDraft({
      id: post.id,
      content: post.content,
      selectedIds: [post.integration.id],
      // datetime-local needs `YYYY-MM-DDTHH:mm` (no seconds, no Z).
      scheduleAt: post.publishDate.slice(0, 16),
      images: [],
      settingsOverrides: {},
    });
    setTab("compose");
  }, []);

  if (configured === false) {
    return <NotConfigured />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Postiz</h1>
        <a
          href="https://postiz.cloudless.gr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 underline"
        >
          Open Postiz UI →
        </a>
      </header>

      {error && (
        <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <nav className="flex gap-2 border-b">
        {(["compose", "schedule", "calendar", "channels"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${
              tab === t ? "border-b-2 border-blue-600 font-medium text-blue-700" : "text-gray-600"
            }`}
          >
            {t}
            {t === "compose" && draft.id ? " (edit)" : ""}
          </button>
        ))}
      </nav>

      {tab === "channels" && (
        <ChannelsTab integrations={integrations} onReload={reloadIntegrations} />
      )}
      {tab === "compose" && (
        <ComposeTab
          integrations={integrations ?? []}
          draft={draft}
          onDraftChange={setDraft}
          onCancel={() => setDraft(EMPTY_DRAFT)}
          onPosted={() => {
            void reloadPosts();
            setDraft(EMPTY_DRAFT);
            setTab("schedule");
          }}
        />
      )}
      {tab === "schedule" && <ScheduleTab posts={posts} onReload={reloadPosts} onEdit={editPost} />}
      {tab === "calendar" && <CalendarTab posts={posts} onReload={reloadPosts} />}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Postiz not configured</h1>
      <p className="text-gray-700">
        Set <code>POSTIZ_API_KEY</code> (and optionally <code>POSTIZ_BASE_URL</code>) in SSM under{" "}
        <code>/cloudless/postiz/</code>. Get the key from{" "}
        <a
          href="https://postiz.cloudless.gr"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 underline"
        >
          postiz.cloudless.gr
        </a>{" "}
        → Settings → Developers → Public API.
      </p>
      <p className="text-gray-700">
        After setting the SSM parameter, the Lambda needs to refresh its config — either re-deploy
        or wait out the SSM cache TTL.
      </p>
      <Link href="/admin" className="text-blue-600 underline">
        ← Back to admin
      </Link>
    </div>
  );
}

function ChannelsTab({
  integrations,
  onReload,
}: {
  integrations: PostizIntegration[] | null;
  onReload: () => void;
}) {
  if (integrations === null) return <p>Loading channels…</p>;
  if (integrations.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-gray-700">No channels connected yet. Connect them via the Postiz UI.</p>
        <a
          href="https://postiz.cloudless.gr/launches"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white"
        >
          Connect a channel →
        </a>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={onReload} className="text-sm text-blue-600 underline">
          Refresh
        </button>
      </div>
      <ul className="divide-y rounded border">
        {integrations.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-gray-500">
                {i.identifier} · {i.id}
              </div>
            </div>
            {i.disabled && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">disabled</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComposeTab({
  integrations,
  draft,
  onDraftChange,
  onCancel,
  onPosted,
}: {
  integrations: PostizIntegration[];
  draft: ComposeDraft;
  onDraftChange: (next: ComposeDraft) => void;
  onCancel: () => void;
  onPosted: () => void;
}) {
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const selectedIntegrations = useMemo(
    () => integrations.filter((i) => draft.selectedIds.includes(i.id)),
    [integrations, draft.selectedIds]
  );

  const setDraft = (patch: Partial<ComposeDraft>) => onDraftChange({ ...draft, ...patch });

  const toggleId = (id: string) =>
    setDraft({
      selectedIds: draft.selectedIds.includes(id)
        ? draft.selectedIds.filter((x) => x !== id)
        : [...draft.selectedIds, id],
    });

  const addImageByUrl = async () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    const up = await fetch("/api/admin/postiz/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (!up.ok) {
      setFeedback(`Upload failed: ${up.status}`);
      return;
    }
    const uploaded = (((((await up.json()) as any)) as any)) as ImageRef;
    setDraft({ images: [...draft.images, { id: uploaded.id, path: uploaded.path }] });
    setImageUrlInput("");
  };

  const addImageByFile = async (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    const up = await fetch("/api/admin/postiz/upload-file", { method: "POST", body: form });
    if (!up.ok) {
      setFeedback(`File upload failed: ${up.status}`);
      return;
    }
    const uploaded = (((((await up.json()) as any)) as any)) as ImageRef;
    setDraft({ images: [...draft.images, { id: uploaded.id, path: uploaded.path }] });
  };

  const removeImage = (id: string) => setDraft({ images: draft.images.filter((i) => i.id !== id) });

  const findNextSlot = async () => {
    if (draft.selectedIds.length === 0) {
      setFeedback("Select a channel first to find its next free slot.");
      return;
    }
    const channelId = draft.selectedIds[0];
    const res = await fetch(`/api/admin/postiz/slot?id=${encodeURIComponent(channelId)}`);
    if (!res.ok) {
      setFeedback(`Slot lookup failed: ${res.status}`);
      return;
    }
    const { date } = (((((await res.json()) as any)) as any)) as { date: string };
    // datetime-local input wants local time, no seconds/zone.
    setDraft({ scheduleAt: new Date(date).toISOString().slice(0, 16) });
    setFeedback(`Next free slot: ${new Date(date).toLocaleString()}`);
  };

  const aiDraft = async () => {
    setAiBusy(true);
    setFeedback(null);
    try {
      const channels = selectedIntegrations.map((i) => i.identifier).join(", ") || "social media";
      const seed = draft.content.trim() || `cloudless.gr post for ${channels}`;
      const prompt =
        `Write one concise social media post for ${channels}. ` +
        `Tone: practical, direct. No hashtag spam (max 3). Topic: ${seed}.\n` +
        `Output the post text only — no preamble, no quotes, no explanation.`;
      const res = await fetch("/api/admin/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        setFeedback(`AI draft failed: ${res.status}`);
        return;
      }
      const data = (((((await res.json()) as any)) as any)) as { result?: string };
      if (data.result) setDraft({ content: data.result.trim() });
    } finally {
      setAiBusy(false);
    }
  };

  const onSubmit = async (mode: "now" | "schedule" | "draft") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const body: CreatePostBody = {
        type: mode,
        date:
          mode === "schedule" && draft.scheduleAt
            ? new Date(draft.scheduleAt).toISOString()
            : new Date().toISOString(),
        shortLink: false,
        tags: [],
        posts: selectedIntegrations.map((i) => ({
          integration: { id: i.id },
          value: [{ content: draft.content, image: draft.images }],
          settings: {
            ...settingsFor(i),
            ...(draft.settingsOverrides[i.id] ?? {}),
          },
        })),
      };

      const path = draft.id
        ? `/api/admin/postiz/posts/${encodeURIComponent(draft.id)}`
        : "/api/admin/postiz/posts";
      const res = await fetch(path, {
        method: draft.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        setFeedback(`Failed: ${res.status} ${txt.slice(0, 120)}`);
        return;
      }
      setFeedback(draft.id ? `✅ Updated (${mode})` : `✅ Posted (${mode})`);
      onPosted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {draft.id && (
        <div className="flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <span>
            Editing post <code>{draft.id}</code>
          </span>
          <button type="button" onClick={onCancel} className="text-blue-700 underline">
            Cancel edit
          </button>
        </div>
      )}

      <div>
        <label htmlFor="postiz-channels" className="mb-1 block text-sm font-medium">
          Channels ({draft.selectedIds.length} selected)
        </label>
        <div id="postiz-channels" className="flex flex-wrap gap-2">
          {integrations.map((i) => {
            const on = draft.selectedIds.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggleId(i.id)}
                className={`rounded border px-3 py-1 text-sm ${
                  on ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-700"
                }`}
              >
                {i.name} <span className="text-xs">({i.identifier})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="postiz-content" className="block text-sm font-medium">
            Content
          </label>
          <button
            type="button"
            onClick={aiDraft}
            disabled={aiBusy}
            className="text-xs text-purple-700 underline disabled:opacity-50"
          >
            {aiBusy ? "Drafting…" : "AI draft"}
          </button>
        </div>
        <textarea
          id="postiz-content"
          value={draft.content}
          onChange={(e) => setDraft({ content: e.target.value })}
          rows={6}
          className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
          placeholder="What's the post?"
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Media ({draft.images.length})</div>
        {draft.images.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {draft.images.map((img) => (
              <li
                key={img.id}
                className="flex items-center gap-2 rounded border bg-gray-50 px-2 py-1 text-xs"
              >
                <span className="max-w-[200px] truncate">
                  {img.path.split("/").pop() ?? img.id}
                </span>
                <button type="button" onClick={() => removeImage(img.id)} className="text-red-600">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            type="url"
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            className="flex-1 rounded border border-gray-300 p-2 text-sm"
            placeholder="https://cloudless.gr/some-image.png"
          />
          <button
            type="button"
            onClick={addImageByUrl}
            disabled={!imageUrlInput.trim()}
            className="rounded border border-blue-600 px-3 py-1 text-sm text-blue-700 disabled:opacity-50"
          >
            Add URL
          </button>
          <label className="cursor-pointer rounded border border-gray-300 px-3 py-1 text-sm text-gray-700">
            <input
              type="file"
              accept={POSTIZ_FILE_ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void addImageByFile(f);
                e.target.value = "";
              }}
            />
            Upload file
          </label>
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="postiz-schedule" className="block text-sm font-medium">
            Schedule at (local time)
          </label>
          <button type="button" onClick={findNextSlot} className="text-xs text-blue-600 underline">
            Use next free slot
          </button>
        </div>
        <input
          id="postiz-schedule"
          type="datetime-local"
          value={draft.scheduleAt}
          onChange={(e) => setDraft({ scheduleAt: e.target.value })}
          className="rounded border border-gray-300 p-2 text-sm"
        />
      </div>

      {selectedIntegrations.length > 0 && (
        <ProviderSettings
          integrations={selectedIntegrations}
          overrides={draft.settingsOverrides}
          onChange={(overrides) => setDraft({ settingsOverrides: overrides })}
        />
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || !draft.content || draft.selectedIds.length === 0}
          onClick={() => onSubmit("now")}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {draft.id ? "Update & post now" : "Post now"}
        </button>
        <button
          type="button"
          disabled={
            submitting || !draft.content || draft.selectedIds.length === 0 || !draft.scheduleAt
          }
          onClick={() => onSubmit("schedule")}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {draft.id ? "Update schedule" : "Schedule"}
        </button>
        <button
          type="button"
          disabled={submitting || !draft.content || draft.selectedIds.length === 0}
          onClick={() => onSubmit("draft")}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-50"
        >
          {draft.id ? "Save changes" : "Save draft"}
        </button>
      </div>

      {feedback && <p className="text-sm">{feedback}</p>}
    </div>
  );
}

function ScheduleTab({
  posts,
  onReload,
  onEdit,
}: {
  posts: PostizPost[] | null;
  onReload: () => void;
  onEdit: (post: PostizPost) => void;
}) {
  if (posts === null) return <p>Loading…</p>;
  if (posts.length === 0) return <p className="text-gray-600">No posts in the current window.</p>;

  const onDelete = async (id: string) => {
    // `globalThis.confirm` satisfies SonarCloud `prefer-global-this` (S7059);
    // direct `confirm` would also lint as `no-alert`.
    if (!globalThis.confirm("Delete this post?")) return;
    const res = await fetch(`/api/admin/postiz/posts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) onReload();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={onReload} className="text-sm text-blue-600 underline">
          Refresh
        </button>
      </div>
      <ul className="divide-y rounded border">
        {posts.map((p) => (
          <li key={p.id} className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {new Date(p.publishDate).toLocaleString()} · {p.state} · {p.integration.name} (
                {postIdentifier(p)})
              </div>
              <div className="flex gap-3 text-xs">
                {(p.state === "QUEUE" || p.state === "DRAFT") && (
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="text-blue-600 underline"
                  >
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="text-red-600 underline"
                >
                  Delete
                </button>
              </div>
            </div>
            <pre className="font-sans text-sm whitespace-pre-wrap">{p.content}</pre>
            {p.releaseURL && (
              <a
                href={p.releaseURL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 underline"
              >
                View published →
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATE_COLORS: Record<PostizPost["state"], string> = {
  QUEUE: "bg-blue-100 text-blue-800 border-blue-300",
  PUBLISHED: "bg-green-100 text-green-800 border-green-300",
  ERROR: "bg-red-100 text-red-800 border-red-300",
  DRAFT: "bg-gray-100 text-gray-700 border-gray-300",
};

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

function CalendarTab({ posts, onReload }: { posts: PostizPost[] | null; onReload: () => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const byDay = useMemo(() => {
    const map = new Map<string, PostizPost[]>();
    for (const p of posts ?? []) {
      const d = new Date(p.publishDate);
      if (d.getFullYear() !== year || d.getMonth() !== month) continue;
      const key = d.toISOString().slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts, year, month]);

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number; key: string } | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key });
  }

  const stepMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  if (posts === null) return <p>Loading…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => stepMonth(-1)}
            className="rounded border px-2 py-1 text-sm"
          >
            ←
          </button>
          <span className="text-sm font-medium">
            {MONTHS[month]} {year}
          </span>
          <button
            type="button"
            onClick={() => stepMonth(1)}
            className="rounded border px-2 py-1 text-sm"
          >
            →
          </button>
        </div>
        <button type="button" onClick={onReload} className="text-sm text-blue-600 underline">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="p-1 text-center font-medium text-gray-500">
            {d}
          </div>
        ))}
        {cells.map((cell, idx) =>
          cell === null ? (
            <div
              key={`empty-${idx}`}
              className="min-h-[80px] rounded border border-dashed border-gray-100"
            />
          ) : (
            <div
              key={cell.key}
              className="min-h-[80px] space-y-0.5 rounded border border-gray-200 p-1"
            >
              <div className="text-right text-[10px] text-gray-500">{cell.day}</div>
              {(byDay.get(cell.key) ?? []).slice(0, 3).map((p) => (
                <div
                  key={p.id}
                  className={`truncate rounded border px-1 py-0.5 text-[10px] ${STATE_COLORS[p.state]}`}
                  title={`${p.integration.name} — ${p.state}\n${p.content}`}
                >
                  {postIdentifier(p)}: {p.content.slice(0, 18)}
                </div>
              ))}
              {(byDay.get(cell.key)?.length ?? 0) > 3 && (
                <div className="text-[10px] text-gray-500">
                  +{(byDay.get(cell.key)?.length ?? 0) - 3} more
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* -------- Provider settings -------- */

function ProviderSettings({
  integrations,
  overrides,
  onChange,
}: {
  integrations: PostizIntegration[];
  overrides: Record<string, Record<string, unknown>>;
  onChange: (next: Record<string, Record<string, unknown>>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded border border-gray-200">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between p-2 text-left text-sm font-medium"
      >
        <span>
          Provider-specific settings ({integrations.length} channel
          {integrations.length === 1 ? "" : "s"})
        </span>
        <span className="text-gray-500">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-gray-200 p-3">
          {integrations.map((i) => (
            <ProviderSettingsRow
              key={i.id}
              integration={i}
              value={overrides[i.id] ?? {}}
              onChange={(next) => onChange({ ...overrides, [i.id]: next })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderSettingsRow({
  integration,
  value,
  onChange,
}: {
  integration: PostizIntegration;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const idPrefix = `psr-${integration.id}`;
  const id = integration.identifier;
  const set = (patch: Record<string, unknown>) => onChange({ ...value, ...patch });

  if (id === "tiktok") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Privacy</span>
          <select
            value={String(value.privacy_level ?? "PUBLIC_TO_EVERYONE")}
            onChange={(e) => set({ privacy_level: e.target.value })}
            className="rounded border border-gray-300 p-1 text-sm"
          >
            <option value="PUBLIC_TO_EVERYONE">Public</option>
            <option value="MUTUAL_FOLLOW_FRIENDS">Friends</option>
            <option value="SELF_ONLY">Private</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.comment !== false}
            onChange={(e) => set({ comment: e.target.checked })}
          />
          Allow comments
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.duet !== false}
            onChange={(e) => set({ duet: e.target.checked })}
          />
          Allow duet
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.stitch !== false}
            onChange={(e) => set({ stitch: e.target.checked })}
          />
          Allow stitch
        </label>
      </fieldset>
    );
  }

  if (id === "youtube") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-600">Title</span>
          <input
            id={`${idPrefix}-title`}
            type="text"
            value={String(value.title ?? "")}
            onChange={(e) => set({ title: e.target.value })}
            className="w-full rounded border border-gray-300 p-1 text-sm"
            placeholder="cloudless.gr post"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Visibility</span>
          <select
            value={String(value.type ?? "public")}
            onChange={(e) => set({ type: e.target.value })}
            className="rounded border border-gray-300 p-1 text-sm"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Made for kids</span>
          <select
            value={String(value.selfDeclaredMadeForKids ?? "no")}
            onChange={(e) => set({ selfDeclaredMadeForKids: e.target.value })}
            className="rounded border border-gray-300 p-1 text-sm"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
      </fieldset>
    );
  }

  if (id === "discord" || id === "slack") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-gray-600">Target channel</span>
          <input
            id={`${idPrefix}-channel`}
            type="text"
            value={String(value.channel ?? "")}
            onChange={(e) => set({ channel: e.target.value })}
            className="w-full rounded border border-gray-300 p-1 text-sm"
            placeholder={id === "discord" ? "#general or channel id" : "C0123ABCDE"}
          />
        </label>
      </fieldset>
    );
  }

  if (id === "x") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Who can reply</span>
          <select
            value={String(value.who_can_reply_post ?? "everyone")}
            onChange={(e) => set({ who_can_reply_post: e.target.value })}
            className="rounded border border-gray-300 p-1 text-sm"
          >
            <option value="everyone">Everyone</option>
            <option value="following">People you follow</option>
            <option value="mentionedUsers">Mentioned users only</option>
          </select>
        </label>
      </fieldset>
    );
  }

  if (id === "linkedin" || id === "linkedin-page") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={value.post_as_images_carousel === true}
            onChange={(e) => set({ post_as_images_carousel: e.target.checked })}
          />
          Post images as carousel
        </label>
      </fieldset>
    );
  }

  if (id === "instagram" || id === "instagram-standalone") {
    return (
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-gray-700">
          {integration.name} ({id})
        </legend>
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">Post type</span>
          <select
            value={String(value.post_type ?? "post")}
            onChange={(e) => set({ post_type: e.target.value })}
            className="rounded border border-gray-300 p-1 text-sm"
          >
            <option value="post">Feed post</option>
            <option value="reel">Reel</option>
            <option value="story">Story</option>
          </select>
        </label>
      </fieldset>
    );
  }

  return (
    <div className="text-xs text-gray-500">
      {integration.name} ({id}) — no provider-specific knobs surfaced here. Postiz defaults apply.
    </div>
  );
}

/**
 * Maps a Postiz integration to the minimal valid `settings` object for the
 * create-post API. The ProviderSettings UI overrides specific fields on top
 * of these baselines — what gets posted is `{ ...settingsFor(i), ...overrides }`.
 */
function settingsFor(i: PostizIntegration): { __type: string } & Record<string, unknown> {
  switch (i.identifier) {
    case "x":
      return { __type: "x", who_can_reply_post: "everyone" };
    case "linkedin":
      return { __type: "linkedin", post_as_images_carousel: false };
    case "linkedin-page":
      return { __type: "linkedin-page", post_as_images_carousel: false };
    case "instagram":
      return { __type: "instagram", post_type: "post" };
    case "instagram-standalone":
      return { __type: "instagram-standalone", post_type: "post" };
    case "facebook":
      return { __type: "facebook" };
    case "youtube":
      return {
        __type: "youtube",
        title: "cloudless.gr post",
        type: "public",
        selfDeclaredMadeForKids: "no",
      };
    case "tiktok":
      return {
        __type: "tiktok",
        privacy_level: "PUBLIC_TO_EVERYONE",
        duet: true,
        stitch: true,
        comment: true,
        autoAddMusic: "no",
        brand_content_toggle: false,
        brand_organic_toggle: false,
        content_posting_method: "DIRECT_POST",
      };
    case "discord":
      return { __type: "discord", channel: "" };
    case "slack":
      return { __type: "slack", channel: "" };
    case "telegram":
    case "threads":
    case "mastodon":
    case "bluesky":
    case "nostr":
    case "vk":
    case "kick":
      return { __type: i.identifier };
    default:
      return { __type: i.identifier };
  }
}
