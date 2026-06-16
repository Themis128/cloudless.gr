import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSupportedLocale } from "@/lib/i18n";

// Post-login landing resolver. next-auth's callbackUrl is fixed at sign-in time
// (before the session exists), so we can't decide admin-vs-dashboard there. The
// Cognito sign-in sends users here; this reads the now-established session and
// routes admins to /admin, everyone else to /dashboard. Server-side → no flash.
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
  const session = await auth();

  if (!session?.user) {
    redirect(`/${locale}/auth/login`);
  }

  const groups = session.user.groups ?? [];
  const roles = session.user.roles ?? [];
  const isAdmin =
    groups.includes("admin") || roles.includes("admin") || roles.includes("realm:admin");

  redirect(`/${locale}${isAdmin ? "/admin" : "/dashboard"}`);
}
