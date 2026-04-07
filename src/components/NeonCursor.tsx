"use client";

import { useEffect, useRef, useState } from "react";

export default function NeonCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show on touch devices
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) return;

    const mouse = { x: 0, y: 0 };
    const dot = { x: 0, y: 0 };
    const ring = { x: 0, y: 0 };
    let rafId = 0;

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function animate() {
      // Dot follows closely
      dot.x += (mouse.x - dot.x) * 0.35;
      dot.y += (mouse.y - dot.y) * 0.35;

      // Ring follows with more lag
      ring.x += (mouse.x - ring.x) * 0.12;
      ring.y += (mouse.y - ring.y) * 0.12;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${dot.x - 4}px, ${dot.y - 4}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.x - 16}px, ${ring.y - 16}px)`;
      }

      rafId = requestAnimationFrame(animate);
    }

    // Hide default cursor
    document.body.style.cursor = "none";

    // Add style to hide cursor on all interactive elements
    const style = document.createElement("style");
    style.id = "neon-cursor-style";
    style.textContent = "*, *::before, *::after { cursor: none !important; }";
    document.head.appendChild(style);

    window.addEventListener("mousemove", onMouseMove);
    rafId = requestAnimationFrame(animate);

    // Defer setState to avoid synchronous set-state-in-effect
    const showFrame = requestAnimationFrame(() => setVisible(true));

    return () => {
      cancelAnimationFrame(showFrame);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(rafId);
      document.body.style.cursor = "";
      const el = document.getElementById("neon-cursor-style");
      if (el) el.remove();
    };
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-9999 will-change-transform"
      >
        <div className="bg-neon-cyan h-2 w-2 rounded-full shadow-[0_0_8px_#00fff5,0_0_16px_rgba(0,255,245,0.4)]" />
      </div>
      {/* Ring */}
      <div
        ref={ringRef}
        className="pointer-events-none fixed top-0 left-0 z-9998 will-change-transform"
      >
        <div className="border-neon-cyan/30 h-8 w-8 rounded-full border" />
      </div>
    </>
  );
}
