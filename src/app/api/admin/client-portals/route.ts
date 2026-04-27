import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { randomUUID } from "node:crypto";

const SSM_KEY = "/cloudless/CLIENT_PORTALS_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

export interface PortalComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface PortalStep {
  id: string;
  name: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  completedAt?: string;
  comments: PortalComment[];
}

export interface ClientPortal {
  token: string;
  label: string;
  clientEmail: string;
  clientName: string;
  createdAt: string;
  steps: PortalStep[];
}

const DEFAULT_STEP_NAMES = [
  "Free Audit",
  "Proposal & Scope",
  "Setup & Kickoff",
  "Implementation",
  "Review & Feedback",
  "Delivery & Handoff",
];

function makeDefaultSteps(): PortalStep[] {
  return DEFAULT_STEP_NAMES.map((name) => ({
    id: randomUUID(),
    name,
    status: "pending",
    comments: [],
  }));
}

async function readPortals(): Promise<ClientPortal[]> {
  try {
    const client = new SSMClient({ region: REGION });
    const res = await client.send(new GetParameterCommand({ Name: SSM_KEY }));
    return JSON.parse(res.Parameter?.Value ?? "[]");
  } catch {
    return [];
  }
}

async function writePortals(portals: ClientPortal[]): Promise<void> {
  const client = new SSMClient({ region: REGION });
  await client.send(
    new PutParameterCommand({
      Name: SSM_KEY,
      Value: JSON.stringify(portals),
      Type: "String",
      Overwrite: true,
    }),
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const portals = await readPortals();
  return NextResponse.json({ portals });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    label?: string;
    clientEmail?: string;
    clientName?: string;
    stepNames?: string[];
  };
  if (!body.clientEmail || !body.label) {
    return NextResponse.json(
      { error: "clientEmail and label are required" },
      { status: 400 },
    );
  }

  const portals = await readPortals();

  const portal: ClientPortal = {
    token: randomUUID(),
    label: String(body.label).slice(0, 100),
    clientEmail: String(body.clientEmail).slice(0, 200),
    clientName: String(body.clientName ?? "").slice(0, 200),
    createdAt: new Date().toISOString(),
    steps: body.stepNames?.length
      ? body.stepNames.slice(0, 12).map((name) => ({
          id: randomUUID(),
          name: String(name).slice(0, 80),
          status: "pending" as const,
          comments: [],
        }))
      : makeDefaultSteps(),
  };

  portals.push(portal);
  await writePortals(portals);

  return NextResponse.json({ portal }, { status: 201 });
}

type PatchAction =
  | {
      token: string;
      action: "update-step";
      stepId: string;
      status: PortalStep["status"];
    }
  | {
      token: string;
      action: "add-comment";
      stepId: string;
      author: string;
      text: string;
    }
  | {
      token: string;
      action: "delete-comment";
      stepId: string;
      commentId: string;
    }
  | { token: string; action: "add-step"; name: string }
  | { token: string; action: "delete-step"; stepId: string }
  | { token: string; action: "rename-step"; stepId: string; name: string };

function stepNotFound() {
  return NextResponse.json({ error: "Step not found" }, { status: 404 });
}

function applyUpdateStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "update-step" }>,
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.status = body.status;
  if (body.status === "completed" && !step.completedAt) {
    step.completedAt = new Date().toISOString();
  } else if (body.status !== "completed") {
    delete step.completedAt;
  }
  return null;
}

function applyAddComment(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-comment" }>,
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  if (!body.text?.trim()) {
    return NextResponse.json(
      { error: "Comment text required" },
      { status: 400 },
    );
  }
  step.comments.push({
    id: randomUUID(),
    author: String(body.author || "Cloudless Team").slice(0, 80),
    text: String(body.text).slice(0, 2000),
    createdAt: new Date().toISOString(),
  });
  return null;
}

function applyDeleteComment(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "delete-comment" }>,
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.comments = step.comments.filter((c) => c.id !== body.commentId);
  return null;
}

function applyAddStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "add-step" }>,
): NextResponse | null {
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Step name required" }, { status: 400 });
  }
  portal.steps.push({
    id: randomUUID(),
    name: String(body.name).slice(0, 80),
    status: "pending",
    comments: [],
  });
  return null;
}

function applyRenameStep(
  portal: ClientPortal,
  body: Extract<PatchAction, { action: "rename-step" }>,
): NextResponse | null {
  const step = portal.steps.find((s) => s.id === body.stepId);
  if (!step) return stepNotFound();
  step.name = String(body.name).slice(0, 80);
  return null;
}

function dispatchPatch(
  portal: ClientPortal,
  body: PatchAction,
): NextResponse | null {
  switch (body.action) {
    case "update-step":
      return applyUpdateStep(portal, body);
    case "add-comment":
      return applyAddComment(portal, body);
    case "delete-comment":
      return applyDeleteComment(portal, body);
    case "add-step":
      return applyAddStep(portal, body);
    case "delete-step":
      portal.steps = portal.steps.filter((s) => s.id !== body.stepId);
      return null;
    case "rename-step":
      return applyRenameStep(portal, body);
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as PatchAction;
  if (!body.token || !body.action) {
    return NextResponse.json(
      { error: "token and action are required" },
      { status: 400 },
    );
  }

  const portals = await readPortals();
  const idx = portals.findIndex((p) => p.token === body.token);
  if (idx === -1) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const portal = portals[idx];
  const errorResponse = dispatchPatch(portal, body);
  if (errorResponse) return errorResponse;

  portals[idx] = portal;
  await writePortals(portals);
  return NextResponse.json({ portal });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { token } = (await request.json()) as { token?: string };
  if (!token)
    return NextResponse.json({ error: "token is required" }, { status: 400 });

  const portals = await readPortals();
  const updated = portals.filter((p) => p.token !== token);
  await writePortals(updated);

  return NextResponse.json({ ok: true });
}
