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
import { createLeadDetailed } from "@/lib/espocrm";
import {
  buildChallengeResponse,
  fetchLeadFormQuestionsDetailed,
  fetchLeadFormResponseDetailed,
  isLeadCreatedNotification,
  parseLeadGenFormId,
  parseLeadGenFormResponseId,
  toEspoLeadDataFromLeadGen,
  verifyLiSignature,
  type LinkedInLeadNotification,
} from "@/lib/linkedin-leadgen";
import { normalizeLinkedInAdAccountId } from "@/lib/linkedin-api";

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

  const ownerUrn = accountId
    ? `urn:li:sponsoredAccount:${normalizeLinkedInAdAccountId(accountId)}`
    : undefined;

  // `retryable` marks failures a LinkedIn redelivery could fix (upstream fetch
  // or EspoCRM write). Permanent failures (bad URN, unmappable lead) stay 200 —
  // retrying them can never succeed. If ANY item is retryable-failed we answer
  // 502 so LinkedIn redelivers the batch; createLead dedupes by email, so the
  // redelivery can't double-create the items that already succeeded.
  const results = await Promise.all(
    notifications.map(async (n) => {
      if (!isLeadCreatedNotification(n)) {
        return {
          ok: true,
          skipped: true as const,
          retryable: false as const,
          espocrm_lead_id: null,
        };
      }

      const responseId = parseLeadGenFormResponseId(n.leadGenFormResponse);
      if (!responseId) {
        return { ok: false, retryable: false as const, espocrm_lead_id: null };
      }

      const ownerSponsoredAccount = n.owner?.sponsoredAccount ?? ownerUrn ?? undefined;
      const leadType = n.leadType ?? "SPONSORED";

      const { response, failure: fetchFailure } = await fetchLeadFormResponseDetailed({
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
        return {
          ok: false,
          retryable: fetchFailure !== "permanent",
          espocrm_lead_id: null,
        };
      }

      const formId =
        parseLeadGenFormId(n.leadGenForm) ?? parseLeadGenFormId(response.versionedLeadGenFormUrn);
      const questionsResult = formId
        ? await fetchLeadFormQuestionsDetailed({
            formId,
            token: accessToken,
            ownerSponsoredAccount,
            leadType,
          })
        : { questions: [], failure: undefined };
      // A transient questions-fetch failure would strip field labels and can
      // make a mappable lead look email-less — treat it as retryable rather
      // than dropping the lead as "permanent".
      if (questionsResult.failure === "transient") {
        return { ok: false, retryable: true as const, espocrm_lead_id: null };
      }

      const leadData = toEspoLeadDataFromLeadGen({
        response,
        questions: questionsResult.questions,
        notification: n,
      });
      if (!leadData?.emailAddress) {
        console.error(
          "[linkedin-leads] no email on lead",
          responseId.replace(/\n/g, "").replace(/\r/g, "")
        );
        return { ok: false, retryable: false as const, espocrm_lead_id: null };
      }

      const { id, failure } = await createLeadDetailed(leadData);
      return id
        ? { ok: true, retryable: false as const, espocrm_lead_id: id, skipped: false as const }
        : {
            ok: false,
            retryable: failure !== "permanent",
            espocrm_lead_id: null,
            skipped: false as const,
          };
    })
  );

  const hasRetryableFailure = results.some((r) => r.ok === false && r.retryable === true);
  if (hasRetryableFailure) {
    return NextResponse.json({ ok: false, error: "upstream_failure", results }, { status: 502 });
  }
  return NextResponse.json({ ok: true, results });
}
