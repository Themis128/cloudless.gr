/**
 * GET /api/admin/campaigns/crm-leads
 *
 * For every live cloudless.gr campaign in `src/data/campaigns.ts`, return
 * the count of EspoCRM Leads attributed to that campaign. Attribution is
 * via `Lead.description` containing `Campaign: <slug>` — written by
 * `/api/campaigns/conversion` (the fire-and-forget createLead added in
 * PR #7).
 *
 * Used by `/admin/campaigns/linkedin` page to show "X leads in CRM"
 * next to each LinkedIn ad campaign.
 *
 * Returns 503 when EspoCRM is not configured (graceful — the LinkedIn page
 * just hides the CRM column).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getLiveCampaigns } from "@/data/campaigns";
import { countLeadsForCampaign, isEspoCRMConfigured } from "@/lib/espocrm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  if (!(await isEspoCRMConfigured())) {
    return NextResponse.json({ error: "EspoCRM not configured." }, { status: 503 });
  }

  const campaigns = getLiveCampaigns();
  // Parallel — at our scale (≤10 live campaigns) this is one round-trip
  // per slug. If counts grow, swap to a single GROUP BY-style query.
  const rollups = await Promise.all(
    campaigns.map(async (c) => ({
      slug: c.slug,
      leadCount: await countLeadsForCampaign(c.slug),
    }))
  );

  return NextResponse.json({
    rollups,
    total: rollups.reduce((sum, r) => sum + r.leadCount, 0),
    fetchedAt: new Date().toISOString(),
  });
}
