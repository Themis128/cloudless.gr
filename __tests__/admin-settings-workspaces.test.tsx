/**
 * admin/settings (cache clear + D1 app_config CRUD) and admin/workspaces
 * (create/edit/delete + Postiz-group dropdown vs free-text fallback).
 *
 * @vitest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const okJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

let routes: Record<string, unknown> = {};
const fetchWithAuthMock = vi.fn(async (url: string, init?: RequestInit) => {
  const match = Object.keys(routes).find((k) => String(url).startsWith(k));
  const out = match ? routes[match] : undefined;
  if (typeof out === "function") return out(String(url), init);
  if (out instanceof Response) return out.clone();
  if (out === undefined) return okJson({});
  return okJson(out);
});

vi.mock("@/lib/fetch-with-auth", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...(args as [string, RequestInit?])),
}));

const setCtxWorkspaces = vi.fn();
vi.mock("@/context/WorkspaceContext", () => ({
  useWorkspace: () => ({
    current: { id: "w1", name: "Main", slug: "main" },
    setWorkspaces: setCtxWorkspaces,
  }),
}));

import AdminSettingsPage from "@/app/[locale]/admin/settings/page";
import WorkspacesPage from "@/app/[locale]/admin/workspaces/page";

const click = async (el: Element) => {
  await act(async () => fireEvent.click(el));
};
const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};
const renderPage = async (el: React.JSX.Element) => {
  let c: HTMLElement | undefined;
  await act(async () => {
    c = render(el).container;
  });
  return c!;
};

beforeEach(() => {
  routes = {};
  fetchWithAuthMock.mockClear();
  setCtxWorkspaces.mockClear();
  vi.stubGlobal("confirm", vi.fn(() => true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("admin/settings", () => {
  it("loads config rows, saves a key, clears caches", async () => {
    routes["/api/admin/config"] = okJson({
      configs: [{ key: "SITE_NOTE", description: "note", updated_at: 1 }],
    });
    routes["/api/admin/cache"] = okJson({
      clearedPrefix: "all",
      clearedAt: "2026-01-01T12:00:00Z",
    });
    const c = await renderPage(<AdminSettingsPage />);
    expect(c.textContent).toContain("SITE_NOTE");

    // save a config key — key input uppercases on change
    const [keyInput, valueInput] = Array.from(c.querySelectorAll("input"));
    fireEvent.change(keyInput, { target: { value: "new_key" } });
    expect((keyInput as HTMLInputElement).value).toBe("NEW_KEY");
    fireEvent.change(valueInput, { target: { value: "v1" } });
    await click(screen.getByText("Save"));
    const put = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PUT");
    expect(JSON.parse(String(put![1].body))).toEqual({ key: "NEW_KEY", value: "v1" });
    expect(c.textContent).toContain("Saved NEW_KEY");

    // prefix cache clear
    await click(screen.getByText("Clear blog"));
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    expect(JSON.parse(String(post![1].body)).prefix).toBe("blog");
    expect(c.textContent).toContain("Cache cleared");

    // key-button click fills the edit key
    await click(screen.getByText("SITE_NOTE"));
    expect((keyInput as HTMLInputElement).value).toBe("SITE_NOTE");
  });

  it("503 → AUTH_DB message; force-flush confirm; save error", async () => {
    routes["/api/admin/config"] = okJson({ error: "AUTH_DB not bound" }, 503);
    routes["/api/admin/cache"] = okJson({ error: "boom" }, 500);
    const c = await renderPage(<AdminSettingsPage />);
    expect(c.textContent).toContain("AUTH_DB not bound");

    await click(screen.getByText("Force-flush All Caches"));
    await flush();
    expect(c.textContent).toContain("boom");
    const posts = fetchWithAuthMock.mock.calls.filter(([, i]) => i?.method === "POST");
    expect(posts.length).toBe(1);

    // save error path
    routes["/api/admin/config"] = okJson({ error: "bad key" }, 400);
    const [keyInput, valueInput] = Array.from(c.querySelectorAll("input"));
    fireEvent.change(keyInput, { target: { value: "K" } });
    fireEvent.change(valueInput, { target: { value: "v" } });
    await click(screen.getByText("Save"));
    await flush();
    expect(c.textContent).toContain("bad key");
  });
});

describe("admin/workspaces", () => {
  const ROUTE = "/api/admin/workspaces";
  const ws = {
    id: "w1",
    name: "Main",
    slug: "main",
    description: "prod",
    adminEmails: ["a@x.gr"],
    createdAt: "2026-01-01T00:00:00Z",
    postizGroupId: "g1",
    notionTag: "acme",
  };

  it("list + create + edit + delete, Postiz dropdown path", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init ? okJson({}) : okJson({ workspaces: [ws] });
    routes["/api/admin/postiz/groups"] = okJson({
      groups: [{ id: "g1", name: "Acme Group" }],
    });
    const c = await renderPage(<WorkspacesPage />);
    expect(c.textContent).toContain("Main");
    expect(c.textContent).toContain("Acme Group"); // friendly name via groups lookup
    expect(setCtxWorkspaces).toHaveBeenCalled();

    // create — validation first
    const form = c.querySelector("form")!;
    fireEvent.submit(form);
    await flush();
    expect(c.textContent).toContain("Name is required");

    fireEvent.change(c.querySelector("#ws-name")!, { target: { value: "New WS" } });
    fireEvent.change(c.querySelector("#ws-admin-emails")!, {
      target: { value: "b@x.gr, c@x.gr" },
    });
    // Postiz select rendered (groups loaded)
    const sel = c.querySelector("#ws-postiz") as HTMLSelectElement;
    expect(sel.tagName).toBe("SELECT");
    fireEvent.change(sel, { target: { value: "g1" } });
    fireEvent.submit(form);
    await flush();
    const post = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "POST");
    const body = JSON.parse(String(post![1].body));
    expect(body).toMatchObject({
      name: "New WS",
      adminEmails: ["b@x.gr", "c@x.gr"],
      postizGroupId: "g1",
    });

    // edit → PATCH id ("Edit"/"Delete" also appear as <em> in the help details)
    await click(screen.getAllByText("Edit").find((e) => e.tagName === "BUTTON")!);
    const editInputs = Array.from(c.querySelectorAll("input")).filter(
      (i) => (i as HTMLInputElement).value === "Main"
    );
    fireEvent.change(editInputs[0], { target: { value: "Renamed" } });
    await click(screen.getByText("Save"));
    const patch = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    expect(JSON.parse(String(patch![1].body))).toMatchObject({ id: "w1", name: "Renamed" });

    // delete with confirm
    await click(screen.getAllByText("Delete").find((e) => e.tagName === "BUTTON")!);
    const del = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "DELETE");
    expect(JSON.parse(String(del![1].body)).id).toBe("w1");
  });

  it("free-text Postiz fallback + load error + empty", async () => {
    routes[ROUTE] = okJson({ workspaces: [] });
    routes["/api/admin/postiz/groups"] = okJson({}, 503);
    const c = await renderPage(<WorkspacesPage />);
    await flush();
    expect(c.textContent).toContain("No workspaces yet");
    const field = c.querySelector("#ws-postiz")!;
    expect(field.tagName).toBe("INPUT");

    routes[ROUTE] = okJson({}, 500);
    cleanup();
    const c2 = await renderPage(<WorkspacesPage />);
    expect(c2.textContent).toContain("HTTP 500");
  });

  it("surfaces create/update/delete API errors", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init?.method === "POST" || init?.method === "PATCH"
        ? okJson({ error: "slug taken" }, 409)
        : init?.method === "DELETE"
          ? Promise.reject(new Error("net down"))
          : okJson({ workspaces: [ws] });
    routes["/api/admin/postiz/groups"] = okJson({}, 503);
    const c = await renderPage(<WorkspacesPage />);
    await flush();
    expect(c.textContent).toContain("Main");

    // create → 409 → formError
    fireEvent.change(c.querySelector("#ws-name")!, { target: { value: "Dup" } });
    fireEvent.submit(c.querySelector("form")!);
    await flush();
    expect(c.textContent).toContain("slug taken");

    // edit → PATCH 409 → error banner (edit mode stays open)
    await click(screen.getAllByText("Edit").find((e) => e.tagName === "BUTTON")!);
    await click(screen.getByText("Save"));
    await flush();
    expect(c.textContent).toContain("slug taken");
    await click(screen.getByText("Cancel"));

    // delete → network throw → error banner
    await click(screen.getAllByText("Delete").find((e) => e.tagName === "BUTTON")!);
    await flush();
    expect(c.textContent).toContain("Failed to delete workspace");
  });

  it("edit form drives every field through PATCH", async () => {
    routes[ROUTE] = (_u: string, init?: RequestInit) =>
      init ? okJson({}) : okJson({ workspaces: [ws] });
    routes["/api/admin/postiz/groups"] = okJson({
      groups: [{ id: "g1", name: "Acme Group" }],
    });
    const c = await renderPage(<WorkspacesPage />);
    await flush();
    await click(screen.getAllByText("Edit").find((e) => e.tagName === "BUTTON")!);

    const inputs = Array.from(c.querySelectorAll("input, textarea"));
    const val = (v: string) =>
      inputs.find((i) => (i as HTMLInputElement).value === v) as
        | HTMLInputElement
        | undefined;
    fireEvent.change(val("Main")!, { target: { value: "Renamed Co" } });
    fireEvent.change(val("prod")!, { target: { value: "staging" } });
    fireEvent.change(val("acme")!, { target: { value: "acme-2" } });
    const sel = c.querySelector("select");
    if (sel) fireEvent.change(sel, { target: { value: "g1" } });
    await click(screen.getByText("Save"));
    await flush();
    const patch = fetchWithAuthMock.mock.calls.find(([, i]) => i?.method === "PATCH");
    const body = JSON.parse(String(patch![1].body));
    expect(body).toMatchObject({ id: "w1", name: "Renamed Co", notionTag: "acme-2" });
  });
});
