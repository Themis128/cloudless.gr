import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/api-auth";
import {
  readWorkspaces,
  writeWorkspaces,
  WORKSPACE_COOKIE,
  type Workspace,
} from "@/lib/workspace-server";
import { auditWorkspaceEvent } from "@/lib/workspace-audit";

// Re-export the Workspace type so existing imports
// (`@/app/api/admin/workspaces/route`) keep resolving without a churn-PR.
export type { Workspace };

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 40);
}

function trim(str: unknown, max: number): string {
  return String(str ?? "")
    .trim()
    .slice(0, max);
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const workspaces = await readWorkspaces();
  return NextResponse.json({ workspaces });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (((await request.json()) as any)) as Partial<Workspace> & { name?: string };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const workspaces = await readWorkspaces();
  const slug = toSlug(body.name);
  if (workspaces.some((w) => w.slug === slug)) {
    return NextResponse.json(
      { error: "A workspace with this name already exists" },
      { status: 409 }
    );
  }

  const workspace: Workspace = {
    id: randomUUID(),
    name: trim(body.name, 100),
    slug,
    description: trim(body.description, 300),
    adminEmails: Array.isArray(body.adminEmails) ? body.adminEmails.map(String).slice(0, 20) : [],
    createdAt: new Date().toISOString(),
    ...(body.postizGroupId ? { postizGroupId: trim(body.postizGroupId, 100) } : {}),
    ...(body.notionTag ? { notionTag: trim(body.notionTag, 100) } : {}),
  };

  workspaces.push(workspace);
  await writeWorkspaces(workspaces);

  // Fire-and-forget audit log — never block on Slack failures.
  auditWorkspaceEvent("created", workspace, auth.user.email).catch((e) =>
    console.error("[workspaces audit]", e)
  );

  // Set the cookie so the freshly-created workspace becomes active for
  // subsequent requests on this session. Mirrors localStorage in the client.
  const res = NextResponse.json({ workspace }, { status: 201 });
  res.cookies.set({
    name: WORKSPACE_COOKIE,
    value: workspace.id,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure: true,
  });
  return res;
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (((await request.json()) as any)) as Partial<Workspace>;
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const workspaces = await readWorkspaces();
  const idx = workspaces.findIndex((w) => w.id === body.id);
  if (idx === -1) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (body.name) {
    workspaces[idx].name = trim(body.name, 100);
    workspaces[idx].slug = toSlug(body.name);
  }
  if (body.description !== undefined) {
    workspaces[idx].description = trim(body.description, 300);
  }
  if (Array.isArray(body.adminEmails)) {
    workspaces[idx].adminEmails = body.adminEmails.map(String).slice(0, 20);
  }
  if (body.postizGroupId !== undefined) {
    const v = trim(body.postizGroupId, 100);
    if (v) workspaces[idx].postizGroupId = v;
    else delete workspaces[idx].postizGroupId;
  }
  if (body.notionTag !== undefined) {
    const v = trim(body.notionTag, 100);
    if (v) workspaces[idx].notionTag = v;
    else delete workspaces[idx].notionTag;
  }

  await writeWorkspaces(workspaces);

  auditWorkspaceEvent("updated", workspaces[idx], auth.user.email).catch((e) =>
    console.error("[workspaces audit]", e)
  );

  return NextResponse.json({ workspace: workspaces[idx] });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = (((await request.json()) as any)) as { id?: string };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const workspaces = await readWorkspaces();
  const deleted = workspaces.find((w) => w.id === id);
  const updated = workspaces.filter((w) => w.id !== id);
  await writeWorkspaces(updated);

  if (deleted) {
    auditWorkspaceEvent("deleted", deleted, auth.user.email).catch((e) =>
      console.error("[workspaces audit]", e)
    );
  }

  return NextResponse.json({ ok: true });
}
