import { redirectLegacyNotionPage } from "../redirect-legacy";

/** Legacy /admin/notion/analytics → AppFlowy analytics. */
export default async function LegacyNotionAnalyticsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy/analytics");
}
