import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { isPostizConfigured, listIntegrations, PostizApiError } from "@/lib/postiz";
import { notifyOauthExpiry } from "@/lib/postiz-slack";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/postiz-oauth-check — alert on disabled channels.
 *
 * Postiz flips `disabled: true` on an integration when its OAuth token has
 * expired or been revoked by the upstream provider. That's the highest-value
 * silent failure for a self-hosted social tool: scheduled posts will queue
 * up but never publish until a human re-authorizes.
 *
 * The cron lists integrations and pages a Slack alert for every channel
 * currently `disabled`. Recommend running once an hour — the channel doesn't
 * spontaneously re-enable, so spamming every 15 min adds no signal.
 *
 * (Idempotency: this currently re-alerts on every run for any disabled
 * channel. If the noise becomes a problem, add a per-channel "last alerted"
 * marker in a small KV. For now: a disabled channel is loud on purpose.)
 */
export async function GET(request: NextRequest) {
  if (!(await isCronAuthorized(request))) return cronUnauthorized();

  if (!(await isPostizConfigured())) {
    return NextResponse.json({ ok: false, reason: "postiz_not_configured" }, { status: 503 });
  }

  let integrations;
  try {
    integrations = await listIntegrations();
  } catch (e) {
    const status = e instanceof PostizApiError ? e.status : 0;
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[postiz-oauth-check] listIntegrations failed:", msg);
    return NextResponse.json(
      { ok: false, reason: "postiz_upstream_error", detail: msg, upstreamStatus: status },
      { status: 502 }
    );
  }

  const disabled = integrations.filter((i) => i.disabled);

  await Promise.all(
    disabled.map((integration) =>
      notifyOauthExpiry(integration).catch((e) => console.error("[postiz-oauth-check] slack:", e))
    )
  );

  return NextResponse.json({
    ok: true,
    total: integrations.length,
    disabled: disabled.length,
    notified: disabled.map((i) => ({ id: i.id, name: i.name, identifier: i.identifier })),
  });
}
