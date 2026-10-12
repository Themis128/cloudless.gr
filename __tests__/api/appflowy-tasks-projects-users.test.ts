/**
 * Tests for /api/admin/appflowy/tasks, /api/admin/appflowy/projects and
 * /api/admin/users/[id].
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

const projects = vi.hoisted(() => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  updateProjectStatus: vi.fn(),
  updateProjectProgress: vi.fn(),
}));
vi.mock("@/lib/appflowy-projects", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/appflowy-projects")>();
  return { ...actual, ...projects };
});

const appflowy = vi.hoisted(() => ({ isAppFlowyConfigured: vi.fn() }));
vi.mock("@/lib/appflowy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/appflowy")>();
  return {
    ...actual,
    isAppFlowyConfigured: appflowy.isAppFlowyConfigured,
  };
});

const authD1 = vi.hoisted(() => ({
  getAuthDbFromEnv: vi.fn(),
  getUserById: vi.fn(),
  isAdmin: vi.fn(),
  patchUserProfile: vi.fn(),
}));
vi.mock("@/lib/auth-d1", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth-d1")>();
  return {
    ...actual,
    getAuthDbFromEnv: authD1.getAuthDbFromEnv,
    getUserById: authD1.getUserById,
    isAdmin: authD1.isAdmin,
    patchUserProfile: authD1.patchUserProfile,
  };
});

import {
  GET as tasksGet,
  POST as tasksPost,
  PATCH as tasksPatch,
} from "@/app/api/admin/appflowy/tasks/route";
import {
  GET as projectsGet,
  POST as projectsPost,
  PATCH as projectsPatch,
} from "@/app/api/admin/appflowy/projects/route";
import {
  GET as userGet,
  PUT as userPut,
} from "@/app/api/admin/users/[id]/route";

const TASKS = "http://localhost/api/admin/appflowy/tasks";
const PROJECTS = "http://localhost/api/admin/appflowy/projects";
const USER = "http://localhost/api/admin/users/u1";

const post = (url: string, body: unknown, method = "POST") =>
  new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("/api/admin/appflowy/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    projects.listTasks.mockResolvedValue([{ id: "t1" }]);
    projects.createTask.mockResolvedValue("new-id");
    projects.updateTaskStatus.mockResolvedValue(true);
  });

  it("401s non-admin; 503s unconfigured", async () => {
    apiAuth.ok = false;
    expect((await tasksGet(new NextRequest(TASKS))).status).toBe(401);
    apiAuth.ok = true;
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect((await tasksGet(new NextRequest(TASKS))).status).toBe(503);
    expect((await tasksPost(post(TASKS, {}))).status).toBe(503);
    expect((await tasksPatch(post(TASKS, {}, "PATCH"))).status).toBe(503);
  });

  it("GET filters by valid status only + forwards filters", async () => {
    const j = await (
      await tasksGet(new NextRequest(`${TASKS}?status=Bogus&project=p&assignee=a`))
    ).json();
    expect(j.count).toBe(1);
    expect(projects.listTasks).toHaveBeenCalledWith({
      status: undefined,
      project: "p",
      assignee: "a",
    });

    await tasksGet(new NextRequest(`${TASKS}?status=In%20Progress`));
    expect(projects.listTasks).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "In Progress" })
    );
  });

  it("POST validates task, creates, 501s on unsupported write", async () => {
    for (const body of [
      {},
      { task: 5 },
      { task: "   " },
      { task: "x".repeat(201) },
    ]) {
      expect((await tasksPost(post(TASKS, body))).status).toBe(400);
    }

    const res = await tasksPost(post(TASKS, { task: "  do it  ", status: "To Do" }));
    expect(res.status).toBe(201);
    expect(projects.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ task: "do it" })
    );

    projects.createTask.mockResolvedValue(null);
    expect((await tasksPost(post(TASKS, { task: "x" }))).status).toBe(501);
  });

  it("PATCH validates pageId + status, updates", async () => {
    expect((await tasksPatch(post(TASKS, {}, "PATCH"))).status).toBe(400);
    expect(
      (await tasksPatch(post(TASKS, { pageId: "p1", status: "nope" }, "PATCH")))
        .status
    ).toBe(400);

    const j = await (
      await tasksPatch(post(TASKS, { pageId: "p1", status: "Done" }, "PATCH"))
    ).json();
    expect(j.ok).toBe(true);

    projects.updateTaskStatus.mockResolvedValue(false);
    expect(
      (
        await tasksPatch(
          post(TASKS, { pageId: "p1", status: "Done" }, "PATCH")
        )
      ).status
    ).toBe(501);
  });
});

describe("/api/admin/appflowy/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    appflowy.isAppFlowyConfigured.mockResolvedValue(true);
    projects.listProjects.mockResolvedValue([{ id: "p1" }]);
    projects.createProject.mockResolvedValue("proj-id");
    projects.updateProjectStatus.mockResolvedValue(true);
    projects.updateProjectProgress.mockResolvedValue(true);
  });

  it("401s non-admin; 503s unconfigured", async () => {
    apiAuth.ok = false;
    expect((await projectsGet(new NextRequest(PROJECTS))).status).toBe(401);
    apiAuth.ok = true;
    appflowy.isAppFlowyConfigured.mockResolvedValue(false);
    expect((await projectsGet(new NextRequest(PROJECTS))).status).toBe(503);
    expect((await projectsPost(post(PROJECTS, {}))).status).toBe(503);
  });

  it("GET lists with optional status filter", async () => {
    const j = await (await projectsGet(new NextRequest(PROJECTS))).json();
    expect(j.count).toBe(1);
    expect(projects.listProjects).toHaveBeenCalledWith(undefined);

    await projectsGet(new NextRequest(`${PROJECTS}?status=Planning`));
    expect(projects.listProjects).toHaveBeenLastCalledWith("Planning");
  });

  it("POST validates name, creates, 501s on unsupported write", async () => {
    for (const body of [
      {},
      { name: 5 },
      { name: "  " },
      { name: "x".repeat(201) },
    ]) {
      expect((await projectsPost(post(PROJECTS, body))).status).toBe(400);
    }
    expect(
      (await projectsPost(post(PROJECTS, { name: "P" }))).status
    ).toBe(201);

    projects.createProject.mockResolvedValue(null);
    expect((await projectsPost(post(PROJECTS, { name: "P" }))).status).toBe(
      501
    );
  });

  it("PATCH: pageId required, status/progress validation", async () => {
    expect((await projectsPatch(post(PROJECTS, {}, "PATCH"))).status).toBe(400);
    expect(
      (
        await projectsPatch(
          post(PROJECTS, { pageId: "p", status: "nope" }, "PATCH")
        )
      ).status
    ).toBe(400);

    // status + progress in range → both updates
    const res = await projectsPatch(
      post(PROJECTS, { pageId: "p", status: "Completed", progress: 100 }, "PATCH")
    );
    expect(res.status).toBe(200);
    expect(projects.updateProjectStatus).toHaveBeenCalledWith("p", "Completed");
    expect(projects.updateProjectProgress).toHaveBeenCalledWith("p", 100);

    // out-of-range progress ignored
    projects.updateProjectProgress.mockClear();
    await projectsPatch(
      post(PROJECTS, { pageId: "p", progress: 150 }, "PATCH")
    );
    expect(projects.updateProjectProgress).not.toHaveBeenCalled();

    // 501 on failed write
    projects.updateProjectStatus.mockResolvedValue(false);
    expect(
      (
        await projectsPatch(
          post(PROJECTS, { pageId: "p", status: "On Hold" }, "PATCH")
        )
      ).status
    ).toBe(501);

    projects.updateProjectStatus.mockResolvedValue(true);
    projects.updateProjectProgress.mockResolvedValue(false);
    expect(
      (
        await projectsPatch(
          post(PROJECTS, { pageId: "p", progress: 50 }, "PATCH")
        )
      ).status
    ).toBe(501);
  });
});

describe("/api/admin/users/[id]", () => {
  const params = { params: Promise.resolve({ id: "alice" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    apiAuth.ok = true;
    authD1.getAuthDbFromEnv.mockReturnValue({ fake: true });
    authD1.getUserById.mockResolvedValue(null);
    authD1.isAdmin.mockResolvedValue(false);
    authD1.patchUserProfile.mockResolvedValue(true);
  });

  it("401s non-admin; 503s without db", async () => {
    apiAuth.ok = false;
    expect((await userGet(new NextRequest(USER), params)).status).toBe(401);
    apiAuth.ok = true;
    authD1.getAuthDbFromEnv.mockReturnValue(null);
    expect((await userGet(new NextRequest(USER), params)).status).toBe(503);
    expect(
      (await userPut(post(USER, { name: "x" }, "PUT"), params)).status
    ).toBe(503);
  });

  it("GET 404s unknown user; maps prefs to status/verified", async () => {
    expect((await userGet(new NextRequest(USER), params)).status).toBe(404);

    authD1.getUserById.mockResolvedValue({
      email: "a@b",
      name: null,
      preferences_json: '{"disabled":"true","email_verified":"false"}',
      created_at: 1700000000,
    });
    authD1.isAdmin.mockResolvedValue(true);
    const j = await (await userGet(new NextRequest(USER), params)).json();
    expect(j.user).toMatchObject({
      username: "alice",
      status: "disabled",
      userStatus: "DISABLED",
      emailVerified: false,
      role: "admin",
      name: "",
    });
    expect(j.user.created).toBe("2023-11-14T22:13:20.000Z");
    expect(j.provider).toBe("d1");
  });

  it("GET defaults verified=true and tolerates bad prefs JSON", async () => {
    authD1.getUserById.mockResolvedValue({
      email: "a@b",
      preferences_json: "{invalid",
    });
    const j = await (await userGet(new NextRequest(USER), params)).json();
    expect(j.user.emailVerified).toBe(true);
    expect(j.user.status).toBe("active");

    authD1.getUserById.mockResolvedValue({ email: "a@b" });
    const j2 = await (await userGet(new NextRequest(USER), params)).json();
    expect(j2.user.created).toBeUndefined();
  });

  it("GET 500s on db errors", async () => {
    authD1.getUserById.mockRejectedValue(new Error("db down"));
    expect((await userGet(new NextRequest(USER), params)).status).toBe(500);
  });

  it("PUT requires an attribute; patches or 404s", async () => {
    expect(
      (await userPut(post(USER, {}, "PUT"), params)).status
    ).toBe(400);

    const j = await (
      await userPut(post(USER, { name: "N", company: "C" }, "PUT"), params)
    ).json();
    expect(j).toEqual({ success: true, provider: "d1" });
    expect(authD1.patchUserProfile).toHaveBeenCalledWith(
      expect.anything(),
      "alice",
      { name: "N", company: "C", phone: undefined }
    );

    authD1.patchUserProfile.mockResolvedValue(false);
    expect(
      (await userPut(post(USER, { name: "N" }, "PUT"), params)).status
    ).toBe(404);

    authD1.patchUserProfile.mockRejectedValue(new Error("db down"));
    expect(
      (await userPut(post(USER, { name: "N" }, "PUT"), params)).status
    ).toBe(500);
  });
});
