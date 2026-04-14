"use client";

import { type ReactNode, useRef, useState, useCallback } from "react";

interface HolographicCardProps {
  children: ReactNode;
  className?: string;
}

export default function HolographicCard({ children, className = "" }: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [glare, setGlare] = useState<React.CSSProperties>({});

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6;
    const rotateY = ((x - centerX) / centerX) * 6;

    setStyle({
      transform: `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`,
      transition: "transform 0.1s ease-out",
    });

    // Holographic glare overlay
    const angle = Math.atan2(y - centerY, x - centerX) * (180 / Math.PI);
    setGlare({
      background: `linear-gradient(${angle + 90}deg, rgba(0,255,245,0.08) 0%, rgba(255,0,255,0.06) 40%, rgba(77,124,255,0.08) 70%, transparent 100%)`,
      opacity: 1,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setStyle({
      transform: "perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
      transition: "transform 0.5s ease-out",
    });
    setGlare({ opacity: 0 });
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative overflow-hidden ${className}`}
      style={style}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {/* Holographic glare overlay */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
        style={glare}
      />
    </div>
  );
}
