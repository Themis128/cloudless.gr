import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetIntegrationCache } from "@/lib/integrations";

vi.mock("@/lib/api-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-auth")>();
  const { NextResponse } = await import("next/server");
  const adminUser = {
    sub: "test-admin-sub",
    email: "admin@cloudless.gr",
    groups: ["admin"],
    email_verified: true,
  };
  const plainUser = {
    sub: "test-user-sub",
    email: "user@cloudless.gr",
    groups: [] as string[],
    email_verified: true,
  };

  function userFromRequest(request: { headers: { get: (k: string) => string | null } }) {
    const h = request.headers.get("authorization") ?? "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (token === "test-admin-session") return adminUser;
    if (token === "test-user-session") return plainUser;
    // Allow email-bearing opaque tokens used by user-route tests: "user-session:<email>"
    if (token.startsWith("user-session:")) {
      const email = token.slice("user-session:".length) || "user@cloudless.gr";
      return { ...plainUser, email, sub: `user-${email}` };
    }
    if (token.startsWith("admin-session:")) {
      const email = token.slice("admin-session:".length) || "admin@cloudless.gr";
      return { ...adminUser, email, sub: `admin-${email}` };
    }
    return null;
  }

  return {
    ...actual,
    requireAuth: async (request: Parameters<typeof actual.requireAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireAuth(request);
    },
    requireAdmin: async (request: Parameters<typeof actual.requireAdmin>[0]) => {
      const user = userFromRequest(request);
      if (!user) return actual.requireAdmin(request);
      if (!user.groups.includes("admin")) {
        return {
          ok: false as const,
          response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
        };
      }
      return { ok: true as const, user };
    },
    requireVerifiedAuth: async (request: Parameters<typeof actual.requireVerifiedAuth>[0]) => {
      const user = userFromRequest(request);
      if (user) return { ok: true as const, user };
      return actual.requireVerifiedAuth(request);
    },
  };
});
const { listTasksMock, createTaskMock, updateTaskStatusMock, getTaskSummaryMock } = vi.hoisted(
  () => ({
    listTasksMock: vi.fn(),
    createTaskMock: vi.fn(),
    updateTaskStatusMock: vi.fn(),
    getTaskSummaryMock: vi.fn(),
  })
);

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

vi.mock("@/lib/notion-projects", () => ({
  listTasks: listTasksMock,
  createTask: createTaskMock,
  updateTaskStatus: updateTaskStatusMock,
  getTaskSummary: getTaskSummaryMock,
}));

function makeAdminToken(): string {
  return "test-admin-session";
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

describe("GET /api/admin/notion/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_TASKS_DB_ID = "tasks-db-id";
  });

  it("returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(unauthReq(BASE));
    expect(res.status).toBe(401);
  });

  it("returns 503 when not configured", async () => {
    vi.stubEnv("NOTION_TASKS_DB_ID", "");
    resetIntegrationCache();
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/not configured/i);
  });

  it("returns task list", async () => {
    listTasksMock.mockResolvedValueOnce([
      { id: "t1", title: "Fix bug" },
      { id: "t2", title: "Write docs" },
    ]);
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(BASE));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(2);
    expect(data.count).toBe(2);
  });

  it("returns summary when ?summary=true", async () => {
    getTaskSummaryMock.mockResolvedValueOnce({ "To Do": 3, Done: 5 });
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    const res = await GET(adminReq(`${BASE}?summary=true`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.summary["Done"]).toBe(5);
    expect(listTasksMock).not.toHaveBeenCalled();
  });

  it("passes status/project/assignee filters to listTasks", async () => {
    listTasksMock.mockResolvedValueOnce([]);
    const { GET } = await import("@/app/api/admin/notion/tasks/route");
    await GET(adminReq(`${BASE}?status=Done&project=proj1&assignee=alice`));
    expect(listTasksMock).toHaveBeenCalledWith({
      status: "Done",
      project: "proj1",
      assignee: "alice",
    });
  });
});

describe("POST /api/admin/notion/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_TASKS_DB_ID = "tasks-db-id";
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
    createTaskMock.mockResolvedValueOnce("new-task-id");
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
    createTaskMock.mockResolvedValueOnce(null);
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
    resetIntegrationCache();
    process.env.NOTION_API_KEY = "secret_test";
    process.env.NOTION_TASKS_DB_ID = "tasks-db-id";
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

  it("updates task status successfully", async () => {
    updateTaskStatusMock.mockResolvedValueOnce(true);
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

  it("returns 500 when updateTaskStatus fails", async () => {
    updateTaskStatusMock.mockResolvedValueOnce(false);
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    const res = await PATCH(
      adminReq(BASE, {
        method: "PATCH",
        body: JSON.stringify({ pageId: "p1", status: "Done" }),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(res.status).toBe(500);
  });

  it("accepts all valid status values", async () => {
    const validStatuses = ["Backlog", "To Do", "In Progress", "In Review", "Done", "Blocked"];
    const { PATCH } = await import("@/app/api/admin/notion/tasks/route");
    for (const status of validStatuses) {
      updateTaskStatusMock.mockResolvedValueOnce(true);
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
