import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listGroups, PostizApiError, PostizNotConfiguredError } from "@/lib/postiz";

export const dynamic = "force-dynamic";

/** GET /api/admin/postiz/groups — list customer (group) tags from Postiz. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const groups = await listGroups();
    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof PostizNotConfiguredError) {
      return NextResponse.json({ error: "postiz_not_configured" }, { status: 503 });
    }
    if (err instanceof PostizApiError) {
      // Surface the upstream URL + a status-specific hint so the operator can
      // act without leaving /admin/workspaces — the integrations dashboard
      // ping for Postiz uses the same logic.
      const hint =
        err.status >= 500
          ? "Postiz pod likely down or restarting. Check the k3s deployment in the postiz namespace."
          : err.status === 401 || err.status === 403
            ? "Postiz API key rejected. Regenerate from Postiz → Settings → Public API and update POSTIZ_API_KEY in SSM."
            : "Postiz returned a non-2xx — see body above.";
      return NextResponse.json(
        {
          error: "postiz_upstream",
          status: err.status,
          body: err.body,
          troubleshootUrl: "https://postiz.cloudless.gr",
          hint,
        },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: "postiz_unreachable" }, { status: 404 });
  }
}
