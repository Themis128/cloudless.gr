import { NextRequest, NextResponse } from "next/server";
import { isConfigured } from "@/lib/integrations";
import { requireAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/consultations
 * Returns booked consultations for the authenticated user from Google Calendar.
 * 
 * Requires: Authorization: Bearer <JWT token>
 */
export async function GET(req: NextRequest) {
  // Verify JWT authentication
  const auth = requireAuth(req);
  if (!auth.ok) return auth.response;

  const email = auth.user.email;
  if (!email) {
    return NextResponse.json({ error: "No email in token" }, { status: 400 });
  }

  if (
    !isConfigured(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "GOOGLE_PRIVATE_KEY",
      "GOOGLE_CALENDAR_ID",
    )
  ) {
    // Calendar not configured — return empty list, not an error
    return NextResponse.json({ consultations: [], configured: false });
  }

  try {
    // Dynamic import to avoid loading google-calendar if not needed
    const { getConsultationsByEmail } = await import("@/lib/google-calendar");
    const consultations = await getConsultationsByEmail(email);
    return NextResponse.json({ consultations, configured: true });
  } catch (err) {
    console.error("Failed to fetch consultations:", err);
    return NextResponse.json({ error: "Failed to fetch consultations" }, { status: 500 });
  }
}
