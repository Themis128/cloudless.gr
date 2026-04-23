import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { deleteCalendarItem, getCalendarItems } from "@/lib/content-calendar";

const requireAdminMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: requireAdminMock,
}));

function makeGet(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "GET" });
}

function makePost(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makePatch(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDelete(path: string): NextRequest {
  return new NextRequest(`http://localhost:4500${path}`, { method: "DELETE" });
}

function clearCalendar() {
  getCalendarItems().forEach((i) => deleteCalendarItem(i.id));
}

describe("Admin Calendar API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockReturnValue({ ok: true, user: { sub: "admin" } });
    clearCalendar();
  });

  // ── GET /api/admin/calendar ──────────────────────────────────────────────────

  describe("GET /api/admin/calendar", () => {
    it("returns all items when no range", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      await POST(makePost("/api/admin/calendar/create", { title: "Post A", type: "social_post", platform: "linkedin", date: "2026-05-01", status: "draft" }));

      const { GET } = await import("@/app/api/admin/calendar/route");
      const res = await GET(makeGet("/api/admin/calendar"));
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.items.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by from/to query params", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      await POST(makePost("/api/admin/calendar/create", { title: "May Post", type: "social_post", platform: "x", date: "2026-05-10", status: "draft" }));
      await POST(makePost("/api/admin/calendar/create", { title: "June Post", type: "social_post", platform: "x", date: "2026-06-10", status: "draft" }));

      const { GET } = await import("@/app/api/admin/calendar/route");
      const res = await GET(makeGet("/api/admin/calendar?from=2026-05-01&to=2026-05-31"));
      const data = await res.json();
      expect(data.items.every((i: { date: string }) => i.date >= "2026-05-01" && i.date <= "2026-05-31")).toBe(true);
    });

    it("returns 401 when not authenticated", async () => {
      requireAdminMock.mockReturnValueOnce({
        ok: false,
        response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
      });
      const { GET } = await import("@/app/api/admin/calendar/route");
      const res = await GET(makeGet("/api/admin/calendar"));
      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/admin/calendar/create ─────────────────────────────────────────

  describe("POST /api/admin/calendar/create", () => {
    it("creates item and returns 201", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      const res = await POST(makePost("/api/admin/calendar/create", {
        title: "New Post",
        type: "social_post",
        platform: "tiktok",
        date: "2026-05-15",
        status: "draft",
      }));
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.item.id).toMatch(/^cal_/);
      expect(data.item.title).toBe("New Post");
    });

    it("returns 400 when required fields missing", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      const res = await POST(makePost("/api/admin/calendar/create", { title: "Missing fields" }));
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /api/admin/calendar/[id] ──────────────────────────────────────────

  describe("PATCH /api/admin/calendar/[id]", () => {
    it("updates and returns item", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      const createRes = await POST(makePost("/api/admin/calendar/create", {
        title: "Editable",
        type: "social_post",
        platform: "meta",
        date: "2026-05-01",
        status: "draft",
      }));
      const { item } = await createRes.json();

      const { PATCH } = await import("@/app/api/admin/calendar/[id]/route");
      const res = await PATCH(
        makePatch(`/api/admin/calendar/${item.id}`, { status: "published" }),
        { params: Promise.resolve({ id: item.id }) },
      );
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.item.status).toBe("published");
    });

    it("returns 404 for unknown id", async () => {
      const { PATCH } = await import("@/app/api/admin/calendar/[id]/route");
      const res = await PATCH(
        makePatch("/api/admin/calendar/cal_ghost", { status: "cancelled" }),
        { params: Promise.resolve({ id: "cal_ghost" }) },
      );
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /api/admin/calendar/[id] ─────────────────────────────────────────

  describe("DELETE /api/admin/calendar/[id]", () => {
    it("deletes item and returns 200", async () => {
      const { POST } = await import("@/app/api/admin/calendar/create/route");
      const createRes = await POST(makePost("/api/admin/calendar/create", {
        title: "To Delete",
        type: "social_post",
        platform: "x",
        date: "2026-05-01",
        status: "draft",
      }));
      const { item } = await createRes.json();

      const { DELETE } = await import("@/app/api/admin/calendar/[id]/route");
      const res = await DELETE(
        makeDelete(`/api/admin/calendar/${item.id}`),
        { params: Promise.resolve({ id: item.id }) },
      );
      expect(res.status).toBe(200);
    });

    it("returns 404 for unknown id", async () => {
      const { DELETE } = await import("@/app/api/admin/calendar/[id]/route");
      const res = await DELETE(
        makeDelete("/api/admin/calendar/cal_ghost"),
        { params: Promise.resolve({ id: "cal_ghost" }) },
      );
      expect(res.status).toBe(404);
    });
  });
});
