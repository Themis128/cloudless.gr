"use client";

import dynamic from "next/dynamic";

const LenisInitializer = dynamic(
  () => import("@/components/LenisInitializer"),
  { ssr: false },
);
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false,
});
const NeonCursor = dynamic(() => import("@/components/NeonCursor"), {
  ssr: false,
});
const KonamiEasterEgg = dynamic(() => import("@/components/KonamiEasterEgg"), {
  ssr: false,
});

export default function ClientDecorators() {
  return (
    <>
      <LenisInitializer />
      <CommandPalette />
      <NeonCursor />
      <KonamiEasterEgg />
    </>
  );
}
