/**
 * LinkedIn Lead Gen Forms → EspoCRM helpers.
 *
 * Webhook validation / signature: Microsoft Learn “Webhooks” + Lead Sync.
 * Lead fetch: GET /rest/leadFormResponses/{id} then map predefined fields
 * via the form definition (questionId → FIRST_NAME / EMAIL / …).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { campaigns } from "@/data/campaigns";
import type { LeadData } from "@/lib/espocrm";

export const LINKEDIN_LEADGEN_API_VERSION = "202605";
const LINKEDIN_API_ROOT = "https://api.linkedin.com/rest";

export type LinkedInLeadNotification = {
  type?: string;
  leadGenFormResponse?: string;
  leadGenForm?: string;
  leadType?: string;
  leadAction?: string;
  occurredAt?: number;
  owner?: {
    sponsoredAccount?: string;
    organization?: string;
  };
};

export type LeadFormAnswer = {
  questionId?: number;
  answerDetails?: {
    textQuestionAnswer?: { answer?: string };
    multipleChoiceAnswer?: { options?: number[] };
  };
};

export type LeadFormResponse = {
  id?: string;
  testLead?: boolean;
  submittedAt?: number;
  versionedLeadGenFormUrn?: string;
  formResponse?: { answers?: LeadFormAnswer[] };
  leadMetadata?: {
    sponsoredLeadMetadata?: { campaign?: string };
  };
  owner?: {
    sponsoredAccount?: string;
    organization?: string;
  };
  leadType?: string;
};

type FormQuestion = {
  questionId?: number;
  name?: string;
  predefinedField?: string;
  questionDetails?: { predefinedField?: string };
};

function safeEqHex(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** LinkedIn webhook GET challenge — HMAC-SHA256(challengeCode, clientSecret) as hex. */
export function buildChallengeResponse(challengeCode: string, clientSecret: string): string {
  return createHmac("sha256", clientSecret).update(challengeCode).digest("hex");
}

/**
 * Verify X-LI-Signature on POST bodies.
 * stringToSign = "hmacsha256=" + rawBody; signature = hex(HMACSHA256(stringToSign, secret)).
 */
export function verifyLiSignature(
  rawBody: string,
  signatureHeader: string | null,
  clientSecret: string
): boolean {
  if (!signatureHeader || !clientSecret) return false;
  const expected = createHmac("sha256", clientSecret)
    .update(`hmacsha256=${rawBody}`)
    .digest("hex");
  return safeEqHex(expected.toLowerCase(), signatureHeader.trim().toLowerCase());
}

export function parseLeadGenFormResponseId(urn: string | undefined): string | null {
  if (!urn) return null;
  const m = urn.match(/urn:li:leadGenFormResponse:(.+)$/);
  return m?.[1] ?? null;
}

export function parseLeadGenFormId(urn: string | undefined): string | null {
  if (!urn) return null;
  // urn:li:versionedLeadGenForm:(urn:li:leadGenForm:3162,1) or urn:li:leadGenForm:3162
  const versioned = urn.match(/urn:li:leadGenForm:(\d+)/);
  if (versioned?.[1]) return versioned[1];
  return null;
}

export function parseSponsoredCampaignId(urn: string | undefined): string | null {
  if (!urn) return null;
  const m = urn.match(/urn:li:sponsoredCampaign:(\d+)/);
  return m?.[1] ?? null;
}

export function resolveCampaignSlugFromLinkedInCampaignId(
  linkedInCampaignId: string | null
): string {
  if (!linkedInCampaignId) return "linkedin-leadgen";
  for (const c of campaigns) {
    for (const p of c.adPlatforms ?? []) {
      if (p.platform === "linkedin" && p.campaignIds?.includes(linkedInCampaignId)) {
        return c.slug;
      }
    }
  }
  return "linkedin-leadgen";
}

function questionPredefinedField(q: FormQuestion): string | undefined {
  return q.predefinedField ?? q.questionDetails?.predefinedField ?? undefined;
}

export function mapAnswersToFields(
  answers: LeadFormAnswer[],
  questions: FormQuestion[]
): {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  extras: string[];
} {
  const byId = new Map<number, FormQuestion>();
  for (const q of questions) {
    if (typeof q.questionId === "number") byId.set(q.questionId, q);
  }

  let email: string | undefined;
  let firstName: string | undefined;
  let lastName: string | undefined;
  let phone: string | undefined;
  let company: string | undefined;
  const extras: string[] = [];

  for (const a of answers) {
    const text = a.answerDetails?.textQuestionAnswer?.answer?.trim();
    if (!text) continue;
    const q = typeof a.questionId === "number" ? byId.get(a.questionId) : undefined;
    const field = (questionPredefinedField(q ?? {}) ?? q?.name ?? "").toUpperCase();

    if (field === "EMAIL" || field.includes("EMAIL")) {
      email = text.toLowerCase();
    } else if (field === "FIRST_NAME" || field === "FIRSTNAME") {
      firstName = text;
    } else if (field === "LAST_NAME" || field === "LASTNAME") {
      lastName = text;
    } else if (field === "PHONE" || field === "PHONE_NUMBER" || field.includes("PHONE")) {
      phone = text;
    } else if (field === "COMPANY_NAME" || field === "COMPANY") {
      company = text;
    } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      email = email ?? text.toLowerCase();
    } else {
      const label = q?.name ?? `q${a.questionId ?? "?"}`;
      extras.push(`${label}: ${text}`);
    }
  }

  return { email, firstName, lastName, phone, company, extras };
}

