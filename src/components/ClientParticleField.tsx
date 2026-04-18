"use client";

import dynamic from "next/dynamic";

const ParticleField = dynamic(() => import("@/components/ParticleField"), {
  ssr: false,
  loading: () => null,
});

export default function ClientParticleField() {
  return <ParticleField />;
}
