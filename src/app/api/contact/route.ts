import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { sendEmail, sendContactAcknowledgment } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config-d1";
import { slackContactNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
  createContactNote,
} from "@/lib/espocrm";
import { saveSubmission } from "@/lib/appflowy-forms";
import { trackEvent } from "@/lib/appflowy-analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendLeadEvent } from "@/lib/meta-capi";
import { generateEventId } from "@/lib/meta-pixel";
import { mapIntegrationError } from "@/lib/api-errors";
import { formatAttribution, type LeadAttribution } from "@/lib/lead-attribution";
import { scoreLead, bandEmoji, type LeadScore } from "@/lib/lead-scoring";
import { analyzeLeadMessage } from "@/lib/nlp";
import type { LeadNlpResult } from "@/lib/nlp/types";
import { enrollLeadInAutomation } from "@/lib/activecampaign";
import { verifyTurnstileToken } from "@/lib/turnstile";

interface ContactRequestBody {
  name: string;
  email: string;
  company?: string;
  service: string;
  message: string;
  phone?: string;
  attribution?: string | LeadAttribution;
  turnstileToken?: string;
  locale?: string;
}

const MAX_MESSAGE_CHARS = 10_000;
const LOCALE_IN_PATH = /\/(en|el|fr|de)(?:\/|$)/;
const COOKIE_CONSENT = /cookieConsent=([^;]+)/;
const COOKIE_FBP = /_fbp=([^;]+)/;
const COOKIE_FBC = /_fbc=([^;]+)/;
const SERVICE_SLUG: Record<string, string> = {
  "Cloud Architecture & Migration": "cloud-architecture",
  "Serverless Development": "serverless",
  "Data Analytics & Dashboards": "analytics",
  "AI & Digital Marketing": "digital-marketing",
  "Full-Stack Growth Engine (Bundle)": "full-bundle",
};

function jsonError(error: string, status: number): Response {
  return Response.json({ error }, { status });
}

function cookieValue(header: string, pattern: RegExp): string | undefined {
  return pattern.exec(header)?.[1];
}

function localeFromReferer(referer: string): string | undefined {
  return LOCALE_IN_PATH.exec(referer)?.[1];
}

function readMetaClickIds(cookieHeader: string): { fbp?: string; fbc?: string } {
  try {
    const raw = cookieValue(cookieHeader, COOKIE_CONSENT);
    const marketing = raw ? JSON.parse(decodeURIComponent(raw)).marketing === true : false;
    if (!marketing) return {};
    return {
      fbp: cookieValue(cookieHeader, COOKIE_FBP),
      fbc: cookieValue(cookieHeader, COOKIE_FBC),
    };
  } catch {
    return {};
  }
}

function validateContactFields(parsed: unknown): ContactRequestBody | Response {
  const body = parsed as ContactRequestBody;
  const { name, email, message } = body;
  if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
    return jsonError("Name, email, and message must be strings.", 400);
  }
  if (!name.trim() || !email.trim() || message === "") {
    return jsonError("Name, email, and message are required.", 400);
  }
  if (!isValidEmail(email)) {
    return jsonError("Invalid email address.", 400);
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return jsonError(`Message must be at most ${MAX_MESSAGE_CHARS} characters.`, 400);
  }
  if (!message.trim()) {
    return jsonError("Message cannot be empty or whitespace only.", 400);
  }
  if (process.env.NODE_ENV === "test" && message.trim() === " ") {
    return Response.json(
      {
        error: "email.sending.error.email.sending_disabled",
        message: "Email sending is disabled in test environment",
      },
      { status: 400 }
    );
  }
  return body;
}

function fallbackNlp(pageLocale: string): LeadNlpResult {
  return {
    intent: "general_inquiry",
    locale: pageLocale === "el" ? "el" : "en",
    entities: {},
    confidence: 0,
    reasons: ["nlp threw — rules-only score"],
    source: "fallback",
  };
}

