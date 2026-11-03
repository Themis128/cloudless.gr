/**
 * mail-outbound — transactional funnel email via the send_email binding.
 *
 * Phases the Cloudflare paid Email Sending feature into the stack:
 *   POST /send   — send one transactional message (Bearer-authed)
 *   POST /verify — send a self-test to the verification inbox
 *   GET  /health — liveness
 *
 * Categories are allowlisted to keep this worker transactional-only;
 * bulk marketing stays on ActiveCampaign/ESP. SocialAuto's SMTP path
 * (omv-ha/Resend) remains the fallback transport — this worker is the
 * Cloudflare-first primary behind the CF_EMAIL_ENABLED gate.
 */

import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

interface Env {
	SEND_EMAIL: SendEmail;
	MAIL_OUTBOUND_TOKEN: string;
	DEFAULT_FROM?: string;
	VERIFY_TO?: string;
}

const CATEGORIES = new Set([
	"audit-confirm",
	"nurture",
	"quiet-lead",
	"loa-delivery",
	"playbook",
	"ops-alert",
]);

const DEFAULT_FROM = "Cloudless <no-reply@cloudless.gr>";

function json(data: unknown, status = 200): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function authorized(request: Request, env: Env): boolean {
	const auth = request.headers.get("authorization") ?? "";
	const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
	return Boolean(token) && token === env.MAIL_OUTBOUND_TOKEN;
}

type SendBody = {
	to?: string;
	subject?: string;
	text?: string;
	html?: string;
	from?: string;
	category?: string;
	replyTo?: string;
};

async function deliver(env: Env, b: Required<Pick<SendBody, "to" | "subject">> & SendBody) {
	const msg = createMimeMessage();
	msg.setSender({ name: "Cloudless", addr: b.from ?? env.DEFAULT_FROM ?? DEFAULT_FROM });
	msg.setRecipient(b.to);
	msg.setSubject(b.subject);
	if (b.replyTo) msg.setHeader("Reply-To", b.replyTo);
	msg.addMessage({ contentType: "text/plain", data: b.text ?? "" });
	if (b.html) msg.addMessage({ contentType: "text/html", data: b.html });
	const raw = new EmailMessage(b.from ?? env.DEFAULT_FROM ?? DEFAULT_FROM, b.to, msg.asRaw());
	await env.SEND_EMAIL.send(raw);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/health") {
			return json({ ok: true, service: "mail-outbound" });
		}
		if (!authorized(request, env)) {
			return json({ error: "unauthorized" }, 401);
		}

		if (request.method === "POST" && url.pathname === "/verify") {
			try {
				await deliver(env, {
					to: env.VERIFY_TO ?? "tbaltzakis@cloudless.gr",
					subject: "mail-outbound self-test",
					text: `send_email binding OK — ${new Date().toISOString()}`,
					category: "ops-alert",
				});
				return json({ ok: true, sent: true });
			} catch (err) {
				return json({ ok: false, error: String(err) }, 502);
			}
		}

		if (request.method === "POST" && url.pathname === "/send") {
			let body: SendBody;
			try {
				body = (await request.json()) as SendBody;
			} catch {
				return json({ error: "invalid_json" }, 400);
			}
			if (!body.to || !body.subject || (!body.text && !body.html)) {
				return json({ error: "to, subject and text|html are required" }, 400);
			}
			const category = body.category ?? "ops-alert";
			if (!CATEGORIES.has(category)) {
				return json({ error: `category must be one of: ${[...CATEGORIES].join(", ")}` }, 400);
			}
			try {
				await deliver(env, { ...body, to: body.to, subject: body.subject });
				return json({ ok: true, category });
			} catch (err) {
				return json({ ok: false, error: String(err) }, 502);
			}
		}

		return json({ error: "not_found" }, 404);
	},
};
