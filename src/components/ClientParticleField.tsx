"use client";

import dynamic from "next/dynamic";

const ParticleField = dynamic(() => import("@/components/ParticleField"), {
  ssr: false,
  loading: () => null,
});

interface ClientParticleFieldProps {
  className?: string;
  particleCount?: number;
  color?: string;
  connectionDistance?: number;
}

export default function ClientParticleField(props: ClientParticleFieldProps) {
  return <ParticleField {...props} />;
}
