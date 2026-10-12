// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireAdminMock = vi.fn();
const listTimeEntriesMock = vi.fn();
const createTimeEntryMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({ requireAdmin: (...a: unknown[]) => requireAdminMock(...a) }));
vi.mock("@/lib/agency-projects-d1", () => ({
  listTimeEntries: (...a: unknown[]) => listTimeEntriesMock(...a),
  createTimeEntry: (...a: unknown[]) => createTimeEntryMock(...a),
}));

import { GET, POST } from "@/app/api/admin/delivery/projects/[id]/time/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (q = "") =>
  new NextRequest(`http://localhost/api/admin/delivery/projects/ap_x/time${q}`);
const post = (body: unknown) =>
  new NextRequest("http://localhost/api/admin/delivery/projects/ap_x/time", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("delivery time api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminMock.mockResolvedValue({ ok: true, user: { sub: "admin1" } });
  });

  it("GET — invalid id → 400, unbound → 503, list → entries", async () => {
    expect((await GET(get(), ctx("bad id!"))).status).toBe(400);

    listTimeEntriesMock.mockResolvedValueOnce({ bound: false, entries: [] });
    expect((await GET(get(), ctx("ap_x"))).status).toBe(503);

    listTimeEntriesMock.mockResolvedValueOnce({
      bound: true,
      entries: [{ id: "te1", minutes: 30 }],
    });
    const res = await GET(get("?limit=5"), ctx("ap_x"));
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(listTimeEntriesMock).toHaveBeenCalledWith("ap_x", 5);

    listTimeEntriesMock.mockRejectedValueOnce(new Error("d1 down"));
    expect((await GET(get(), ctx("ap_x"))).status).toBe(500);
  });

  it("POST — invalid id/JSON/validation → 400s", async () => {
    expect((await POST(post({}), ctx("bad id!"))).status).toBe(400);
    expect((await POST(post("{oops"), ctx("ap_x"))).status).toBe(400);
    expect((await POST(post({ workDate: "nope", minutes: 30 }), ctx("ap_x"))).status).toBe(400);
    expect((await POST(post({ workDate: "2026-01-01" }), ctx("ap_x"))).status).toBe(400);
    expect((await POST(post({ workDate: "2026-01-01", minutes: 0 }), ctx("ap_x"))).status).toBe(400);
  });

  it("POST — hours→minutes, description trim, 503 unbound, 201 created", async () => {
    createTimeEntryMock.mockResolvedValueOnce({ id: "te1" });
    const res = await POST(
      post({ workDate: "2026-01-02", hours: 1.5, description: "  work  ", billable: false }),
      ctx("ap_x")
    );
    expect(res.status).toBe(201);
    expect(createTimeEntryMock).toHaveBeenCalledWith({
      projectId: "ap_x",
      workDate: "2026-01-02",
      minutes: 90,
      description: "work",
      billable: false,
      userId: "admin1",
    });

    createTimeEntryMock.mockResolvedValueOnce(null);
    expect((await POST(post({ workDate: "2026-01-02", minutes: 15 }), ctx("ap_x"))).status).toBe(503);

    createTimeEntryMock.mockRejectedValueOnce(new Error("d1 down"));
    expect((await POST(post({ workDate: "2026-01-02", minutes: 15 }), ctx("ap_x"))).status).toBe(500);
  });
});
