import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isEspoCRMConfigured, listNewsletterSubscribers } from "@/lib/espocrm";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isEspoCRMConfigured())) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  const subscribers = await listNewsletterSubscribers();
  return NextResponse.json({
    totalSubscribers: subscribers.length,
    fetchedAt: new Date().toISOString(),
  });
}
