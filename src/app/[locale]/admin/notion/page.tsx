import { redirect } from "@/i18n/navigation";

/** Legacy /admin/notion → AppFlowy submissions. */
export default function LegacyNotionIndexPage() {
  redirect("/admin/appflowy");
}
