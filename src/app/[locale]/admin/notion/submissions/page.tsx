import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion/submissions → AppFlowy submissions. */
export default function LegacyNotionSubmissionsPage() {
  redirect("/admin/appflowy/submissions");
}
