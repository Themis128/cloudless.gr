import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

// Marketing Emails API requires the 'content' scope which is not granted
// on this private app token. Return a clear 501 so the UI can surface it.
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      error:
        "Marketing Emails API requires 'content' scope — not available on current HubSpot private app token.",
    },
    { status: 501 },
  );
}
