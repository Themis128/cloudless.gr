import { redirectLegacyNotionPage } from "../redirect-legacy";

/** Legacy /admin/notion/tasks → AppFlowy tasks. */
export default async function LegacyNotionTasksPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  await redirectLegacyNotionPage(params, "/admin/appflowy/tasks");
}
