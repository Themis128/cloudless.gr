import { redirectLegacyNotionPage } from "../redirect-legacy";

/** Legacy /admin/notion/status → AppFlowy CMS status. */
export default async function LegacyNotionStatusPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy/status");
}
