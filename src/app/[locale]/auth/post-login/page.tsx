import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthDbFromEnv, getUserBySession, isAdmin as d1IsAdmin } from "@/lib/auth-d1";
import { isSupportedLocale } from "@/lib/i18n";

// Post-login landing resolver. Login sets an opaque D1 `session_token` cookie;
// this page (and proxy.ts) read that session and route admins → /admin,
// everyone else → /dashboard. Server-side → no flash.
export const dynamic = "force-dynamic";

export default async function PostLoginPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  const { locale: rawLocale } = await params;
  // Defence in depth: validate the locale segment before interpolating it
  // into a server-side redirect. Next's typed-routes catches this at build
  // time, but a hand-crafted URL like /x%2F..%2Fetc/auth/post-login should
  // still fall back to a safe default rather than producing a weird redirect.
  const locale = isSupportedLocale(rawLocale) ? rawLocale : "en";

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("session_token")?.value;
  if (!sessionId) {
    redirect(`/${locale}/auth/login`);
  }

  const db = getAuthDbFromEnv();
  if (!db) {
    redirect(`/${locale}/auth/login`);
  }

  const user = await getUserBySession(db, sessionId);
  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

  const admin = await d1IsAdmin(db, user.id);
  redirect(`/${locale}${admin ? "/admin" : "/dashboard"}`);
}
