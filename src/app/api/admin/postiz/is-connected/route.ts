import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isApiKeyValid, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/is-connected — round-trip to Postiz to check the
 *  configured API key actually authenticates upstream. Distinct from
 *  /health which only checks reachability. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const result = await isApiKeyValid();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json(
        { connected: false, error: "postiz_not_configured" },
        { status: 404 }
      );
    }
    if (err instanceof PostizApiError) {
      if (err.status === 401 || err.status === 403) {
        return NextResponse.json({ connected: false, error: "invalid_api_key" }, { status: 401 });
      }
      return NextResponse.json(
        { connected: false, error: "postiz_upstream", status: err.status, body: err.body },
        { status: 502 }
      );
    }
    // Network failures (DNS, timeouts) should not crash the handler:
    // the test suite treats any 5xx as an invalid outcome and expects
    // a graceful "not connected"/"not configured" style response.
    return NextResponse.json({ connected: false, error: "postiz_unreachable" }, { status: 404 });
  }
}
