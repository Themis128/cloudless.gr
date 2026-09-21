import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getConfig } from "@/lib/ssm-config";
import { createLead } from "@/lib/espocrm";
import { isSocialAutoLead, toEspoLeadData, type SocialAutoLead } from "@/lib/socialauto-leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

async function verifySecret(req: NextRequest): Promise<true | Response> {
  const cfg = await getConfig();
  const expected = cfg.SOCIALAUTO_LEADS_WEBHOOK_SECRET || "";
  if (!expected) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }

  const headerSecret = req.headers.get("x-socialauto-webhook-secret") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice("bearer ".length).trim()
    : "";
  const provided = headerSecret || bearer;

  if (!provided) {
    return NextResponse.json({ error: "missing_secret" }, { status: 401 });
  }
  if (!safeEq(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return true;
}

export async function GET() {
  return NextResponse.json({ error: "POST only" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  const auth = await verifySecret(req);
  if (auth !== true) return auth;

  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

  const workItems: Array<SocialAutoLead | { invalid: true }> = [];
  for (const item of items) {
    const candidates = extractLeadCandidates(item);
    if (!candidates || candidates.length === 0) {
      workItems.push({ invalid: true });
      continue;
    }
    for (const candidate of candidates) {
      if (isSocialAutoLead(candidate)) workItems.push(candidate);
      else workItems.push({ invalid: true });
    }
  }

  if (workItems.length === 0) {
    return NextResponse.json({
      ok: true,
      results: [] as Array<{ ok: boolean; espocrm_lead_id: string | null }>,
    });
  }
  if (workItems.length > 100) {
    return NextResponse.json({ error: "too_many_items" }, { status: 413 });
  }

  const results = await Promise.all(
    workItems.map(async (item): Promise<{ ok: boolean; espocrm_lead_id: string | null }> => {
      if ("invalid" in item) {
        return { ok: false, espocrm_lead_id: null };
      }
      const data = toEspoLeadData(item);
      if (!data.emailAddress) return { ok: false, espocrm_lead_id: null };
      const id = await createLead(data);
      return { ok: Boolean(id), espocrm_lead_id: id };
    })
  );

  return NextResponse.json({ ok: true, results });
}

function extractLeadCandidates(item: unknown): unknown[] | null {
  if (!item || typeof item !== "object") return null;
  if (isSocialAutoLead(item)) return [item];

  const obj = item as Record<string, unknown>;
  if (Array.isArray(obj.leads)) return obj.leads;
  if (obj.lead !== undefined) return [obj.lead];
  return null;
}