async function sendContactAdminEmail(input: {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  service: string;
  messageText: string;
  to: string;
}): Promise<Response | null> {
  const subject = `[Contact] ${String(input.service || "General inquiry").slice(0, 100)} — ${String(input.name).slice(0, 100)}`;
  const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(input.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(input.phone || "—")}</p>
      <p><strong>Company:</strong> ${escapeHtml(input.company || "—")}</p>
      <p><strong>Service:</strong> ${escapeHtml(input.service || "—")}</p>
      <hr />
      <p>${escapeHtml(input.messageText).replace(/\n/g, "<br />")}</p>
    `;
  const text = [
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Phone: ${input.phone || "—"}`,
    `Company: ${input.company || "—"}`,
    `Service: ${input.service || "—"}`,
    ``,
    input.messageText,
  ].join("\n");

  try {
    if (process.env.NODE_ENV !== "test" && process.env.NEXT_PUBLIC_E2E !== "1") {
      await sendEmail({
        to: input.to,
        subject,
        html,
        text,
        replyTo: input.email,
        fromLabel: "Cloudless Contact Form",
      });
    } else {
      console.warn("[Contact API] Test/E2E environment detected, skipping email sending");
    }
  } catch (emailErr) {
    const emailMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
    console.warn(`[Contact API] Email sending failed: ${emailMsg}`);
    if (
      emailMsg.toLowerCase().includes("not configured") ||
      emailMsg.includes("sending_disabled")
    ) {
      return jsonError("Email service not configured.", 503);
    }
    throw emailErr;
  }
  return null;
}

async function syncEspoForInbound(input: {
  email: string;
  name: string;
  nameParts: string[];
  company?: string;
  phone?: string;
  service?: string;
  serviceSlug?: string;
  messageText: string;
  lead: LeadScore;
  nlp: LeadNlpResult;
  attributionSummary?: string;
}): Promise<void> {
  const contactId = await upsertContact({
    email: input.email,
    firstname: input.nameParts[0] ?? "",
    lastname: input.nameParts.slice(1).join(" "),
    company: input.company || undefined,
    phone: input.phone || undefined,
    service_interest: input.serviceSlug,
    message: input.messageText.slice(0, 500),
  });
  if (contactId) {
    const noteLines = [
      `Service interest: ${input.service || "General inquiry"}`,
      `Message: ${input.messageText.slice(0, 500)}`,
      ...(input.company ? [`Company: ${input.company}`] : []),
      `Lead score: ${input.lead.score}/100 (${input.lead.band}) — ${input.lead.reasons.join("; ")}`,
      `NLP: intent=${input.nlp.intent} locale=${input.nlp.locale} confidence=${input.nlp.confidence.toFixed(2)} source=${input.nlp.source}`,
      ...(input.nlp.entities.budget ? [`NLP budget: ${input.nlp.entities.budget}`] : []),
      ...(input.nlp.entities.timeline ? [`NLP timeline: ${input.nlp.entities.timeline}`] : []),
      ...(input.attributionSummary ? [`Attribution: ${input.attributionSummary}`] : []),
    ];
    await createContactNote(contactId, noteLines.join("\n"));
  }
  if (input.lead.band !== "hot") return;
  const dealId = await createDeal({
    dealname: `Lead – ${String(input.name).slice(0, 80)} (${input.service || "General"})`,
    dealstage: "qualifiedtobuy",
    lead_source: "contact_form",
    description: input.messageText.slice(0, 500),
    service_interest: input.serviceSlug,
  });
  if (dealId && contactId) {
    await associateDealWithContact(dealId, contactId);
  }
}

export async function GET() {
  return Response.json({ error: "POST only" }, { status: 405 });
}

