import { escapeHtml } from "@/lib/escape-html";
import { isValidEmail } from "@/lib/validation";
import { sendEmail } from "@/lib/email";
import { getConfig } from "@/lib/ssm-config";
import { slackContactNotify } from "@/lib/slack-notify";
import {
  upsertContact,
  createDeal,
  associateDealWithContact,
  createContactNote,
} from "@/lib/hubspot";
import { saveSubmission } from "@/lib/notion-forms";
import { trackEvent } from "@/lib/notion-analytics";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sendLeadEvent } from "@/lib/meta-capi";
import { generateEventId } from "@/lib/meta-pixel";

export async function POST(request: Request) {
  // Rate limit: 5 contact submissions per IP per 10 minutes
  const ip = getClientIp(request);
  const rl = rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!rl.ok) return rl.response;

  try {
    const { name, email, company, service, message } = await request.json();

    if (!name || !email || !message) {
      return Response.json(
        { error: "Name, email, and message are required." },
        { status: 400 },
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Invalid email address." },
        { status: 400 },
      );
    }

    const config = await getConfig();

    const subject = `[Contact] ${String(service || "General inquiry").slice(0, 100)} — ${String(name).slice(0, 100)}`;

    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company:</strong> ${escapeHtml(company || "—")}</p>
      <p><strong>Service:</strong> ${escapeHtml(service || "—")}</p>
      <hr />
      <p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>
    `;

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
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

    // Map form display strings to HubSpot service_interest dropdown values
    const SERVICE_SLUG: Record<string, string> = {
      "Cloud Architecture & Migration": "cloud-architecture",
      "Serverless Development": "serverless",
      "Data Analytics & Dashboards": "analytics",
      "AI & Digital Marketing": "digital-marketing",
      "Full-Stack Growth Engine (Bundle)": "full-bundle",
    };
    const serviceSlug = service ? (SERVICE_SLUG[service] ?? undefined) : undefined;

    const nameParts = String(name).trim().split(" ");
    Promise.allSettled([
      slackContactNotify({ name, email, company, service, message }),
      (async () => {
        const contactId = await upsertContact({
          email,
          firstname: nameParts[0] ?? "",
          lastname: nameParts.slice(1).join(" "),
          company: company || undefined,
          service_interest: serviceSlug,
          message: String(message).slice(0, 500),
        });
        if (contactId) {
          const noteLines = [
            `Service interest: ${service || "General inquiry"}`,
            `Message: ${String(message).slice(0, 500)}`,
            ...(company ? [`Company: ${company}`] : []),
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
        company,
        service,
        message,
        source: "contact",
      }),
    ])
      .then((results) => {
        const labels = ["slack", "hubspot", "notion"];
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            console.error(
              "[Contact] Background task " + labels[i] + " failed:",
              r.reason,
            );
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

    // Meta CAPI — Lead event. eventId is shared with the browser pixel for dedup.
    // Short-circuits if NEXT_PUBLIC_META_PIXEL_ID / META_CAPI_ACCESS_TOKEN are unset.
    const eventId = generateEventId("lead");
    const userAgent = request.headers.get("user-agent") ?? undefined;
    const fbp = request.headers.get("cookie")?.match(/_fbp=([^;]+)/)?.[1];
    const fbc = request.headers.get("cookie")?.match(/_fbc=([^;]+)/)?.[1];
    void sendLeadEvent({
      eventId,
      email,
      firstName: nameParts[0],
      lastName: nameParts.slice(1).join(" ") || undefined,
      clientIpAddress: ip !== "unknown" ? ip : undefined,
      clientUserAgent: userAgent,
      fbp,
      fbc,
      eventSourceUrl: "https://cloudless.gr/contact",
      source: service ?? undefined,
    });

    return Response.json({ success: true, eventId });
  } catch (error) {
    console.error("SES send error:", error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs")
        .then(({ captureException, withScope }) =>
          withScope((scope) => {
            scope.setTag("route", "contact");
            captureException(error);
          }),
        )
        .catch(() => {});
    }
    return Response.json({ error: "Failed to send email." }, { status: 500 });
  }
}
