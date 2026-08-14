import { redirect } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

const APPFLOWY_HOME = "/admin/appflowy";

const LEGACY_NOTION_SLUGS: Record<string, string> = {
  analytics: `${APPFLOWY_HOME}/analytics`,
  projects: `${APPFLOWY_HOME}/projects`,
  status: `${APPFLOWY_HOME}/status`,
  submissions: `${APPFLOWY_HOME}/submissions`,
  tasks: `${APPFLOWY_HOME}/tasks`,
};

function asLocale(value: string): Locale {
  return (routing.locales as readonly string[]).includes(value)
    ? (value as Locale)
    : routing.defaultLocale;
}

/** Leftover /admin/notion/* bookmarks → AppFlowy. */
export default async function LegacyNotionRedirectPage({
  params,
}: Readonly<{ params: Promise<{ locale: string; slug?: string[] }> }>) {
  const { locale, slug } = await params;
  const key = slug?.[0];
  const href = (key && LEGACY_NOTION_SLUGS[key]) || APPFLOWY_HOME;
  redirect({ href, locale: asLocale(locale) });
}
