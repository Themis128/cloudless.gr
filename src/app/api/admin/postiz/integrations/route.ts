import { NextResponse } from "next/server";
import { listAccountsAsIntegrations, saAdminRoute } from "@/lib/socialauto";

export const dynamic = "force-dynamic";

/** Connected channels — backed by SocialAuto `/accounts` (the real source of
 *  truth), mapped to the integration shape the admin UI renders. */
export const GET = saAdminRoute(async () => {
  const integrations = await listAccountsAsIntegrations();
  return NextResponse.json({ integrations });
});