export function toEspoLeadDataFromLeadGen(opts: {
  response: LeadFormResponse;
  questions: FormQuestion[];
  notification?: LinkedInLeadNotification;
}): LeadData | null {
  const answers = opts.response.formResponse?.answers ?? [];
  const mapped = mapAnswersToFields(answers, opts.questions);
  if (!mapped.email) return null;

  const campaignUrn = opts.response.leadMetadata?.sponsoredLeadMetadata?.campaign;
  const campaignId = parseSponsoredCampaignId(campaignUrn);
  const campaignSlug = resolveCampaignSlugFromLinkedInCampaignId(campaignId);
  const responseId = opts.response.id ?? parseLeadGenFormResponseId(opts.notification?.leadGenFormResponse);

  const descLines = [
    "Source: LinkedIn Lead Gen Form",
    opts.response.testLead ? "Test lead: true" : null,
    campaignUrn ? `LinkedIn campaign: ${campaignUrn}` : null,
    opts.notification?.leadGenForm ? `Form: ${opts.notification.leadGenForm}` : null,
    mapped.company ? `Company: ${mapped.company}` : null,
    ...mapped.extras,
  ].filter((v): v is string => Boolean(v));

  return {
    emailAddress: mapped.email,
    firstName: mapped.firstName,
    lastName: mapped.lastName,
    phoneNumber: mapped.phone,
    source: "Other",
    campaignSlug,
    orderId: responseId ? `li-leadgen-${responseId}` : null,
    description: descLines.join("\n"),
    utmSource: "linkedin",
    utmMedium: "leadgen_form",
    utmCampaign: campaignSlug,
  };
}

export function isLeadCreatedNotification(n: unknown): n is LinkedInLeadNotification {
  if (!n || typeof n !== "object") return false;
  const obj = n as LinkedInLeadNotification;
  return (
    obj.type === "LEAD_ACTION" &&
    (obj.leadAction === "CREATED" || obj.leadAction == null) &&
    typeof obj.leadGenFormResponse === "string"
  );
}

async function linkedInGet(
  path: string,
  token: string
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const res = await fetch(`${LINKEDIN_API_ROOT}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": LINKEDIN_LEADGEN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json };
}

export async function fetchLeadFormResponse(opts: {
  responseId: string;
  token: string;
  ownerSponsoredAccount?: string;
  leadType?: string;
}): Promise<LeadFormResponse | null> {
  const leadType = opts.leadType ?? "SPONSORED";
  // Prefer the finder that includes owner (required for many tokens).
  if (opts.ownerSponsoredAccount) {
    const owner = encodeURIComponent(
      `(sponsoredAccount:${opts.ownerSponsoredAccount})`
    );
    const ids = encodeURIComponent(`List(${opts.responseId})`);
    const path =
      `/leadFormResponses?ids=${ids}` +
      `&owner=${owner}` +
      `&leadType=${encodeURIComponent(`(leadType:${leadType})`)}`;
    const batch = await linkedInGet(path, opts.token);
    if (batch.ok && batch.json && typeof batch.json === "object") {
      const results = (batch.json as { results?: Record<string, LeadFormResponse> }).results;
      const hit = results?.[opts.responseId];
      if (hit) return hit;
    }
  }

  const single = await linkedInGet(`/leadFormResponses/${opts.responseId}`, opts.token);
  if (!single.ok || !single.json || typeof single.json !== "object") return null;
  return single.json as LeadFormResponse;
}

export async function fetchLeadFormQuestions(opts: {
  formId: string;
  token: string;
  ownerSponsoredAccount?: string;
  leadType?: string;
}): Promise<FormQuestion[]> {
  const leadType = opts.leadType ?? "SPONSORED";
  let path = `/leadForms/${opts.formId}`;
  if (opts.ownerSponsoredAccount) {
    path +=
      `?owner=${encodeURIComponent(`(sponsoredAccount:${opts.ownerSponsoredAccount})`)}` +
      `&leadType=${encodeURIComponent(`(leadType:${leadType})`)}`;
  }
  const res = await linkedInGet(path, opts.token);
  if (!res.ok || !res.json || typeof res.json !== "object") return [];
  const form = res.json as {
    questions?: FormQuestion[];
    content?: { questions?: FormQuestion[] };
  };
  return form.questions ?? form.content?.questions ?? [];
}
