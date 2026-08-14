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
import { formatAttribution } from "@/lib/lead-attribution";
import { scoreLead, bandEmoji } from "@/lib/lead-scoring";
import { analyzeLeadMessage } from "@/lib/nlp";
import { enrollLeadInAutomation } from "@/lib/activecampaign";
import { verifyTurnstileToken } from "@/lib/turnstile";

interface ContactRequestBody {
  name: string;
  email: string;
  company?: string;
  service: string;
  message: string;
  phone?: string;
  attribution?: string;
  turnstileToken?: string;
}

export async function GET() {
  return Response.json({ error: "POST only" }, { status: 405 });
}

export async function POST(request: Request) {
  console.log(`[Contact API] NODE_ENV: ${process.env.NODE_ENV}`);
  // Rate limit: 5 contact submissions per IP per 10 minutes
  const ip = getClientIp(request);
  const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  // Parse the body in its own guard: a malformed JSON payload is a client
  // error (400), not a 500 — and must not be logged as a "SES send error"
  // or reported to Sentry as an exception (CLOUDLESS-GR-3).
  let parsed;
  try {
    parsed = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const { name, email, company, service, message, phone, attribution, turnstileToken } =
      parsed as ContactRequestBody;

    const turnstile = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstile.ok) {
      return Response.json({ error: turnstile.error }, { status: 403 });
    }

    // Strict types — coerce-and-continue lets arrays/numbers reach escapeHtml
    // and blow up with 500 (str.replace is not a function).
    if (typeof name !== "string" || typeof email !== "string" || typeof message !== "string") {
      return Response.json({ error: "Name, email, and message must be strings." }, { status: 400 });
    }

    if (!name.trim() || !email.trim() || message === "") {
      return Response.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
    }

    const MAX_MESSAGE_CHARS = 10_000;
    if (message.length > MAX_MESSAGE_CHARS) {
      return Response.json(
        { error: `Message must be at most ${MAX_MESSAGE_CHARS} characters.` },
        { status: 400 }
      );
    }

    const messageText = message;

    // Reject whitespace-only message to avoid sending empty emails
    if (!messageText.trim()) {
      return Response.json(
        { error: "Message cannot be empty or whitespace only." },
        { status: 400 }
      );
    }
    if (process.env.NODE_ENV === "test" && messageText.trim() === " ") {
      return Response.json(
        {
          error: "email.sending.error.email.sending_disabled",
          message: "Email sending is disabled in test environment",
        },
        { status: 400 }
      );
    }

    const config = await getConfig();

    const subject = `[Contact] ${String(service || "General inquiry").slice(0, 100)} — ${String(name).slice(0, 100)}`;

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || "—")}</p>
      <p><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
      <p><strong>Service:</strong> ${escapeHtml(service || "—")}</p>
      <hr />
      <p>${escapeHtml(messageText).replace(/\n/g, "<br />")}</p>
    `;

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "—"}`,
      `Company: ${company || "—"}`,
      `Service: ${service || "—"}`,
      ``,
      messageText,
    ].join("\n");

    try {
      // Skip email sending in test environment or when running E2E tests to avoid configuration issues
      if (process.env.NODE_ENV !== "test" && process.env.NEXT_PUBLIC_E2E !== "1") {
        await sendEmail({
          to: config.SES_TO_EMAIL,
          subject,
          html,
          text,
          replyTo: email,
          fromLabel: "Cloudless Contact Form",
        });
      } else {
        console.log("[Contact API] Test/E2E environment detected, skipping email sending");
      }
    } catch (emailErr) {
      const emailMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.log(`[Contact API] Email sending failed: ${emailMsg}`);
      if (emailMsg.toLowerCase().includes("not configured")) {
        return Response.json({ error: "Email service not configured." }, { status: 503 });
      }
      throw emailErr;
    }

    // Map form display strings to EspoCRM service_interest dropdown values
    const SERVICE_SLUG: Record<string, string> = {
      "Cloud Architecture & Migration": "cloud-architecture",
      "Serverless Development": "serverless",
      "Data Analytics & Dashboards": "analytics",
      "AI & Digital Marketing": "digital-marketing",
      "Full-Stack Growth Engine (Bundle)": "full-bundle",
    };
    const serviceSlug = service ? (SERVICE_SLUG[service] ?? undefined) : undefined;

    // Auto-reply to the visitor — fire-and-forget, never blocks response
    sendContactAcknowledgment({ name, email, service }).catch((err) =>
      console.warn("[contact] Auto-reply failed:", err)
    );

    const nameParts = String(name).trim().split(" ");

    // Lead engine: NLP enrichment (local / Workers AI) + deterministic score.
    const attributionData = attribution ? JSON.parse(attribution) : undefined;
    const bodyLocale =
      typeof (parsed as { locale?: unknown }).locale === "string"
        ? (parsed as { locale: string }).locale
        : undefined;
    const referer = request.headers.get("referer") ?? "";
    const refererLocale = referer.match(/\/(en|el|fr|de)(?:\/|$)/)?.[1];
    const pageLocale = bodyLocale || refererLocale || "en";

    let nlp;
    try {
      nlp = await analyzeLeadMessage({
        message: messageText,
        service,
        pageLocale,
      });
    } catch {
      nlp = {
        intent: "general_inquiry" as const,
        locale: (pageLocale === "el" ? "el" : "en") as "en" | "el",
        entities: {},
        confidence: 0,
        reasons: ["nlp threw — rules-only score"],
        source: "fallback" as const,
      };
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

    Promise.allSettled([
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
      (async () => {
        const contactId = await upsertContact({
          email,
          firstname: nameParts[0] ?? "",
          lastname: nameParts.slice(1).join(" "),
          company: company || undefined,
          phone: phone || undefined,
          service_interest: serviceSlug,
          message: messageText.slice(0, 500),
        });
        if (contactId) {
          const noteLines = [
            `Service interest: ${service || "General inquiry"}`,
            `Message: ${messageText.slice(0, 500)}`,
            ...(company ? [`Company: ${company}`] : []),
            `Lead score: ${lead.score}/100 (${lead.band}) — ${lead.reasons.join("; ")}`,
            `NLP: intent=${nlp.intent} locale=${nlp.locale} confidence=${nlp.confidence.toFixed(2)} source=${nlp.source}`,
            ...(nlp.entities.budget ? [`NLP budget: ${nlp.entities.budget}`] : []),
            ...(nlp.entities.timeline ? [`NLP timeline: ${nlp.entities.timeline}`] : []),
            ...(attributionSummary ? [`Attribution: ${attributionSummary}`] : []),
          ];
          await createContactNote(contactId, noteLines.join("\n"));
        }
        const dealId = await createDeal({
          dealname: `Lead – ${String(name).slice(0, 80)} (${service || "General"})`,
          dealstage: "qualifiedtobuy",
          lead_source: "contact_form",
          description: messageText.slice(0, 500),
          service_interest: serviceSlug,
        });
        if (dealId && contactId) {
          await associateDealWithContact(dealId, contactId);
        }
      })(),
      saveSubmission({
        name,
        email,
        phone,
        company,
        service,
        message: messageText,
        source: "contact",
      }),
      // Follow-up sequence — silent no-op when AC/automation ID unconfigured.
      enrollLeadInAutomation({
        email,
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(" ") || undefined,
      }),
    ])
      .then((results) => {
        const labels = ["slack", "espocrm", "appflowy", "activecampaign"];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error("[Contact] Background task " + labels[i] + " failed:", r.reason);
          }
        });
      })
      .catch((err) => {
        console.error("[Contact] Background allSettled error:", err);
      });

    // Track form submission (fire-and-forget)
    trackEvent({
      event: "contact_submit",
      path: "/contact",
      metadata: { source: service ?? "website_contact_form" },
    }).catch(() => {});

    // Meta CAPI — Lead event. Only read fbp/fbc marketing cookies when the
    // visitor has granted marketing consent (GDPR Art.6(1)(a)).
    const eventId = generateEventId("lead");
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const marketingConsented = (() => {
      try {
        const raw = cookieHeader.match(/cookieConsent=([^;]+)/)?.[1];
        return raw ? JSON.parse(decodeURIComponent(raw)).marketing === true : false;
      } catch {
        return false;
      }
    })();
    const fbp = marketingConsented ? cookieHeader.match(/_fbp=([^;]+)/)?.[1] : undefined;
    const fbc = marketingConsented ? cookieHeader.match(/_fbc=([^;]+)/)?.[1] : undefined;
    sendLeadEvent({
      eventId,
      email,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || undefined,
      clientIpAddress: ip === "unknown" ? undefined : ip,
      clientUserAgent: userAgent,
      fbp,
      fbc,
      eventSourceUrl: "https://cloudless.gr/contact",
      source: service ?? attributionData?.utmSource ?? undefined,
    }).catch(() => {});

    return Response.json({ success: true, eventId });
  } catch (error) {
    const _r = mapIntegrationError(error);
    if (_r) return _r;
    const msg = error instanceof Error ? error.message : String(error);
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
    if (msg.toLowerCase().includes("email") && msg.toLowerCase().includes("not configured")) {
      return Response.json({ error: "Email service not configured." }, { status: 503 });
    }
    return Response.json({ error: "Failed to send email." }, { status: 500 });
  }
}
