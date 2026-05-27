"use client";

import dynamic from "next/dynamic";

// ChatWidget cannot be imported with ssr:false directly from the locale layout
// (a Server Component), so the ssr:false boundary lives in this client wrapper.
// Rendering it server-side surfaces React #418 in prod (Lambda) because the
// SSR shell occasionally diverges from the client tree on hydration — see
// e2e/k3s/assets.spec.ts "no fatal page errors on homepage load".
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
  loading: () => null,
});

export default function ClientChatWidget() {
  return <ChatWidget />;
}
