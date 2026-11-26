export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import type { Metadata } from "next";

const TALK_CALL_BASE = "https://cloud.cloudless.gr/call";
// Talk room tokens are [a-z0-9]{4,30}; anything else is not a room.
const TOKEN_RE = /^[a-z0-9]{4,30}$/;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Join the call — Cloudless",
    description: "Forwarding you to the Nextcloud Talk call.",
    robots: { index: false, follow: false },
  };
}

export default async function CallRedirectPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  if (TOKEN_RE.test(token)) {
    redirect(`${TALK_CALL_BASE}/${token}`);
  }
  redirect(`/${locale}/consultation`);
}
