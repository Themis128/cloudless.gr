import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side mirror of the LinkedIn Insight-Tag conversion fired from
 * `/[locale]/campaigns/<slug>/thanks`. This route forwards the same
 * conversion event to LinkedIn's Conversions API (CAPI).
 *
 * LinkedIn deduplicates events that arrive via both Insight Tag and CAPI as
 * long as the `eventId` field matches — see docs/linkedin-campaigns.md for
 * the full payload spec and the env vars this route reads.
 *
 * When `LINKEDIN_CAPI_ACCESS_TOKEN` is unset the route is a deliberate no-op
 * (returns 204) so client-side conversion still works end-to-end without any
 * server credentials. This matches how `getStripe()` behaves in
 * `/api/checkout` when Stripe is unconfigured.
 */

type Body = {
  campaign?: string;
  tier?: string | null;
  orderId?: string | null;
  conversionId?: number | null;
  url?: string | null;
  userAgent?: string | null;
};

const LINKEDIN_CAPI_ENDPOINT = "https://api.linkedin.com/rest/conversionEvents";

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = process.env.LINKEDIN_CAPI_ACCESS_TOKEN;
  if (!token) {
    // CAPI not configured — client-side Insight Tag already fired, this is fine.
    return new NextResponse(null, { status: 204 });
  }

  const { conversionId, orderId, url, userAgent } = body;
  if (conversionId == null) {
    return NextResponse.json({ error: "Missing conversionId" }, { status: 400 });
  }

  // Stable per-conversion identifier — LinkedIn uses it for dedup against the
  // browser-side Insight Tag hit.
  const eventId = orderId ?? `conv-${conversionId}-${Date.now()}`;

  const payload = {
    conversion: `urn:lla:llaPartnerConversion:${conversionId}`,
    conversionHappenedAt: Date.now(),
    eventId,
    user: {
      userIds: [],
      userInfo: undefined,
    },
    conversionValue: undefined,
    requestMetadata: {
      userAgent: userAgent ?? undefined,
      acceptLanguage: request.headers.get("accept-language") ?? undefined,
      pageUrl: url ?? undefined,
    },
  };

  try {
    const res = await fetch(LINKEDIN_CAPI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202506",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Don't leak the raw upstream body to the caller — it can include the
      // CAPI access token in error messages.
      console.error(
        "LinkedIn CAPI error " + res.status + ": " + text.slice(0, 200).replace(/[\x00-\x1f\x7f]/g, " ")
      );
      return NextResponse.json({ ok: false }, { status: 502 });
    }
  } catch (err) {
    console.error(
      "LinkedIn CAPI fetch failed: " +
        ((err as Error).message ?? "unknown").slice(0, 200)
    );
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
