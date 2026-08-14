import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion/projects → AppFlowy projects. */
export default function LegacyNotionProjectsPage() {
  redirect("/admin/appflowy/projects");
}
