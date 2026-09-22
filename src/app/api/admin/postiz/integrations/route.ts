import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { listAccountsAsIntegrations, saErrorToResponse } from "@/lib/socialauto";

export const dynamic = "force-dynamic";

/** Connected channels — backed by SocialAuto `/accounts` (the real source of
 *  truth), mapped to the integration shape the admin UI renders. */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const integrations = await listAccountsAsIntegrations();
    return NextResponse.json({ integrations });
  } catch (err) {
    return saErrorToResponse(err);
  }
}
