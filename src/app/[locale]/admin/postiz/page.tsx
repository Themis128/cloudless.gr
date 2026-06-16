"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import type {
  PostizIntegration,
  PostizPost,
  CreatePostBody,
} from "@/lib/postiz";

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
 *   DELETE /api/admin/postiz/posts/:id     → delete a post
 *   POST   /api/admin/postiz/upload        → upload media by URL
 *   GET    /api/admin/postiz/slot?id=...   → next free time slot
 */
export default function PostizAdminPage() {
  const [tab, setTab] = useState<"channels" | "compose" | "schedule">(
    "compose",
  );
  const [integrations, setIntegrations] = useState<PostizIntegration[] | null>(
    null,
  );
  const [posts, setPosts] = useState<PostizPost[] | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reloadIntegrations = useCallback(async () => {
    const res = await fetch("/api/admin/postiz/integrations");
    if (res.status === 503) {
      setConfigured(false);
      return;
    }
    setConfigured(true);
    if (!res.ok) {
      setError(`integrations: ${res.status}`);
      return;
    }
    const data = (await res.json()) as { integrations: PostizIntegration[] };
    setIntegrations(data.integrations ?? []);
  }, []);

  const reloadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/postiz/posts");
    if (res.status === 503) {
      setConfigured(false);
      return;
    }
    setConfigured(true);
    if (!res.ok) {
      setError(`posts: ${res.status}`);
      return;
    }
    const data = (await res.json()) as { posts: PostizPost[] };
    setPosts(data.posts ?? []);
  }, []);

  useEffect(() => {
    // reloadIntegrations / reloadPosts are async; the setState calls inside
    // them happen after the fetch resolves, not synchronously in the effect
    // body. The new react-hooks/set-state-in-effect rule can't tell the
    // difference. Matches the existing pattern in AuthContext.tsx:199.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadIntegrations();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadPosts();
  }, [reloadIntegrations, reloadPosts]);

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
        {(["compose", "schedule", "channels"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm capitalize ${
              tab === t
                ? "border-b-2 border-blue-600 font-medium text-blue-700"
                : "text-gray-600"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "channels" && (
        <ChannelsTab
          integrations={integrations}
          onReload={reloadIntegrations}
        />
      )}
      {tab === "compose" && (
        <ComposeTab
          integrations={integrations ?? []}
          onPosted={() => {
            void reloadPosts();
            setTab("schedule");
          }}
        />
      )}
      {tab === "schedule" && (
        <ScheduleTab posts={posts} onReload={reloadPosts} />
      )}
    </div>
  );
}

function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Postiz not configured</h1>
      <p className="text-gray-700">
        Set <code>POSTIZ_API_KEY</code> (and optionally{" "}
        <code>POSTIZ_BASE_URL</code>) in SSM under{" "}
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
        After setting the SSM parameter, the Lambda needs to refresh its config
        — either re-deploy or wait out the SSM cache TTL.
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
        <p className="text-gray-700">
          No channels connected yet. Connect them via the Postiz UI.
        </p>
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
        <button
          type="button"
          onClick={onReload}
          className="text-sm text-blue-600 underline"
        >
          Refresh
        </button>
      </div>
      <ul className="divide-y rounded border">
        {integrations.map((i) => (
          <li
            key={i.id}
            className="flex items-center justify-between gap-3 p-3"
          >
            <div>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-gray-500">
                {i.identifier} · {i.id}
              </div>
            </div>
            {i.disabled && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                disabled
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComposeTab({
  integrations,
  onPosted,
}: {
  integrations: PostizIntegration[];
  onPosted: () => void;
}) {
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedIntegrations = useMemo(
    () => integrations.filter((i) => selectedIds.includes(i.id)),
    [integrations, selectedIds],
  );

  const toggleId = (id: string) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const onSubmit = async (mode: "now" | "schedule" | "draft") => {
    setSubmitting(true);
    setFeedback(null);
    try {
      let image: Array<{ id: string; path: string }> = [];
      if (imageUrl.trim()) {
        const up = await fetch("/api/admin/postiz/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl.trim() }),
        });
        if (!up.ok) {
          setFeedback(`Upload failed: ${up.status}`);
          setSubmitting(false);
          return;
        }
        const uploaded = (await up.json()) as { id: string; path: string };
        image = [uploaded];
      }

      const body: CreatePostBody = {
        type: mode,
        date:
          mode === "schedule" && scheduleAt
            ? new Date(scheduleAt).toISOString()
            : new Date().toISOString(),
        shortLink: false,
        tags: [],
        posts: selectedIntegrations.map((i) => ({
          integration: { id: i.id },
          value: [{ content, image }],
          settings: settingsFor(i),
        })),
      };

      const res = await fetch("/api/admin/postiz/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        setFeedback(`Failed: ${res.status} ${txt.slice(0, 120)}`);
        setSubmitting(false);
        return;
      }
      setFeedback(`✅ Posted (${mode})`);
      setContent("");
      setImageUrl("");
      onPosted();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="postiz-channels"
          className="mb-1 block text-sm font-medium"
        >
          Channels ({selectedIds.length} selected)
        </label>
        <div id="postiz-channels" className="flex flex-wrap gap-2">
          {integrations.map((i) => {
            const on = selectedIds.includes(i.id);
            return (
              <button
                type="button"
                key={i.id}
                onClick={() => toggleId(i.id)}
                className={`rounded border px-3 py-1 text-sm ${
                  on
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-700"
                }`}
              >
                {i.name} <span className="text-xs">({i.identifier})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label
          htmlFor="postiz-content"
          className="mb-1 block text-sm font-medium"
        >
          Content
        </label>
        <textarea
          id="postiz-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className="w-full rounded border border-gray-300 p-2 font-mono text-sm"
          placeholder="What's the post?"
        />
      </div>

      <div>
        <label
          htmlFor="postiz-image"
          className="mb-1 block text-sm font-medium"
        >
          Media URL (optional)
        </label>
        <input
          id="postiz-image"
          type="url"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full rounded border border-gray-300 p-2 text-sm"
          placeholder="https://cloudless.gr/some-image.png"
        />
        <p className="mt-1 text-xs text-gray-500">
          Uploaded to Postiz via /upload-from-url before posting.
        </p>
      </div>

      <div>
        <label
          htmlFor="postiz-schedule"
          className="mb-1 block text-sm font-medium"
        >
          Schedule at (local time)
        </label>
        <input
          id="postiz-schedule"
          type="datetime-local"
          value={scheduleAt}
          onChange={(e) => setScheduleAt(e.target.value)}
          className="rounded border border-gray-300 p-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={
            submitting || !content || selectedIds.length === 0
          }
          onClick={() => onSubmit("now")}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Post now
        </button>
        <button
          type="button"
          disabled={
            submitting || !content || selectedIds.length === 0 || !scheduleAt
          }
          onClick={() => onSubmit("schedule")}
          className="rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Schedule
        </button>
        <button
          type="button"
          disabled={
            submitting || !content || selectedIds.length === 0
          }
          onClick={() => onSubmit("draft")}
          className="rounded bg-gray-200 px-4 py-2 text-sm font-medium text-gray-800 disabled:opacity-50"
        >
          Save draft
        </button>
      </div>

      {feedback && <p className="text-sm">{feedback}</p>}
    </div>
  );
}

function ScheduleTab({
  posts,
  onReload,
}: {
  posts: PostizPost[] | null;
  onReload: () => void;
}) {
  if (posts === null) return <p>Loading…</p>;
  if (posts.length === 0)
    return <p className="text-gray-600">No posts in the current window.</p>;

  const onDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/admin/postiz/posts/${id}`, {
      method: "DELETE",
    });
    if (res.ok) onReload();
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReload}
          className="text-sm text-blue-600 underline"
        >
          Refresh
        </button>
      </div>
      <ul className="divide-y rounded border">
        {posts.map((p) => (
          <li key={p.id} className="space-y-1 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {new Date(p.publishDate).toLocaleString()} · {p.state} ·{" "}
                {p.integration.name} ({p.integration.identifier})
              </div>
              <button
                type="button"
                onClick={() => onDelete(p.id)}
                className="text-xs text-red-600 underline"
              >
                Delete
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm">
              {p.content}
            </pre>
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

/* -------- Provider settings helper -------- */

/**
 * Maps a Postiz integration to the minimal valid `settings` object for the
 * create-post API. Extend this as you wire up more provider-specific knobs in
 * the UI (TikTok privacy_level, YouTube title, etc.).
 */
function settingsFor(
  i: PostizIntegration,
): { __type: string } & Record<string, unknown> {
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
