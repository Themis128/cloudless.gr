import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion/analytics → AppFlowy analytics. */
export default function LegacyNotionAnalyticsPage() {
  redirect("/admin/appflowy/analytics");
}
