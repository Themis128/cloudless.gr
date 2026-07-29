import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// Email campaign editing is managed in EspoCRM's native UI.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error: "Email campaigns are managed directly in EspoCRM.",
      setupUrl: "https://espocrm.cloudless.gr",
      docsUrl: "https://docs.espocrm.com/user-guide/email-campaigns/",
      instructions:
        "Create and schedule campaigns in EspoCRM (Marketing > Campaigns). Keep ESPOCRM_API_KEY in SSM for API integrations.",
    },
    { status: 501 }
  );
}
