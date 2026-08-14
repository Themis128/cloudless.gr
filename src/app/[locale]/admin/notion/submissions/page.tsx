import { redirectLegacyNotionPage } from "../redirect-legacy";

/** Legacy /admin/notion/submissions → AppFlowy submissions. */
export default async function LegacyNotionSubmissionsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy/submissions");
}
