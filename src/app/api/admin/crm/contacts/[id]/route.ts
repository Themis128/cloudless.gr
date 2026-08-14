import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { isConfiguredAsync } from "@/lib/integrations";
import { mapIntegrationError } from "@/lib/api-errors";
import { getContact360, isEspoRecordId } from "@/lib/crm-contact-360";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  if (!(await isConfiguredAsync("ESPOCRM_API_KEY"))) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  const { id } = await params;
  if (!isEspoRecordId(id)) {
    return NextResponse.json({ error: "Invalid contact id." }, { status: 400 });
  }

  try {
    const payload = await getContact360(id);
    if (!payload) {
      return NextResponse.json({ error: "Contact not found." }, { status: 404 });
    }
    return NextResponse.json(payload);
  } catch (err) {
    const mapped = mapIntegrationError(err);
    if (mapped) return mapped;
    console.error("[EspoCRM] Error loading contact 360:", err);
    return NextResponse.json({ error: "Failed to fetch contact." }, { status: 500 });
  }
}
