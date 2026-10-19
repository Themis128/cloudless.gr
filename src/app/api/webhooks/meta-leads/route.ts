/**
 * Meta Lead Ads webhook — real-time leadgen delivery → EspoCRM.
 *
 * GET  — Meta hub handshake: `hub.mode=subscribe` + `hub.verify_token`
 *        (META_LEADS_VERIFY_TOKEN) → echoes `hub.challenge` as plain text.
 * POST — `X-Hub-Signature-256` verified with META_APP_SECRET over the raw
 *        body; each `field=leadgen` change is fetched via Graph API with
 *        META_ACCESS_TOKEN (needs `leads_retrieval`) and written to EspoCRM
 *        via `createLead` (source "Meta Lead Ad", TargetList "Meta lead ads").
 *
 * One-time setup (see meta-graph-ops / developer-apps-ops):
 *   1. App Dashboard → Webhooks → Page → subscribe callback URL, verify token
 *   2. POST /{page-id}/subscribed_apps?subscribed_fields=leadgen (Page token)
 *   3. App needs `leads_retrieval` (Advanced Access for non-owned pages)
 */

import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { createLead } from "@/lib/espocrm";
import {
  extractLeadgenChanges,
  fetchLeadgenLead,
  toEspoLeadDataFromMeta,
  verifyHubSignature,
} from "@/lib/meta-leadgen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  const cfg = await getConfig();
  const expected = cfg.META_LEADS_VERIFY_TOKEN || process.env.META_LEADS_VERIFY_TOKEN || "";
  if (!expected) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }
  if (mode === "subscribe" && token === expected && challenge != null) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const cfg = await getConfig();
  const appSecret = cfg.META_APP_SECRET || process.env.META_APP_SECRET || "";
  const accessToken = cfg.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || "";

  if (!appSecret) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyHubSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const changes = extractLeadgenChanges(parsed);
  if (!changes.length) {
    return NextResponse.json({ ok: true, results: [] });
  }

  if (!accessToken) {
    // Signature verified — acknowledge so Meta does not retry forever, but we
    // cannot fetch lead PII without a Page access token.
    console.error("[meta-leads] META_ACCESS_TOKEN missing; notification acknowledged only");
    return NextResponse.json({ ok: true, results: [], warning: "token_missing" });
  }

  const results = await Promise.all(
    changes.map(async (change) => {
      const lead = await fetchLeadgenLead(change.leadgen_id, accessToken);
      if (!lead) {
        return {
          ok: false,
          espocrm_lead_id: null,
          leadgen_id: change.leadgen_id,
          reason: "graph_fetch_failed",
        };
      }
      const leadData = toEspoLeadDataFromMeta(lead, change);
      if (!leadData) {
        return { ok: false, espocrm_lead_id: null, reason: "no_email" };
      }
      const id = await createLead(leadData);
      return {
        ok: Boolean(id),
        espocrm_lead_id: id,
        leadgen_id: change.leadgen_id,
        ...(id ? {} : { reason: "crm_write_failed" }),
      };
    })
  );

  // Meta retries non-2xx deliveries — 500 on transient failures (Graph/CRM
  // outages) so the lead is not silently lost; permanent issues like
  // "no_email" still ack 200 to stop useless retries.
  const retryable = results.some((r) => !r.ok && r.reason !== "no_email");
  return NextResponse.json({ ok: !retryable, results }, { status: retryable ? 500 : 200 });
}
