/**
 * LinkedIn Lead Gen Forms webhook.
 *
 * GET  — LinkedIn challenge validation (challengeCode → challengeResponse HMAC)
 * POST — Lead notification → fetch leadFormResponses → EspoCRM createLead
 *
 * Auth: X-LI-Signature over raw body using LINKEDIN_CLIENT_SECRET (no custom
 * shared secret — LinkedIn forbids requiring extra auth tokens on the URL).
 *
 * Register once (owner-level) via:
 *   node scripts/register-linkedin-leadgen-webhook.mjs
 *
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync
 */

import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/ssm-config";
import { createLead } from "@/lib/espocrm";
import {
  buildChallengeResponse,
  fetchLeadFormQuestions,
  fetchLeadFormResponse,
  isLeadCreatedNotification,
  parseLeadGenFormId,
  parseLeadGenFormResponseId,
  toEspoLeadDataFromLeadGen,
  verifyLiSignature,
  type LinkedInLeadNotification,
} from "@/lib/linkedin-leadgen";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveSecrets(): Promise<{
  clientSecret: string;
  accessToken: string;
  accountId: string;
}> {
  const cfg = await getConfig();
  return {
    clientSecret: cfg.LINKEDIN_CLIENT_SECRET || process.env.LINKEDIN_CLIENT_SECRET || "",
    accessToken:
      process.env.LINKEDIN_ACCESS_TOKEN ||
      cfg.LINKEDIN_ACCESS_TOKEN ||
      process.env.LINKEDIN_CAPI_ACCESS_TOKEN ||
      cfg.LINKEDIN_CAPI_ACCESS_TOKEN ||
      "",
    accountId: cfg.LINKEDIN_AD_ACCOUNT_ID || process.env.LINKEDIN_AD_ACCOUNT_ID || "",
  };
}

export async function GET(request: NextRequest) {
  const challengeCode = request.nextUrl.searchParams.get("challengeCode");
  if (!challengeCode) {
    return NextResponse.json({ error: "missing_challengeCode" }, { status: 400 });
  }

  const { clientSecret } = await resolveSecrets();
  if (!clientSecret) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }

  const challengeResponse = buildChallengeResponse(challengeCode, clientSecret);
  return NextResponse.json(
    { challengeCode, challengeResponse },
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function POST(request: NextRequest) {
  const { clientSecret, accessToken, accountId } = await resolveSecrets();
  if (!clientSecret) {
    return NextResponse.json({ error: "receiver_not_configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-li-signature");
  if (!verifyLiSignature(rawBody, signature, clientSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const notifications: LinkedInLeadNotification[] = Array.isArray(parsed)
    ? (parsed as LinkedInLeadNotification[])
    : [parsed as LinkedInLeadNotification];

  if (!accessToken) {
    // Signature verified — acknowledge so LinkedIn does not retry forever,
    // but we cannot fetch PII without a token.
    console.error("[linkedin-leads] ACCESS_TOKEN missing; notification acknowledged only");
    return NextResponse.json({ ok: true, results: [], warning: "token_missing" });
  }

  const ownerUrn = accountId ? `urn:li:sponsoredAccount:${accountId}` : undefined;

  const results = await Promise.all(
    notifications.map(async (n) => {
      if (!isLeadCreatedNotification(n)) {
        return { ok: true, skipped: true as const, espocrm_lead_id: null };
      }
      if (n.leadAction === "DELETED") {
        return { ok: true, skipped: true as const, espocrm_lead_id: null };
      }

      const responseId = parseLeadGenFormResponseId(n.leadGenFormResponse);
      if (!responseId) {
        return { ok: false, espocrm_lead_id: null };
      }

      const ownerSponsoredAccount = n.owner?.sponsoredAccount ?? ownerUrn ?? undefined;
      const leadType = n.leadType ?? "SPONSORED";

      const response = await fetchLeadFormResponse({
        responseId,
        token: accessToken,
        ownerSponsoredAccount,
        leadType,
      });
      if (!response) {
        console.error(
          "[linkedin-leads] failed to fetch leadFormResponse",
          responseId.replace(/\n/g, "").replace(/\r/g, "")
        );
        return { ok: false, espocrm_lead_id: null };
      }

      const formId =
        parseLeadGenFormId(n.leadGenForm) ?? parseLeadGenFormId(response.versionedLeadGenFormUrn);
      const questions = formId
        ? await fetchLeadFormQuestions({
            formId,
            token: accessToken,
            ownerSponsoredAccount,
            leadType,
          })
        : [];

      const leadData = toEspoLeadDataFromLeadGen({
        response,
        questions,
        notification: n,
      });
      if (!leadData?.emailAddress) {
        console.error(
          "[linkedin-leads] no email on lead",
          responseId.replace(/\n/g, "").replace(/\r/g, "")
        );
        return { ok: false, espocrm_lead_id: null };
      }

      const id = await createLead(leadData);
      return { ok: Boolean(id), espocrm_lead_id: id, skipped: false as const };
    })
  );

  return NextResponse.json({ ok: true, results });
}
