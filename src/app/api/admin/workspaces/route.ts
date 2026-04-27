import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { randomUUID } from "node:crypto";

const SSM_KEY = "/cloudless/WORKSPACES_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  adminEmails: string[];
  createdAt: string;
}

async function readWorkspaces(): Promise<Workspace[]> {
  try {
    const client = new SSMClient({ region: REGION });
    const res = await client.send(new GetParameterCommand({ Name: SSM_KEY }));
    return JSON.parse(res.Parameter?.Value ?? "[]");
  } catch {
    return [];
  }
}

async function writeWorkspaces(workspaces: Workspace[]): Promise<void> {
  const client = new SSMClient({ region: REGION });
  await client.send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(workspaces),
      Type: "String",
      Overwrite: true,
    }),
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
    .slice(0, 40);
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

  const body = (await request.json()) as {
    name?: string;
    description?: string;
    adminEmails?: string[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const workspaces = await readWorkspaces();

  const slug = toSlug(body.name);
  if (workspaces.some((w) => w.slug === slug)) {
    return NextResponse.json(
      { error: "A workspace with this name already exists" },
      { status: 409 },
    );
  }

  const workspace: Workspace = {
    id: randomUUID(),
    name: String(body.name).trim().slice(0, 100),
    slug,
    description: String(body.description ?? "").slice(0, 300),
    adminEmails: Array.isArray(body.adminEmails)
      ? body.adminEmails.map(String).slice(0, 20)
      : [],
    createdAt: new Date().toISOString(),
  };

  workspaces.push(workspace);
  await writeWorkspaces(workspaces);

  return NextResponse.json({ workspace }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    description?: string;
    adminEmails?: string[];
  };

  if (!body.id)
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  const workspaces = await readWorkspaces();
  const idx = workspaces.findIndex((w) => w.id === body.id);
  if (idx === -1)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (body.name) {
    workspaces[idx].name = String(body.name).trim().slice(0, 100);
    workspaces[idx].slug = toSlug(body.name);
  }
  if (body.description !== undefined) {
    workspaces[idx].description = String(body.description).slice(0, 300);
  }
  if (Array.isArray(body.adminEmails)) {
    workspaces[idx].adminEmails = body.adminEmails.map(String).slice(0, 20);
  }

  await writeWorkspaces(workspaces);
  return NextResponse.json({ workspace: workspaces[idx] });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = (await request.json()) as { id?: string };
  if (!id)
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  const workspaces = await readWorkspaces();
  const updated = workspaces.filter((w) => w.id !== id);
  await writeWorkspaces(updated);

  return NextResponse.json({ ok: true });
}
