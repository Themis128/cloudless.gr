import { redirectLegacyNotionPage } from "../redirect-legacy";

/** Legacy /admin/notion/projects → AppFlowy projects. */
export default async function LegacyNotionProjectsPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy/projects");
}
