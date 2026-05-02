"use client";

import dynamic from "next/dynamic";
import ThemePreferenceSync from "@/components/ThemePreferenceSync";

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
      <ThemePreferenceSync />
      <LenisInitializer />
      <CommandPalette />
      <NeonCursor />
      <KonamiEasterEgg />
    </>
  );
}
