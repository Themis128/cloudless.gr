import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { sendEmail, sendContactAcknowledgment } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config";
import { slackContactNotify } from "@/lib/slack-notify";
import { recordNotification } from "@/lib/admin-notifications";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
  createContactNote,
} from "@/lib/espocrm";
import { saveSubmission } from "@/lib/notion-forms";
import { trackEvent } from "@/lib/notion-analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendLeadEvent } from "@/lib/meta-capi";
import { generateEventId } from "@/lib/meta-pixel";
import { mapIntegrationError } from "@/lib/api-errors";
import { sanitizeAttribution, formatAttribution } from "@/lib/lead-attribution";
import { scoreLead, bandEmoji } from "@/lib/lead-scoring";
import { enrollLeadInAutomation } from "@/lib/activecampaign";

export async function POST(request: Request) {
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
    const { name, email, company, service, message, phone } = parsed;
    const attribution = sanitizeAttribution(parsed.attribution);

    if (!name || !email || !message) {
      return Response.json({ error: "Name, email, and message are required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return Response.json({ error: "Invalid email address." }, { status: 400 });
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
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "—"}`,
      `Company: ${company || "—"}`,
      `Service: ${service || "—"}`,
      ``,
      message,
    ].join("\n");

    await sendEmail({
      to: config.SES_TO_EMAIL,
      subject,
      html,
      text,
      replyTo: [email],
      fromLabel: "Cloudless Contact Form",
    });

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

    // Lead engine: deterministic score + first-touch attribution summary.
    const lead = scoreLead({ email, service, company, message: String(message), attribution });
    const attributionSummary = attribution ? formatAttribution(attribution) : undefined;

    Promise.allSettled([
      slackContactNotify({
        name,
        email,
        phone,
        company,
        service,
        message,
        leadScore: lead.score,
        leadBand: `${bandEmoji(lead.band)} ${lead.band}`,
        attributionSummary,
      }),
      recordNotification({
        category: "contact",
        type: "info",
        title: `New contact: ${String(name)}`,
        message: String(message).slice(0, 500),
        actor: String(email),
        route: "/api/contact",
        metadata: {
          company: company || null,
          service: service || null,
          leadScore: lead.score,
          leadBand: lead.band,
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
          message: String(message).slice(0, 500),
        });
        if (contactId) {
          const noteLines = [
            `Service interest: ${service || "General inquiry"}`,
            `Message: ${String(message).slice(0, 500)}`,
            ...(company ? [`Company: ${company}`] : []),
            `Lead score: ${lead.score}/100 (${lead.band}) — ${lead.reasons.join("; ")}`,
            ...(attributionSummary ? [`Attribution: ${attributionSummary}`] : []),
          ];
          await createContactNote(contactId, noteLines.join("\n"));
        }
        const dealId = await createDeal({
          dealname: `Lead – ${String(name).slice(0, 80)} (${service || "General"})`,
          dealstage: "qualifiedtobuy",
          lead_source: "contact_form",
          description: String(message).slice(0, 500),
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
        message,
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
        const labels = ["slack", "hubspot", "notion", "activecampaign"];
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
      event: "contact_form_submit",
      type: "form_submit",
      page: "/contact",
      source: service ?? "website_contact_form",
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
      source: service ?? attribution?.utmSource ?? undefined,
    }).catch(() => {});

    return Response.json({ success: true, eventId });
  } catch (error) {
    const _r = mapIntegrationError(error);
    if (_r) return _r;
    console.error("SES send error:", error);
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
    return Response.json({ error: "Failed to send email." }, { status: 500 });
  }
}
