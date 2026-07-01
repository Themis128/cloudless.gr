import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// Marketing Emails API requires the `content` scope, which is not granted
// on the current EspoCRM private-app token. We return a structured 501 so the
// /admin/email/campaigns page can render an actionable "Add scope" link
// instead of a bare status code.
//
// Fix path (operator action, ~3 minutes):
//   1. https://espocrm.cloudless.gr/#Email/list  → open the cloudless app
//   2. Scopes tab → add `content` (under Marketing)
//   3. Save → copy the regenerated token
//   4. aws ssm put-parameter --name /cloudless/production/ESPOCRM_API_KEY \
//        --type SecureString --overwrite --value <new-token>
//   5. Wait <=5min for Lambda SSM cache TTL or recycle the function
//
// The integrations dashboard (/admin/integrations) will also flip EspoCRM
// from "degraded — content scope missing" to "configured" automatically.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error: "Marketing Emails API requires the 'content' scope.",
      missingScope: "content",
      setupUrl: "https://espocrm.cloudless.gr/#Email/list",
      docsUrl: "https://docs.espocrm.com/",
      instructions:
        "Open the EspoCRM private-app, add the `content` scope under Marketing, save, then update ESPOCRM_API_KEY in SSM. The /admin/integrations dashboard pings this scope automatically.",
    },
    { status: 501 }
  );
}
