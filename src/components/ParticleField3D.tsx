"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

// Generate positions at module scope to avoid impure Math.random during render
function generatePositions(count: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
  }
  return positions;
}

const INITIAL_POSITIONS = generatePositions(200);

interface ParticleFieldProps {
  className?: string;
}

function ParticleSystem() {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = INITIAL_POSITIONS;

  // Animate particles with gentle floating motion using elapsed time from the clock
  useFrame(({ clock }) => {
    if (pointsRef.current) {
      const positions = pointsRef.current.geometry.attributes.position
        .array as Float32Array;
      const t = clock.elapsedTime;

      for (let i = 0; i < positions.length; i += 3) {
        // Use clock.elapsedTime instead of Date.now() to avoid repeated system calls
        positions[i] += Math.sin(t * 0.1 + i) * 0.002;
        positions[i + 1] += Math.cos(t * 0.15 + i) * 0.0015;
        positions[i + 2] += Math.sin(t * 0.12 + i) * 0.0018;
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <Points
      ref={pointsRef}
      positions={particles}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        color="#00fff5"
        size={0.08}
        sizeAttenuation
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  );
}

export default function ParticleField3D({
  className = "",
}: ParticleFieldProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 75 }}
        gl={{ alpha: true }}
        style={{ width: "100%", height: "100%" }}
      >
        <ParticleSys