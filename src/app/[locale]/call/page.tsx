export const dynamic = "force-dynamic";

import { redirect as nextRedirect } from "next/navigation";
import type { Metadata } from "next";
import { CONSULT_ROOM_TOKEN, TALK_CALL_BASE, callMetadata } from "./shared";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return callMetadata(locale);
}

export default async function CallPage() {
  nextRedirect(`${TALK_CALL_BASE}/${CONSULT_ROOM_TOKEN}`);
}
