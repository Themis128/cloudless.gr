import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion/status → AppFlowy CMS status. */
export default function LegacyNotionStatusPage() {
  redirect("/admin/appflowy/status");
}
