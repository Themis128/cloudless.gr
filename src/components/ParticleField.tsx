"use client";

import { useEffect, useRef } from "react";

interface ParticleFieldProps {
  className?: string;
  particleCount?: number;
  color?: string;
  connectionDistance?: number;
}

export default function ParticleField({
  className = "",
  particleCount = 60,
  color = "0, 255, 245",
  connectionDistance = 120,
}: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const isNarrowViewport = window.matchMedia("(max-width: 768px)").matches;
    const effectiveParticleCount = isNarrowViewport
      ? Math.max(20, Math.floor(particleCount * 0.5))
      : particleCount;
    const effectiveConnectionDistance = isNarrowViewport
      ? Math.max(80, Math.floor(connectionDistance * 0.75))
      : connectionDistance;

    const canvasEl = canvas;
    const ctx = canvasEl.getContext("2d");
    if (ctx === null) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

    function resize() {
      const rect = canvasEl.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvasEl.width = rect.width;
      canvasEl.height = rect.height;
    }

    function initParticles() {
      particles = Array.from({ length: effectiveParticleCount }, () => ({
        x: Math.random() * canvasEl.width,
        y: Math.random() * canvasEl.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.5 + 0.5,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, canvasEl.width, canvasEl.height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < effectiveConnectionDistance) {
            const alpha = (1 - dist / effectiveConnectionDistance) * 0.15;
            ctx!.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx!.fillStyle = `rgba(${color}, 0.5)`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvasEl.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvasEl.height) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    }

    const handleResize = () => {
      resize();
      initParticles();
    };

    resize();
    initParticles();
    draw();

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, [particleCount, color, connectionDistance]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
