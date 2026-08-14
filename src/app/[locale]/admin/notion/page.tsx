import { redirectLegacyNotionPage } from "./redirect-legacy";

/** Legacy /admin/notion → AppFlowy CMS. */
export default async function LegacyNotionIndexPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy");
}
