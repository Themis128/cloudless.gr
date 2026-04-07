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

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; size: number }[] = [];

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
    }

    function initParticles() {
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas!.width,
        y: Math.random() * canvas!.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.5 + 0.5,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDistance) {
            const alpha = (1 - dist / connectionDistance) * 0.15;
            ctx!.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      // Draw & move particles
      for (const p of particles) {
        ctx!.fillStyle = `rgba(${color}, 0.5)`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > canvas!.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas!.height) p.vy *= -1;
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
