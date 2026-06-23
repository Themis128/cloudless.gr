import { reindexProductsWithEmbeddings } from "@/lib/product-search";
import { getConfig } from "@/lib/ssm-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cfg = await getConfig();
  const expected = cfg.CRON_SECRET || process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret") || request.headers.get("x-admin-secret");

  if (!expected || provided !== expected) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await reindexProductsWithEmbeddings();

  return Response.json({
    ok: true,
    ...result,
  });
}
