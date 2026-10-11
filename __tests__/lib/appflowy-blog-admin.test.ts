/**
 * appflowy-blog-admin — editorial list/find/status-flip with the
 * AppFlowy client boundary faked; real parsing, prefix, and
 * status-name logic exercised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockConfigured = vi.fn();
const mockWorkspaces = vi.fn();
const mockViews = vi.fn();
const mockGetDoc = vi.fn();
const mockExtract = vi.fn();
const mockRename = vi.fn();
const mockShare = vi.fn();

vi.mock("@/lib/appflowy", () => ({
  isAppFlowyConfigured: (...a: unknown[]) => mockConfigured(...a),
  listAllWorkspaces: (...a: unknown[]) => mockWorkspaces(...a),
  listAllViewsDeep: (...a: unknown[]) => mockViews(...a),
  getDocument: (...a: unknown[]) => mockGetDoc(...a),
  extractDocText: (...a: unknown[]) => mockExtract(...a),
  updateViewName: (...a: unknown[]) => mockRename(...a),
}));

vi.mock("@/lib/postiz-blog", () => ({
  scheduleBlogShare: (...a: unknown[]) => mockShare(...a),
}));

const mockFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
vi.stubGlobal("fetch", mockFetch);

import {
  listEditorialPosts,
  findEditorialPost,
  setEditorialStatus,
} from "@/lib/appflowy-blog-admin";

const view = (id: string, name: string, lastEdited = "2026-10-01T00:00:00Z") => ({
  view_id: id,
  name,
  last_edited_time: lastEdited,
});

const DOC = [
  "**Name**: My Post",
  "**Slug**: my-post",
  "**Status**: Draft",
  "**Category**: Cloud",
  "**ReadTime**: 7 min read",
  "**Date**: 2026-10-02",
].join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigured.mockResolvedValue(true);
  mockWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
  mockGetDoc.mockResolvedValue({});
  mockExtract.mockResolvedValue(DOC);
  mockShare.mockResolvedValue({ skipped: "disabled" });
});

describe("listEditorialPosts", () => {
  it("returns [] when unconfigured / no workspace", async () => {
    mockConfigured.mockResolvedValue(false);
    expect(await listEditorialPosts()).toEqual([]);
    mockConfigured.mockResolvedValue(true);
    mockWorkspaces.mockResolvedValue([]);
    expect(await listEditorialPosts()).toEqual([]);
  });

  it("filters to editorial prefixes and maps fields", async () => {
    mockViews.mockResolvedValue([
      view("v1", "[Draft] My Post"),
      view("v2", "Plain published"),           // no prefix → skipped
      view("v3", "[Review] Second", "2026-10-05"),
      view("v4", "[Archived] Old"),
    ]);
    const posts = await listEditorialPosts();
    expect(posts.map((p) => p.id)).toEqual(["v1", "v3", "v4"]);
    const p = posts.find((x) => x.id === "v1")!;
    expect(p).toMatchObject({
      title: "My Post",
      slug: "my-post",
      status: "Draft",
      category: "Cloud",
      readTime: "7 min read",
      createdAt: "2026-10-02",
      url: "https://cloudless.gr/en/blog/my-post",
    });
  });

  it("sorts newest first and skips unreadable docs", async () => {
    mockViews.mockResolvedValue([
      view("old", "[Draft] Old", "2026-09-01T00:00:00Z"),
      view("new", "[Draft] New", "2026-10-09T00:00:00Z"),
      view("bad", "[Draft] Broken"),
    ]);
    mockExtract.mockImplementation(async () => DOC);
    mockGetDoc.mockImplementation(async (_w: string, id: string) => {
      if (id === "bad") throw new Error("doc gone");
      return {};
    });
    // doc fields carry the Date that sorts — give each doc its own
    mockExtract
      .mockResolvedValueOnce(DOC.replace("2026-10-02", "2026-09-01"))
      .mockResolvedValueOnce(DOC.replace("2026-10-02", "2026-10-09"));
    const posts = await listEditorialPosts();
    expect(posts.map((p) => p.id)).toEqual(["new", "old"]);
  });

  it("falls back to the view name for title/slug", async () => {
    mockExtract.mockResolvedValue("no fields here");
    mockViews.mockResolvedValue([view("v1", "[Review] My Title!")]);
    const [p] = await listEditorialPosts();
    expect(p.title).toBe("My Title!");
    expect(p.slug).toBe("my-title");
    expect(p.status).toBe("In Review");
  });

  it("swallows top-level errors", async () => {
    mockViews.mockRejectedValue(new Error("api down"));
    expect(await listEditorialPosts()).toEqual([]);
  });
});

describe("findEditorialPost", () => {
  it("returns null for empty input / unconfigured / no workspace", async () => {
    expect(await findEditorialPost("  ")).toBeNull();
    mockConfigured.mockResolvedValue(false);
    expect(await findEditorialPost("x")).toBeNull();
    mockConfigured.mockResolvedValue(true);
    mockWorkspaces.mockResolvedValue([]);
    expect(await findEditorialPost("x")).toBeNull();
  });

  it("resolves by view_id, slug, and title-slug", async () => {
    mockViews.mockResolvedValue([view("v9", "[Draft] My Post")]);
    expect((await findEditorialPost("v9"))!.id).toBe("v9");

    mockViews.mockResolvedValue([view("v1", "[Draft] Other")]);
    // doc fields give slug "my-post" → matches regardless of the view name
    expect((await findEditorialPost("my-post"))!.id).toBe("v1");
    // slugify(stripPrefix(name)) — the third match path
    expect((await findEditorialPost("other"))!.id).toBe("v1");
    expect(await findEditorialPost("nomatch")).toBeNull();
  });

  it("skips unreadable docs while scanning and returns null when nothing matches", async () => {
    mockViews.mockResolvedValue([
      view("v1", "[Draft] Broken"),
      view("v2", "[Draft] Working"),
    ]);
    mockGetDoc.mockImplementation(async (_w: string, id: string) => {
      if (id === "v1") throw new Error("gone");
      return {};
    });
    mockExtract.mockResolvedValue(DOC); // slug=my-post
    expect((await findEditorialPost("my-post"))!.id).toBe("v2");
    expect(await findEditorialPost("nomatch")).toBeNull();
  });

  it("swallows outer errors", async () => {
    mockViews.mockRejectedValue(new Error("api"));
    expect(await findEditorialPost("x")).toBeNull();
  });
});

describe("setEditorialStatus", () => {
  it("fails when unconfigured / no workspace / view missing", async () => {
    mockConfigured.mockResolvedValue(false);
    expect(await setEditorialStatus("v1", "Draft")).toBe(false);
    mockConfigured.mockResolvedValue(true);
    mockWorkspaces.mockResolvedValue([]);
    expect(await setEditorialStatus("v1", "Draft")).toBe(false);
    mockWorkspaces.mockResolvedValue([{ workspace_id: "ws1" }]);
    mockViews.mockResolvedValue([]);
    expect(await setEditorialStatus("v1", "Draft")).toBe(false);
  });

  it("renames with the right prefix per status", async () => {
    mockViews.mockResolvedValue([view("v1", "[Draft] My Post")]);
    mockRename.mockResolvedValue(true);
    expect(await setEditorialStatus("v1", "In Review")).toBe(true);
    expect(mockRename).toHaveBeenCalledWith("ws1", "v1", "[Review] My Post");

    mockViews.mockResolvedValue([view("v1", "[Review] My Post")]);
    await setEditorialStatus("v1", "Archived");
    expect(mockRename).toHaveBeenCalledWith("ws1", "v1", "[Archived] My Post");

    await setEditorialStatus("v1", "Draft");
    expect(mockRename).toHaveBeenCalledWith("ws1", "v1", "[Draft] My Post");
  });

  it("returns false when the rename call fails", async () => {
    mockViews.mockResolvedValue([view("v1", "[Draft] My Post")]);
    mockRename.mockResolvedValue(false);
    expect(await setEditorialStatus("v1", "In Review")).toBe(false);
    mockRename.mockRejectedValue(new Error("boom"));
    expect(await setEditorialStatus("v1", "In Review")).toBe(false);
  });

  it("Published → bare name + fires the social share and n8n multicaption", async () => {
    mockViews.mockResolvedValue([view("v1", "[Draft] My Post")]);
    mockRename.mockResolvedValue(true);
    mockShare.mockResolvedValue({ ok: true, postIds: ["p1", "p2"] });
    expect(await setEditorialStatus("v1", "Published")).toBe(true);
    expect(mockRename).toHaveBeenCalledWith("ws1", "v1", "My Post");

    await new Promise((r) => setTimeout(r, 10));
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({ pageId: "v1", title: "My Post", url: "https://cloudless.gr/en/blog/my-post" })
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/webhook/postiz-ai-multicaption"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
