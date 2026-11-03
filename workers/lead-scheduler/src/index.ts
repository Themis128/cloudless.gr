/**
 * lead-scheduler — Durable Objects for funnel timing + consistency.
 *
 *  LeadFollowup : per-lead quiet-follow-up cadence — enroll → alarm at
 *                 +24h → dispatch → +3d → dispatch → +7d → dispatch → done.
 *                 The manifest's quiet-lead sequence, serverless. Sweep in
 *                 SocialAuto stays the Postgres-authoritative fallback.
 *  BookingSlot  : atomic slot holds for the /audit booking flow —
 *                 hold() succeeds exactly once per slot until released.
 *  WebhookDedup : TTL seen-cache for inbound webhooks (Meta leads,
 *                 Slack events, Stripe) — firstSeen:true only once.
 */

import { DurableObject } from "cloudflare:workers";

interface Env {
	LEAD_FOLLOWUP: DurableObjectNamespace<LeadFollowup>;
	BOOKING_SLOT: DurableObjectNamespace<BookingSlot>;
	WEBHOOK_DEDUP: DurableObjectNamespace<WebhookDedup>;
	SCHEDULER_TOKEN: string;
	DISPATCH_URL?: string; // e.g. https://mail-outbound.<acct>.workers.dev/send
	DISPATCH_TOKEN?: string;
	STEP_DELAYS_HOURS?: string; // "24,72,168"
	STEP_SUBJECTS?: string; // pipe-separated per step
}

const DEFAULT_DELAYS = [24, 72, 168]; // 24h nudge, 3d pain, 7d clean break
const DEFAULT_SUBJECTS = [
	"Quick question about your free tech checkup",
	"Still fighting slow tools or high software bills?",
	"Last note — closing your file",
];

type LeadState = {
	email: string;
	name?: string;
	step: number; // next step index to send
	startedAt: number;
	done?: boolean;
};

export class LeadFollowup extends DurableObject<Env> {
	private state(): DurableObjectState {
		return this.ctx as DurableObjectState;
	}

	private delays(): number[] {
		return (this.env.STEP_DELAYS_HOURS ?? "")
			.split(",")
			.map((s) => Number(s.trim()))
			.filter((n) => Number.isFinite(n) && n > 0)
			.concat(DEFAULT_DELAYS)
			.slice(0, 3);
	}

	async enroll(lead: { email: string; name?: string }): Promise<Response> {
		const existing = await this.ctx.storage.get<LeadState>("lead");
		if (existing?.done) return Response.json({ ok: false, reason: "sequence-finished" });
		const st: LeadState = existing ?? { ...lead, step: 0, startedAt: Date.now() };
		await this.ctx.storage.put("lead", st);
		await this.ctx.storage.setAlarm(Date.now() + this.delays()[st.step] * 3600_000);
		return Response.json({ ok: true, step: st.step, nextInHours: this.delays()[st.step] });
	}

	async unsubscribe(): Promise<Response> {
		const st = await this.ctx.storage.get<LeadState>("lead");
		if (st) await this.ctx.storage.put("lead", { ...st, done: true });
		await this.ctx.storage.deleteAlarm();
		return Response.json({ ok: true });
	}

	async status(): Promise<Response> {
		const st = await this.ctx.storage.get<LeadState>("lead");
		return Response.json({ lead: st ?? null, alarm: await this.ctx.storage.getAlarm() });
	}

	async alarm(): Promise<void> {
		const st = await this.ctx.storage.get<LeadState>("lead");
		if (!st || st.done) return;
		const subjects = (this.env.STEP_SUBJECTS ?? "").split("|").filter(Boolean);
		const subject = subjects[st.step] ?? DEFAULT_SUBJECTS[st.step] ?? `Follow-up ${st.step + 1}`;
		if (this.env.DISPATCH_URL) {
			await fetch(this.env.DISPATCH_URL, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${this.env.DISPATCH_TOKEN ?? ""}`,
				},
				body: JSON.stringify({
					to: st.email,
					subject,
					text: `Hi ${st.name ?? "there"},\n\n— Cloudless`,
					category: "quiet-lead",
				}),
			});
		}
		const next = st.step + 1;
		if (next >= this.delays().length) {
			await this.ctx.storage.put("lead", { ...st, step: next, done: true });
			return;
		}
		await this.ctx.storage.put("lead", { ...st, step: next });
		await this.ctx.storage.setAlarm(Date.now() + this.delays()[next] * 3600_000);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const body = request.method === "POST" ? ((await request.json().catch(() => ({}))) as { email?: string; name?: string }) : {};
		if (url.pathname === "/enroll") return this.enroll({ email: body.email ?? "", name: body.name });
		if (url.pathname === "/unsubscribe") return this.unsubscribe();
		if (url.pathname === "/status") return this.status();
		return Response.json({ error: "not_found" }, { status: 404 });
	}
}

export class BookingSlot extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/hold") {
			const slotId = url.searchParams.get("slot") ?? "";
			const ttl = Number(url.searchParams.get("ttl") ?? 900) * 1000;
			if (!slotId) return Response.json({ ok: false, error: "slot required" }, { status: 400 });
			const held = await this.ctx.storage.transaction(async () => {
				const cur = await this.ctx.storage.get<number>(slotId);
				if (cur && cur > Date.now()) return false;
				await this.ctx.storage.put(slotId, Date.now() + ttl);
				return true;
			});
			return Response.json({ ok: held });
		}
		if (url.pathname === "/release") {
			const slotId = url.searchParams.get("slot") ?? "";
			await this.ctx.storage.delete(slotId);
			return Response.json({ ok: true });
		}
		return Response.json({ error: "not_found" }, { status: 404 });
	}
}

export class WebhookDedup extends DurableObject<Env> {
	private static TTL = 7 * 24 * 3600_000;

	async fetch(request: Request): Promise<Response> {
		const body = (await request.json().catch(() => ({}))) as { eventId?: string };
		if (!body.eventId) return Response.json({ error: "eventId required" }, { status: 400 });
		const first = await this.ctx.storage.transaction(async () => {
			const cur = await this.ctx.storage.get<number>(body.eventId!);
			if (cur) return false;
			await this.ctx.storage.put(body.eventId!, Date.now() + WebhookDedup.TTL);
			return true;
		});
		return Response.json({ firstSeen: first });
	}
}

function authorized(request: Request, env: Env): boolean {
	const auth = request.headers.get("authorization") ?? "";
	const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
	return Boolean(token) && token === env.SCHEDULER_TOKEN;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		if (request.method === "GET" && url.pathname === "/health") {
			return Response.json({ ok: true, service: "lead-scheduler" });
		}
		if (!authorized(request, env)) {
			return Response.json({ error: "unauthorized" }, { status: 401 });
		}
		// /do/<kind>/<id>/<action>  kind: followup | slot | dedup
		const m = url.pathname.match(/^\/do\/(followup|slot|dedup)\/([^/]+)(\/.*)?$/);
		if (!m) return Response.json({ error: "not_found" }, { status: 404 });
		const [, kind, id, action = ""] = m;
		const stub =
			kind === "followup"
				? env.LEAD_FOLLOWUP.get(env.LEAD_FOLLOWUP.idFromName(id))
				: kind === "slot"
					? env.BOOKING_SLOT.get(env.BOOKING_SLOT.idFromName(id))
					: env.WEBHOOK_DEDUP.get(env.WEBHOOK_DEDUP.idFromName(id));
		const forward = new URL(url.origin + action + url.search);
		return stub.fetch(new Request(forward.toString(), request));
	},
};
