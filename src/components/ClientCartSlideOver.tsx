"use client";

import dynamic from "next/dynamic";

// CartSlideOver cannot be imported with ssr:false directly from the locale layout
// (a Server Component), so the ssr:false boundary lives in this client wrapper.
// Rendering it server-side surfaces React #418 in prod (Lambda) because the
// dynamic() Suspense boundary in the server component diverges from the client
// tree during hydration — see e2e/k3s/assets.spec.ts "no fatal page errors on
// homepage load". The cart is always closed on load so there is no visual impact.
const CartSlideOver = dynamic(() => import("@/components/store/CartSlideOver"), {
  ssr: false,
  loading: () => null,
});

export default function ClientCartSlideOver() {
  return <CartSlideOver />;
}
