import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  readPendingClients,
  approvePendingClient,
  writePendingClients,
} from "@/lib/pending-clients";
import { sendEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/escape-html";
import {
  SSMClient,
  GetParameterCommand,
  PutParameterCommand,
} from "@aws-sdk/client-ssm";
import { randomUUID } from "crypto";
import type {
  ClientPortal,
  PortalStep,
} from "@/app/api/admin/client-portals/route";

const PORTALS_SSM_KEY = "/cloudless/CLIENT_PORTALS_JSON";
const REGION = process.env.AWS_REGION ?? "eu-central-1";

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
    const res = await client.send(
      new GetParameterCommand({ Name: PORTALS_SSM_KEY }),
    );
    return JSON.parse(res.Parameter?.Value ?? "[]");
  } catch {
    return [];
  }
}

async function writePortals(portals: ClientPortal[]): Promise<void> {
  const client = new SSMClient({ region: REGION });
  await client.send(
    new PutParameterCommand({
      Name: PORTALS_SSM_KEY,
      Value: JSON.stringify(portals),
      Type: "String",
      Overwrite: true,
    }),
  );
}

/** GET — list all pending clients for admin review */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const clients = await readPendingClients();
  // Newest waiting first
  const sorted = [...clients].sort((a, b) => {
    if (a.status === "waiting" && b.status !== "waiting") return -1;
    if (a.status !== "waiting" && b.status === "waiting") return 1;
    return (
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  });
  return NextResponse.json({ clients: sorted });
}

/**
 * POST — approve a pending client and create their portal in one click.
 * Body: { email: string; label?: string; stepNames?: string[] }
 * Sends the client a welcome email with their portal link.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    label?: string;
    stepNames?: string[];
  };

  if (!body.email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const clients = await readPendingClients();
  const pending = clients.find(
    (c) => c.email.toLowerCase() === body.email!.toLowerCase(),
  );
  if (!pending) {
    return NextResponse.json(
      { error: "Pending client not found" },
      { status: 404 },
    );
  }
  if (pending.status === "approved" && pending.portalToken) {
    return NextResponse.json(
      { error: "Already approved", portalToken: pending.portalToken },
      { status: 409 },
    );
  }

  // Create the portal
  const portalToken = randomUUID();
  const portals = await readPortals();
  const portal: ClientPortal = {
    token: portalToken,
    label:
      body.label?.trim() ||
      `${pending.name ?? pending.email} — ${pending.planLabel ?? pending.plan}`,
    clientEmail: pending.email,
    clientName: pending.name ?? "",
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

  // Update pending client to approved
  await approvePendingClient(pending.email, portalToken);

  // Send welcome email to client
  notifyClientOfApproval(portal).catch((err) => {
    console.error("[admin/pending-clients/approve] client email failed:", err);
  });

  return NextResponse.json({ portal, token: portalToken }, { status: 201 });
}

/** DELETE — decline a pending client (removes from list) */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { email } = (await request.json().catch(() => ({}))) as {
    email?: string;
  };
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const clients = await readPendingClients();
  const updated = clients.filter(
    (c) => c.email.toLowerCase() !== email.toLowerCase(),
  );
  await writePendingClients(updated);
  return NextResponse.json({ ok: true });
}

async function notifyClientOfApproval(portal: ClientPortal) {
  const portalUrl = `https://cloudless.gr/portal/${portal.token}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #0f172a; font-size: 22px; margin: 0 0 8px;">Your Cloudless portal is ready</h2>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Hi ${escapeHtml(portal.clientName || "there")},
      </p>
      <p style="color: #475569; font-size: 14px; line-height: 1.6;">
        Your project portal is set up and ready to go. You can track your project progress, see step-by-step updates from our team, and access your invoices any time using the link below.
      </p>
      <p style="margin: 24px 0;">
        <a href="${portalUrl}" style="display: inline-block; background: #06b6d4; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Open my portal</a>
      </p>
      <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
        Or copy this link: <br/>
        <code style="background: #f1f5f9; padding: 4px 6px; border-radius: 3px; word-break: break-all;">${portalUrl}</code>
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
      <p style="color: #94a3b8; font-size: 12px;">
        Questions? Just reply to this email and we'll get right back to you.<br/>
        — The Cloudless team
      </p>
    </div>
  `;
  const text = [
    `Hi ${portal.clientName || "there"},`,
    "",
    "Your Cloudless portal is ready.",
    "Track your project progress, see step-by-step updates, and access your invoices any time.",
    "",
    `Open your portal: ${portalUrl}`,
    "",
    "Questions? Just reply to this email.",
    "— The Cloudless team",
  ].join("\n");

  await sendEmail({
    to: portal.clientEmail,
    subject: "Your Cloudless portal is ready",
    html,
    text,
    fromLabel: "Cloudless",
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