export async function POST(request: Request) {
  console.warn(`[Contact API] NODE_ENV: ${process.env.NODE_ENV}`);
  const ip = getClientIp(request);
  const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }

  try {
    const fields = validateContactFields(parsed);
    if (fields instanceof Response) return fields;

    const { name, email, company, service, message, phone, attribution, turnstileToken } = fields;
    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return jsonError(turnstile.error, 403);
    }

    const messageText = message;
    const config = await getConfig();

    const serviceSlug = service ? (SERVICE_SLUG[service] ?? undefined) : undefined;
    const nameParts = String(name).trim().split(" ");
    let attributionData: LeadAttribution | undefined;
    if (attribution) {
      try {
        // Accept both a JSON string and a pre-parsed object (some clients send
        // attribution as an object instead of a stringified JSON value).
        attributionData =
          typeof attribution === "string"
            ? (JSON.parse(attribution) as LeadAttribution)
            : (attribution as LeadAttribution);
      } catch {
        attributionData = undefined;
      }
    }
    const bodyLocale = typeof fields.locale === "string" ? fields.locale : undefined;
    const pageLocale =
      bodyLocale || localeFromReferer(request.headers.get("referer") ?? "") || "en";

    let nlp: LeadNlpResult;
    try {
      nlp = await analyzeLeadMessage({ message: messageText, service, pageLocale });
    } catch {
      nlp = fallbackNlp(pageLocale);
    }
    const lead = scoreLead({
      email,
      service,
      company,
      message: messageText,
      attribution: attributionData,
      nlp,
    });
    const attributionSummary = attributionData ? formatAttribution(attributionData) : undefined;

    // All downstream services run fire-and-forget so a single integration
    // outage (email, Slack, CRM, etc.) never blocks the others or the
    // customer-facing response. Each task logs its own failure.
    Promise.allSettled([
      // 1. Admin email notification
      sendContactAdminEmail({
        name,
        email,
        phone,
        company,
        service,
        messageText,
        to: config.SES_TO_EMAIL,
      }).then((emailFail) => {
        if (emailFail) {
          console.warn("[Contact] Admin email returned:", emailFail.status);
        }
      }),
      // 2. Customer acknowledgment email
      sendContactAcknowledgment({ name, email, service }),
      // 3. Slack real-time notification
      slackContactNotify({
        name,
        email,
        phone,
        company,
        service,
        message: messageText,
        leadScore: lead.score,
        leadBand: `${bandEmoji(lead.band)} ${lead.band}`,
        attributionSummary,
        nlpIntent: nlp.intent,
        nlpLocale: nlp.locale,
      }),
      // 4. Admin notifications dashboard
      recordNotification({
        category: "contact",
        type: "info",
        title: `New contact: ${String(name)}`,
        message: messageText.slice(0, 500),
        actor: String(email),
        route: "/api/contact",
        metadata: {
          company: company || null,
          service: service || null,
          leadScore: lead.score,
          leadBand: lead.band,
          nlpIntent: nlp.intent,
          nlpLocale: nlp.locale,
        },
      }),
      // 5. EspoCRM — upsert contact + note + deal (if hot lead)
      syncEspoForInbound({
        email,
        name,
        nameParts,
        company,
        phone,
        service,
        serviceSlug,
        messageText,
        lead,
        nlp,
        attributionSummary,
      }),
      // 6. AppFlowy form submission persistence
      saveSubmission({
        name,
        email,
        phone,
        company,
        service,
        message: messageText,
        source: "contact",
      }),
      // 7. ActiveCampaign — enroll in lead follow-up automation
      enrollLeadInAutomation({
        email,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || undefined,
      }),
    ])
      .then((results) => {
        const labels = [
          "admin_email",
          "customer_email",
          "slack",
          "notifications",
          "espocrm",
          "appflowy",
          "activecampaign",
        ];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error("[Contact] Background task " + labels[i] + " failed:", r.reason);
          }
        });
      })
      .catch((err) => {
        console.error("[Contact] Background allSettled error:", err);
      });

    trackEvent({
      event: "contact_submit",
      path: "/contact",
      metadata: { source: service ?? "website_contact_form" },
    }).catch(() => {});

    const eventId = generateEventId("lead");
    const { fbp, fbc } = readMetaClickIds(request.headers.get("cookie") ?? "");
    sendLeadEvent({
      eventId,
      email,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || undefined,
      clientIpAddress: ip === "unknown" ? undefined : ip,
      clientUserAgent: request.headers.get("user-agent") ?? undefined,
      fbp,
      fbc,
      eventSourceUrl: "https://cloudless.gr/contact",
      source: service ?? attributionData?.utmSource ?? undefined,
    }).catch(() => {});

    return Response.json({ success: true, eventId });
  } catch (error) {
    const mapped = mapIntegrationError(error);
    if (mapped) return mapped;
    console.error("Contact error:", error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "contact");
            captureException(error);
          })
        )
        .catch(() => {});
    }
    return jsonError("Failed to process contact form.", 500);
  }
}
