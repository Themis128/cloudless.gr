/**
 * Tests for the remaining /api/admin/postiz routes: root, posts list/create,
 * posts/bulk, posts/group/[id], ops, slot, upload-file, upload.
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

const postiz = vi.hoisted(() => ({
  isPostizConfigured: vi.fn(),
  listPostizIntegrations: vi.fn(),
  deletePostsByGroup: vi.fn(),
}));
vi.mock("@/lib/postiz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/postiz")>();
  return { ...actual, ...postiz };
});

const sa = vi.hoisted(() => ({
  listPostsInWindow: vi.fn(),
  createPostFromBody: vi.fn(),
  getOpsConsole: vi.fn(),
  runOpsAction: vi.fn(),
  isSocialAutoConfigured: vi.fn(),
  nextSlot: vi.fn(),
  uploadFileToSocialAuto: vi.fn(),
  uploadFromUrlToSocialAuto: vi.fn(),
}));
vi.mock("@/lib/socialauto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/socialauto")>();
  return { ...actual, ...sa };
});

import { GET as rootGet } from "@/app/api/admin/postiz/route";
import {
  GET as postsGet,
  POST as postsPost,
} from "@/app/api/admin/postiz/posts/route";
import { POST as bulkPost } from "@/app/api/admin/postiz/posts/bulk/route";
import { DELETE as groupDelete } from "@/app/api/admin/postiz/posts/group/[id]/route";
import {
  GET as opsGet,
  POST as opsPost,
} from "@/app/api/admin/postiz/ops/route";
import { GET as slotGet } from "@/app/api/admin/postiz/slot/route";
import { POST as uploadFilePost } from "@/app/api/admin/postiz/upload-file/route";
import { POST as uploadPost } from "@/app/api/admin/postiz/upload/route";

const P = "http://localhost/api/admin/postiz";
const req = (url: string, init?: RequestInit) =>
  new NextRequest(url, { method: "GET", ...init });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const VALID = { type: "schedule", posts: [{}] };

beforeEach(() => {
  vi.clearAllMocks();
  apiAuth.ok = true;
});

describe("postiz root + slot", () => {
  it("root GET: 503 unconfigured, lists integrations", async () => {
    postiz.isPostizConfigured.mockResolvedValue(false);
    expect((await rootGet(req(P))).status).toBe(503);

    postiz.isPostizConfigured.mockResolvedValue(true);
    postiz.listPostizIntegrations.mockResolvedValue([{ id: "i" }]);
    const j = await (await rootGet(req(P))).json();
    expect(j.total).toBe(1);
  });

  it("slot GET: id required, 503 unconfigured, returns slot", async () => {
    expect((await slotGet(req(`${P}/slot`), {})).status).toBe(400);

    sa.isSocialAutoConfigured.mockResolvedValue(false);
    expect((await slotGet(req(`${P}/slot?id=i1`))).status).toBe(503);

    sa.isSocialAutoConfigured.mockResolvedValue(true);
    sa.nextSlot.mockReturnValue({ date: "2026-01-01T10:00:00Z" });
    const j = await (await slotGet(req(`${P}/slot?id=i1`))).json();
    expect(j.date).toContain("T10:00");
    expect(sa.nextSlot).toHaveBeenCalledWith("i1");
  });
});

describe("posts list/create/bulk/group", () => {
  it("posts GET: window params + defaults; POST: validates + creates", async () => {
    sa.listPostsInWindow.mockResolvedValue([{ id: "p" }]);
    const j = await (
      await postsGet(req(`${P}/posts?startDate=a&endDate=b`), {})
    ).json();
    expect(j.posts).toHaveLength(1);
    expect(sa.listPostsInWindow).toHaveBeenCalledWith("a", "b");

    await postsGet(req(`${P}/posts`), {});
    const [start, end] = sa.listPostsInWindow.mock.calls[1];
    expect(new Date(start).getTime()).toBeLessThan(Date.now());
    expect(new Date(end).getTime()).toBeGreaterThan(Date.now());

    expect(
      (await postsPost(post(`${P}/posts`, "{bad"), {})).status
    ).toBe(400);
    expect((await postsPost(post(`${P}/posts`, {}), {})).status).toBe(400);

    sa.createPostFromBody.mockResolvedValue({ postIds: ["x"] });
    const res = await postsPost(post(`${P}/posts`, VALID), {});
    expect(res.status).toBe(201);
    expect((await res.json()).result).toEqual({ postIds: ["x"] });
  });

  it("bulk POST: validates items, caps at 30, reports 207 partials", async () => {
    expect((await bulkPost(post(`${P}/posts/bulk`, "{bad"), {})).status).toBe(
      400
    );
    expect((await bulkPost(post(`${P}/posts/bulk`, {}), {})).status).toBe(400);
    expect(
      (
        await bulkPost(
          post(`${P}/posts/bulk`, { items: Array(31).fill(VALID) }),
          {}
        )
      ).status
    ).toBe(400);
    expect(
      (
        await bulkPost(
          post(`${P}/posts/bulk`, { items: [VALID, { bad: true }] }),
          {}
        )
      ).status
    ).toBe(400);

    sa.createPostFromBody
      .mockResolvedValueOnce([{ postId: "a" }])
      .mockRejectedValueOnce(new Error("boom"))
      .mockRejectedValueOnce(
        new (await import("@/lib/socialauto")).SocialAutoApiError(500, "up err")
      );
    const res = await bulkPost(
      post(`${P}/posts/bulk`, { items: [VALID, VALID, VALID] }),
      {}
    );
    expect(res.status).toBe(207);
    const j = await res.json();
    expect(j.succeeded).toBe(1);
    expect(j.failed).toBe(2);
    expect(j.results[1].error).toBe("boom");
    expect(j.results[2]).toMatchObject({ ok: false, error: "up err", status: 500 });

    sa.createPostFromBody.mockResolvedValue([{ postId: "x" }]);
    const res2 = await bulkPost(
      post(`${P}/posts/bulk`, { items: [VALID] }),
      {}
    );
    expect(res2.status).toBe(201);
  });

  it("group DELETE: deletes all posts, 404-idempotent, error ladder", async () => {
    postiz.deletePostsByGroup.mockResolvedValue({ count: 4 });
    const j = await (
      await groupDelete(
        new NextRequest(`${P}/posts/group/g1`, { method: "DELETE" }),
        ctx("g1")
      )
    ).json();
    expect(j).toEqual({ deleted: true, count: 4 });

    const { PostizApiError, PostizNotConfiguredError } = await import(
      "@/lib/postiz"
    );
    postiz.deletePostsByGroup.mockRejectedValue(new PostizApiError(404, "x"));
    const j2 = await (
      await groupDelete(
        new NextRequest(`${P}/posts/group/g1`, { method: "DELETE" }),
        ctx("g1")
      )
    ).json();
    expect(j2.deleted).toBe(true);

    postiz.deletePostsByGroup.mockRejectedValue(new PostizApiError(500, "x"));
    expect(
      (
        await groupDelete(
          new NextRequest(`${P}/posts/group/g1`, { method: "DELETE" }),
          ctx("g1")
        )
      ).status
    ).toBe(502);

    postiz.deletePostsByGroup.mockRejectedValue(
      new PostizNotConfiguredError()
    );
    expect(
      (
        await groupDelete(
          new NextRequest(`${P}/posts/group/g1`, { method: "DELETE" }),
          ctx("g1")
        )
      ).status
    ).toBe(503);
  });
});

describe("ops console + actions", () => {
  it("GET returns console; POST validates action allowlist", async () => {
    sa.getOpsConsole.mockResolvedValue({ services: {} });
    const j = await (await opsGet(req(`${P}/ops`), {})).json();
    expect(j.services).toBeDefined();

    expect(
      (await opsPost(post(`${P}/ops`, "{bad"), {})).status
    ).toBe(400);
    expect(
      (await opsPost(post(`${P}/ops`, { action: "rm -rf" }), {})).status
    ).toBe(400);
    expect(
      (await opsPost(post(`${P}/ops`, { action: "set-tiktok-audit" }), {}))
        .status
    ).toBe(400);

    sa.runOpsAction.mockResolvedValue({ healed: 2 });
    const j2 = await (
      await opsPost(post(`${P}/ops`, { action: "session-heal" }), {})
    ).json();
    expect(j2).toEqual({ ok: true, result: { healed: 2 } });

    await opsPost(
      post(`${P}/ops`, { action: "set-tiktok-audit", status: "pass" }),
      {}
    );
    expect(sa.runOpsAction).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: "set-tiktok-audit", status: "pass" })
    );
  });
});

describe("upload-file + upload", () => {
  const formReq = (build: (f: FormData) => void) => {
    const form = new FormData();
    build(form);
    // In the vitest env, undici's File (from NextRequest.formData()) isn't an
    // instance of the test realm's Blob, so the route's `instanceof Blob`
    // check would always fail. Stub the request's formData() instead — the
    // FormData contents and all route logic stay real.
    return {
      formData: async () => form,
    } as unknown as NextRequest;
  };

  it("upload-file: missing/empty/oversize/traversal/bad-mime/success", async () => {
    expect((await uploadFilePost(formReq(() => {}), {})).status).toBe(400);

    expect(
      (
        await uploadFilePost(
          formReq((f) => f.append("file", new Blob([]), "a.png")),
          {}
        )
      ).status
    ).toBe(400);

    const big = new Blob([new Uint8Array(26 * 1024 * 1024)]);
    expect(
      (
        await uploadFilePost(
          formReq((f) => f.append("file", big, "a.png")),
          {}
        )
      ).status
    ).toBe(413);

    expect(
      (
        await uploadFilePost(
          formReq((f) => {
            f.append("file", new Blob(["x"]), "img.png");
            f.append("filename", "../evil.png");
          }),
          {}
        )
      ).status
    ).toBe(400);

    expect(
      (
        await uploadFilePost(
          formReq((f) =>
            f.append("file", new Blob(["x"], { type: "text/plain" }), "a.txt")
          ),
          {}
        )
      ).status
    ).toBe(415);

    sa.uploadFileToSocialAuto.mockResolvedValue({ id: "m1", url: "u" });
    const res = await uploadFilePost(
      formReq((f) =>
        f.append("file", new Blob(["x"], { type: "image/png" }), "ok.png")
      ),
      {}
    );
    expect(res.status).toBe(201);
    expect((await res.json()).id).toBe("m1");
    expect(sa.uploadFileToSocialAuto).toHaveBeenCalledWith(
      expect.any(Blob),
      "ok.png"
    );
  });

  it("upload: missing url, SSRF-blocked hosts, success", async () => {
    expect((await uploadPost(post(`${P}/upload`, "{bad"), {})).status).toBe(
      400
    );
    expect((await uploadPost(post(`${P}/upload`, {}), {})).status).toBe(400);

    for (const url of [
      "not-a-url",
      "ftp://x.com/f",
      "http://localhost/x",
      "https://foo.localhost/x",
      "http://0.0.0.0/x",
      "http://127.0.0.1/x",
      "http://10.1.2.3/x",
      "http://169.254.1.1/x",
      "http://172.16.0.1/x",
      "http://172.31.9.9/x",
      "http://192.168.1.1/x",
      "http://[::1]/x",
      "http://[fe80::1]/x",
      "http://[fd00::1]/x",
    ]) {
      const res = await uploadPost(post(`${P}/upload`, { url }), {});
      expect(res.status, url).toBe(400);
    }

    sa.uploadFromUrlToSocialAuto.mockResolvedValue({ id: "m9" });
    const res = await uploadPost(
      post(`${P}/upload`, { url: "https://cdn.example.com/img.png" }),
      {}
    );
    expect(res.status).toBe(201);
    expect(sa.uploadFromUrlToSocialAuto).toHaveBeenCalledWith(
      "https://cdn.example.com/img.png"
    );
  });
});
