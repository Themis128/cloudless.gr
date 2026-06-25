import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { listAllWorkspacesMock, listWorkspaceViewsMock, createPageMock } = vi.hoisted(() => ({
  listAllWorkspacesMock: vi.fn(),
  listWorkspaceViewsMock: vi.fn(),
  createPageMock: vi.fn(),
}));

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    jwtVerify: async (jwt: string) => {
      const parts = jwt.split(".");
      if (parts.length !== 3) throw new Error("Invalid JWT structure");
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.exp && Date.now() >= payload.exp * 1000) throw new Error("JWT expired");
      return { payload, protectedHeader: { alg: "RS256" } };
    },
  };
});

vi.mock("@/lib/appflowy", async (orig) => {
  const mod = await orig<typeof import("@/lib/appflowy")>();
  return {
    ...mod,
    listAllWorkspaces: (...a: unknown[]) => listAllWorkspacesMock(...a),
    listWorkspaceViews: (...a: unknown[]) => listWorkspaceViewsMock(...a),
    createPage: (...a: unknown[]) => createPageMock(...a),
  };
});

function makeAdminToken(): string {
  const payload = {
    sub: "admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    aud: "test-client-id",
    iss: "https://auth.cloudless.gr/realms/cloudless",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-sig`;
}

function adminReq(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${makeAdminToken()}`,
      ...(init?.headers as Record<string, string>),
    },
  });
}

function unauthReq(url: string): NextRequest {
  return new NextRequest(url);
}

const BASE = "http://localhost/api/admin/notion/tasks";

const VIEWS = [
  { view_id: "t1", name: "Fix bug", layout: "Document", created_at: "", last_edited_time: "" },
  { view_id: "t2", name: "Write docs", layout: "Document", created_at: "", last_edited_time: "" },
];

describe("GET /api/admin/notion/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    listAllWorkspacesMock.mockResolvedValue([{ workspace_id: "ws1" }]);
    listWorkspaceViewsMock.mockResolvedValue(VIEWS);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    const { AppFlowyNotConfiguredError } = await import("@/lib/appflowy");
    listAllWorkspacesMock.mockRejectedValue(new AppFlowyNotConfiguredError());
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);
  });

  it("returns task list", async () => {
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(2);
    expect(data.count).toBe(2);
  });

  it("returns summary when ?summary=true", async () => {
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(`${BASE}?summary=true`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary).toBeDefined();
    expect(typeof data.summary["To Do"]).toBe("number");
  });

  it("passes status/project/assignee filters to listTasks", async () => {
    listWorkspaceViewsMock.mockResolvedValue([
      { view_id: "t1", name: "[Done] Task A", layout: "Document", created_at: "", last_edited_time: "" },
      { view_id: "t2", name: "[To Do] Task B", layout: "Document", created_at: "", last_edited_time: "" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(`${BASE}?status=Done`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks[0].status).toBe("Done");
  });
});

describe("POST /api/admin/notion/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    listAllWorkspacesMock.mockResolvedValue([{ workspace_id: "ws1" }]);
    listWorkspaceViewsMock.mockResolvedValue(VIEWS);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { POST } = await import("@/app/api/admin/notion/tasks/route");
    const res = await POST(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 400 when task is missing", async () => {
    const { POST } = await import("@/app/api/admin/notion/tasks/route");
    const res = await POST(
      adminReq(BASE, {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when task exceeds 500 characters", async () => {
    const { POST } = await import("@/app/api/admin/notion/tasks/route");
    const res = await POST(
      adminReq(BASE, {
        method: "POST",
        body: JSON.stringify({ task: "x".repeat(501) }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates a task and returns 201 with id", async () => {
    createPageMock.mockResolvedValue({ view_id: "new-task-id", name: "Build feature X" });
    const { POST } = await import("@/app/api/admin/notion/tasks/route");
    const res = await POST(
      adminReq(BASE, {
        method: "POST",
        body: JSON.stringify({ task: "Build feature X" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("new-task-id");
  });

  it("returns 500 when createTask returns falsy", async () => {
    createPageMock.mockRejectedValue(new Error("AppFlowy unavailable"));
    const { POST } = await import("@/app/api/admin/notion/tasks/route");
    const res = await POST(
      adminReq(BASE, {
        method: "POST",
        body: JSON.stringify({ task: "Build feature X" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/admin/notion/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    const res = await PATCH(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 400 when pageId or status is missing", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status value", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "InvalidStatus" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("acknowledges status update for AppFlowy-backed tasks", async () => {
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "Done" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("accepts all valid status values", async () => {
    const validStatuses = ["Backlog", "To Do", "In Progress", "In Review", "Done", "Blocked"];
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    for (const status of validStatuses) {
      const res = await PATCH(
        adminReq(BASE, {
          method: "PATCH",
          body: JSON.stringify({ pageId: "p1", status }),
          headers: { "Content-Type": "application/json" },
        })
      );
      expect(res.status).toBe(200);
    }
  });
});
