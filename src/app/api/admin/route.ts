import { type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// Base admin API endpoint.
// The test suite expects unauthenticated requests to be rejected with
// 401/403/404 (not an HTML fallback page).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return Response.json({ ok: true });
}

