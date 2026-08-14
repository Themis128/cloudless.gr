import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion/tasks → AppFlowy tasks. */
export default function LegacyNotionTasksPage() {
  redirect("/admin/appflowy/tasks");
}
