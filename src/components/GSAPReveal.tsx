"use client";

import { type ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface GSAPRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right";
}

export default function GSAPReveal({
  children,
  className = "",
  delay = 0,
  direction = "up",
}: GSAPRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const from: gsap.TweenVars = { opacity: 0 };
    if (direction === "up") from.y = 40;
    else if (direction === "left") from.x = 40;
    else if (direction === "right") from.x = -40;

    const tween = gsap.fromTo(el, from, {
      opacity: 1,
      x: 0,
      y: 0,
      duration: 0.8,
      delay,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: "play none none none",
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, direction]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
