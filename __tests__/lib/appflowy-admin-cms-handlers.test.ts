/**
 * Tests for src/lib/appflowy-admin-cms-handlers.ts
 *
 * createAppFlowyAdminHandlers() returns { GET, POST, PATCH, DELETE } handlers.
 * Covers auth gating, AppFlowy configuration check, and all branch paths.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------
const { mockRequireAdmin, mockIsConfigured, mockWriteNotImplemented } = vi.hoisted(() => ({
  mockRequireAdmin: vi.fn(),
  mockIsConfigured: vi.fn(),
  mockWriteNotImplemented: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({ requireAdmin: mockRequireAdmin }));
vi.mock("@/lib/appflowy", () => ({ isAppFlowyConfigured: mockIsConfigured }));
vi.mock("@/lib/appflowy-admin-stub", () => ({
  appflowyWriteNotImplemented: mockWriteNotImplemented,
}));

import { createAppFlowyAdminHandlers } from "@/lib/appflowy-admin-cms-handlers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeAdminOk() {
  return { ok: true as const, user: { username: "admin", groups: ["admin"] } };
}
function makeAuthFail() {
  const resp = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  return { ok: false as const, response: resp };
}
function makeReq(method: string, body?: unknown, search = "") {
  const url = `http://localhost/api/admin/test${search}`;
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(url, init);
}

// ---------------------------------------------------------------------------
// Build handlers under test
// ---------------------------------------------------------------------------
const mockList = vi.fn();
const OPTS = {
  surface: "Widgets",
  listKey: "widgets",
  list: mockList,
  createRequired: {
    field: "name",
    message: "name is required",
    read: (b: Record<string, unknown>) => b.name,
  },
};

let handlers: ReturnType<typeof createAppFlowyAdminHandlers>;

beforeEach(() => {
  mockRequireAdmin.mockReset();
  mockIsConfigured.mockReset();
  mockWriteNotImplemented.mockReset();
  mockList.mockReset();
  handlers = createAppFlowyAdminHandlers(OPTS);

  mockWriteNotImplemented.mockReturnValue(
    new Response(JSON.stringify({ error: "not implemented" }), { status: 501 })
  );
});

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------
describe("GET handler", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(makeAuthFail());
    const res = await handlers.GET(makeReq("GET"));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AppFlowy not configured", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(false);
    const res = await handlers.GET(makeReq("GET"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toContain("not configured");
  });

  it("returns 500 when list() throws", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    mockList.mockRejectedValue(new Error("DB error"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handlers.GET(makeReq("GET"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("list");
  });

  it("returns 200 with items on success", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    mockList.mockResolvedValue([{ id: "w1", name: "Widget A" }]);
    const res = await handlers.GET(makeReq("GET"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.widgets).toHaveLength(1);
    expect(body.count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------
describe("POST handler", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(makeAuthFail());
    const res = await handlers.POST(makeReq("POST", { name: "W1" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 when AppFlowy not configured", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(false);
    const res = await handlers.POST(makeReq("POST", { name: "W1" }));
    expect(res.status).toBe(503);
  });

  it("returns 400 on invalid JSON body", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    const req = new NextRequest("http://localhost/api/admin/test", {
      method: "POST",
      body: "not-json{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await handlers.POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 when required field is missing", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    const res = await handlers.POST(makeReq("POST", { other: "x" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("name is required");
  });

  it("returns 400 when required field is empty string", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    const res = await handlers.POST(makeReq("POST", { name: "   " }));
    expect(res.status).toBe(400);
  });

  it("delegates to appflowyWriteNotImplemented on valid request", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    mockIsConfigured.mockResolvedValue(true);
    const res = await handlers.POST(makeReq("POST", { name: "Widget A" }));
    expect(mockWriteNotImplemented).toHaveBeenCalledWith("Widgets");
    expect(res.status).toBe(501);
  });
});

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------
describe("PATCH handler", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(makeAuthFail());
    const res = await handlers.PATCH(makeReq("PATCH", { pageId: "p1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid JSON", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    const req = new NextRequest("http://localhost/api/admin/test", {
      method: "PATCH",
      body: "bad{",
      headers: { "Content-Type": "application/json" },
    });
    const res = await handlers.PATCH(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 400 when pageId is missing", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    const res = await handlers.PATCH(makeReq("PATCH", { title: "Updated" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("pageId");
  });

  it("delegates to appflowyWriteNotImplemented when pageId is present", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    const res = await handlers.PATCH(makeReq("PATCH", { pageId: "p-1", title: "New" }));
    expect(mockWriteNotImplemented).toHaveBeenCalledWith("Widgets");
    expect(res.status).toBe(501);
  });
});

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------
describe("DELETE handler", () => {
  it("returns 401 when not admin", async () => {
    mockRequireAdmin.mockResolvedValue(makeAuthFail());
    const res = await handlers.DELETE(makeReq("DELETE", undefined, "?pageId=p1"));
    expect(res.status).toBe(401);
  });

  it("returns 400 when pageId query param is missing", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    const res = await handlers.DELETE(makeReq("DELETE"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("pageId");
  });

  it("delegates to appflowyWriteNotImplemented when pageId is present", async () => {
    mockRequireAdmin.mockResolvedValue(makeAdminOk());
    const res = await handlers.DELETE(makeReq("DELETE", undefined, "?pageId=p-1"));
    expect(mockWriteNotImplemented).toHaveBeenCalledWith("Widgets");
    expect(res.status).toBe(501);
  });
});
