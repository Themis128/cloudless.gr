/**
 * Tests for /api/admin/appflowy/{blog,docs,faqs,search,submissions,analytics,comments}.
 * The faqs route exercises the shared createAppFlowyAdminHandlers factory
 * (also used by services/case-studies/testimonials).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const apiAuth = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () =>
    apiAuth.ok
      ? { ok: true, user: { id: "u1" } }
      : { ok: false, response: NextResponse.json({ error: "no" }, { status: 401 }) }
  ),
}));

const appflowy = vi.hoisted(() => ({
  isAppFlowyConfigured: vi.fn(),
  listAllWorkspaces: vi.fn(),
  listWorkspaceViews: vi.fn(),
  searchDocuments: vi.fn(),
  listAllUsers: vi.fn(),
}));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy")>();
  return { ...actual, ...appflowy };
});

const libs = vi.hoisted(() => ({
  getPosts: vi.fn(),
  getDocs: vi.fn(),
  getAllFaqsAdmin: vi.fn(),
  listSubmissions: vi.fn(),
  updateSubmissionStatus: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
}));
vi.mock("@/lib/appflowy-blog", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy-blog")>();
  return { ...actual, getPosts: libs.getPosts };
});
vi.mock("@/lib/appflowy-docs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy-docs")>();
  return { ...actual, getDocs: libs.getDocs };
});
vi.mock("@/lib/appflowy-faqs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy-faqs")>();
  return { ...actual, getAllFaqsAdmin: libs.getAllFaqsAdmin };
});
vi.mock("@/lib/appflowy-forms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy-forms")>();
  return {
    ...actual,
    listSubmissions: libs.listSubmissions,
    updateSubmissionStatus: libs.updateSubmissionStatus,
  };
});
vi.mock("@/lib/appflowy-comments", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/appflowy-comments")>();
  return {
    ...actual,
    listComments: libs.listComments,
    addComment: libs.addComment,
  };
});

import { GET as blogGet } from "@/app/api/admin/appflowy/blog/route";
import { GET as docsGet } from "@/app/api/admin/appflowy/docs/route";
import {
  GET as faqsGet,
  POST as faqsPost,
  PATCH as faqsPatch,
  DELETE as faqsDelete,
} from "@/app/api/admin/appflowy/faqs/route";
import { GET as searchGet } from "@/app/api/admin/appflowy/search/route";
import {
  GET as subsGet,
  PATCH as subsPatch,
} from "@/app/api/admin/appflowy/submissions/route";
import { GET as analyticsGet } from "@/app/api/admin/appflowy/analytics/route";
import {
  GET as commentsGet,
  POST as commentsPost,
} from "@/app/api/admin/appflowy/comments/route";

const B = "http://localhost/api/admin/appflowy";
const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
  appflowy.isAppFlowyConfigured.mockResolvedValue(true);
});

describe("appflowy blog + docs GET", () => {
  it("blog: 401 non-admin, lists posts, 500 on failure", async () => {
    apiAuth.ok = false;
    expect((await blogGet(new NextRequest(`${B}/blog`))).status).toBe(401);
    apiAuth.ok = true;

    libs.getPosts.mockResolvedValue([{ id: "p1" }]);
    const j = await (await blogGet(new NextRequest(`${B}/blog`))).json();
    expect(j.count).toBe(1);

    libs.getPosts.mockRejectedValue(new Error("x"));
    expect((await blogGet(new NextRequest(`${B}/blog`))).status).toBe(500);
  });

  it("docs: 503 unconfigured, lists docs", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect((await docsGet(new NextRequest(`${B}/docs`))).status).toBe(503);

    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    libs.getDocs.mockResolvedValue([{ id: "d1" }]);
    const j = await (await docsGet(new NextRequest(`${B}/docs`))).json();
    expect(j.count).toBe(1);

    libs.getDocs.mockRejectedValue(new Error("x"));
    expect((await docsGet(new NextRequest(`${B}/docs`))).status).toBe(500);
  });
});

describe("shared CMS handlers (faqs surface)", () => {
  it("GET: 401/503/list/500", async () => {
    apiAuth.ok = false;
    expect((await faqsGet(new NextRequest(`${B}/faqs`))).status).toBe(401);
    apiAuth.ok = true;

    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    const j = await (await faqsGet(new NextRequest(`${B}/faqs`))).json();
    expect(j.error).toContain("FAQs");

    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    libs.getAllFaqsAdmin.mockResolvedValue([{ q: "x" }]);
    const j2 = await (await faqsGet(new NextRequest(`${B}/faqs`))).json();
    expect(j2).toEqual({ faqs: [{ q: "x" }], count: 1 });

    libs.getAllFaqsAdmin.mockRejectedValue(new Error("x"));
    expect((await faqsGet(new NextRequest(`${B}/faqs`))).status).toBe(500);
  });

  it("POST: 503, bad JSON, missing required field, 501 write", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect((await faqsPost(post(`${B}/faqs`, {}))).status).toBe(503);
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);

    expect((await faqsPost(post(`${B}/faqs`, "{bad"))).status).toBe(400);
    expect((await faqsPost(post(`${B}/faqs`, {}))).status).toBe(400);
    expect(
      (await faqsPost(post(`${B}/faqs`, { question: "  " }))).status
    ).toBe(400);
    expect(
      (await faqsPost(post(`${B}/faqs`, { question: "q?" }))).status
    ).toBe(501);
  });

  it("PATCH: bad JSON, missing pageId, 501 write", async () => {
    expect((await faqsPatch(post(`${B}/faqs`, "{bad", "PATCH"))).status).toBe(
      400
    );
    expect((await faqsPatch(post(`${B}/faqs`, {}, "PATCH"))).status).toBe(400);
    expect(
      (await faqsPatch(post(`${B}/faqs`, { pageId: "p" }, "PATCH"))).status
    ).toBe(501);
  });

  it("DELETE: pageId required, 501 write", async () => {
    expect(
      (await faqsDelete(new NextRequest(`${B}/faqs`, { method: "DELETE" })))
        .status
    ).toBe(400);
    expect(
      (
        await faqsDelete(
          new NextRequest(`${B}/faqs?pageId=p`, { method: "DELETE" })
        )
      ).status
    ).toBe(501);
  });
});

describe("appflowy search", () => {
  it("type=users returns users; empty workspace 404s; empty q returns []", async () => {
    appflowy.listAllUsers.mockResolvedValue([{ name: "u" }]);
    const j = await (
      await searchGet(new NextRequest(`${B}/search?type=users`))
    ).json();
    expect(j.users).toHaveLength(1);

    appflowy.listAllWorkspaces.mockResolvedValue([]);
    expect(
      (await searchGet(new NextRequest(`${B}/search?q=x`))).status
    ).toBe(404);

    appflowy.listAllWorkspaces.mockResolvedValue([{ workspace_id: "w1" }]);
    const j2 = await (await searchGet(new NextRequest(`${B}/search`))).json();
    expect(j2).toEqual({ results: [], total: 0 });
    expect(appflowy.searchDocuments).not.toHaveBeenCalled();
  });

  it("maps views to results; 503 NotConfigured; 500 other", async () => {
    appflowy.listAllWorkspaces.mockResolvedValue([{ workspace_id: "w1" }]);
    appflowy.searchDocuments.mockResolvedValue([
      {
        view_id: "v1",
        name: "Doc",
        type: 0,
        last_edited_time: "t",
      },
    ]);
    const j = await (
      await searchGet(new NextRequest(`${B}/search?q=doc&limit=500`))
    ).json();
    expect(j.results[0]).toMatchObject({
      id: "v1",
      title: "Doc",
      url: "/appflowy/view/v1",
    });

    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    appflowy.searchDocuments.mockRejectedValue(
      new AppFlowyNotConfiguredError()
    );
    expect(
      (await searchGet(new NextRequest(`${B}/search?q=x`))).status
    ).toBe(503);

    appflowy.searchDocuments.mockRejectedValue(new Error("net"));
    expect(
      (await searchGet(new NextRequest(`${B}/search?q=x`))).status
    ).toBe(500);
  });
});

describe("appflowy submissions", () => {
  it("GET: 503 unconfigured, list with capped limit, 500 on failure", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect(
      (await subsGet(new NextRequest(`${B}/submissions`))).status
    ).toBe(503);

    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    libs.listSubmissions.mockResolvedValue([{ id: "s1" }]);
    const j = await (
      await subsGet(new NextRequest(`${B}/submissions?limit=500`))
    ).json();
    expect(j.count).toBe(1);
    expect(libs.listSubmissions).toHaveBeenCalledWith(100);

    libs.listSubmissions.mockRejectedValue(new Error("x"));
    expect(
      (await subsGet(new NextRequest(`${B}/submissions`))).status
    ).toBe(500);
  });

  it("PATCH: validation, status allowlist, update + failure paths", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect(
      (await subsPatch(post(`${B}/submissions`, {}, "PATCH"))).status
    ).toBe(503);
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);

    expect(
      (await subsPatch(post(`${B}/submissions`, "{bad", "PATCH"))).status
    ).toBe(400);
    expect(
      (await subsPatch(post(`${B}/submissions`, { pageId: "p" }, "PATCH")))
        .status
    ).toBe(400);
    expect(
      (
        await subsPatch(
          post(`${B}/submissions`, { pageId: "p", status: "bogus" }, "PATCH")
        )
      ).status
    ).toBe(400);

    libs.updateSubmissionStatus.mockResolvedValue(true);
    const j = await (
      await subsPatch(
        post(
          `${B}/submissions`,
          { pageId: "p", status: "In Review" },
          "PATCH"
        )
      )
    ).json();
    expect(j.success).toBe(true);

    libs.updateSubmissionStatus.mockResolvedValue(false);
    expect(
      (
        await subsPatch(
          post(`${B}/submissions`, { pageId: "p", status: "Done" }, "PATCH")
        )
      ).status
    ).toBe(500);

    libs.updateSubmissionStatus.mockRejectedValue(new Error("x"));
    expect(
      (
        await subsPatch(
          post(`${B}/submissions`, { pageId: "p", status: "New" }, "PATCH")
        )
      ).status
    ).toBe(500);
  });
});

describe("appflowy analytics + comments", () => {
  it("analytics: 404 no workspace, maps views, 503/500 on error", async () => {
    appflowy.listAllWorkspaces.mockResolvedValue([]);
    expect(
      (await analyticsGet(new NextRequest(`${B}/analytics`))).status
    ).toBe(404);

    appflowy.listAllWorkspaces.mockResolvedValue([{ workspace_id: "w1" }]);
    appflowy.listWorkspaceViews.mockResolvedValue([
      { view_id: "v", name: "Page", type: 0, last_edited_time: "t" },
    ]);
    const j = await (
      await analyticsGet(new NextRequest(`${B}/analytics?days=7`))
    ).json();
    expect(j).toMatchObject({
      count: 1,
      days: 7,
      events: [{ id: "v", count: 1 }],
    });

    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    appflowy.listAllWorkspaces.mockRejectedValue(
      new AppFlowyNotConfiguredError()
    );
    expect(
      (await analyticsGet(new NextRequest(`${B}/analytics`))).status
    ).toBe(503);

    appflowy.listAllWorkspaces.mockRejectedValue(new Error("x"));
    expect(
      (await analyticsGet(new NextRequest(`${B}/analytics`))).status
    ).toBe(500);
  });

  it("comments GET: page_id required, lists, 500 on failure", async () => {
    expect(
      (await commentsGet(new NextRequest(`${B}/comments`))).status
    ).toBe(400);

    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect(
      (await commentsGet(new NextRequest(`${B}/comments?page_id=p`))).status
    ).toBe(503);
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);

    libs.listComments.mockResolvedValue([{ text: "hi" }]);
    const j = await (
      await commentsGet(new NextRequest(`${B}/comments?page_id=p`))
    ).json();
    expect(j.count).toBe(1);
    expect(libs.listComments).toHaveBeenCalledWith("p");

    libs.listComments.mockRejectedValue(new Error("x"));
    expect(
      (await commentsGet(new NextRequest(`${B}/comments?page_id=p`))).status
    ).toBe(500);
  });

  it("comments GET+POST: 503 when AppFlowy unconfigured", async () => {
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect(
      (await commentsGet(new NextRequest(`${B}/comments?page_id=p`))).status
    ).toBe(503);
    expect(
      (await commentsPost(post(`${B}/comments`, { pageId: "p", text: "t" })))
        .status
    ).toBe(503);
  });

  it("comments POST: validation, add, 500 on failure", async () => {
    expect(
      (await commentsPost(post(`${B}/comments`, {}))).status
    ).toBe(400);
    expect(
      (await commentsPost(post(`${B}/comments`, { pageId: 5, text: "t" })))
        .status
    ).toBe(400);

    libs.addComment.mockResolvedValue(true);
    const j = await (
      await commentsPost(post(`${B}/comments`, { pageId: "p", text: "t" }))
    ).json();
    expect(j.success).toBe(true);

    libs.addComment.mockResolvedValue(false);
    expect(
      (await commentsPost(post(`${B}/comments`, { pageId: "p", text: "t" })))
        .status
    ).toBe(500);
  });
});
