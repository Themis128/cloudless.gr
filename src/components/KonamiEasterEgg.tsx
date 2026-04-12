"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./KonamiEasterEgg.module.css";

const MATRIX_COLUMN_CLASS_NAMES = [
  styles.column0,
  styles.column1,
  styles.column2,
  styles.column3,
  styles.column4,
  styles.column5,
  styles.column6,
  styles.column7,
  styles.column8,
  styles.column9,
  styles.column10,
  styles.column11,
  styles.column12,
  styles.column13,
  styles.column14,
  styles.column15,
  styles.column16,
  styles.column17,
  styles.column18,
  styles.column19,
];

const MATRIX_TIMING_CLASS_NAMES = [
  styles.timing0,
  styles.timing1,
  styles.timing2,
  styles.timing3,
  styles.timing4,
];

// Precompute random animation data outside render to satisfy react-hooks/purity
const MATRIX_RAIN_DATA = Array.from({ length: 20 }, (_, index) => ({
  columnClassName: MATRIX_COLUMN_CLASS_NAMES[index],
  timingClassName: MATRIX_TIMING_CLASS_NAMES[index % MATRIX_TIMING_CLASS_NAMES.length],
  chars: Array.from({ length: 30 }, () => String.fromCharCode(0x30a0 + Math.floor(Math.random() * 96))).join(
    "\n",
  ),
}));

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

export default function KonamiEasterEgg() {
  const [triggered, setTriggered] = useState(false);
  const [index, setIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === KONAMI_CODE[index]) {
        const next = index + 1;
        if (next === KONAMI_CODE.length) {
          setTriggered(true);
          setIndex(0);
          setTimeout(() => setTriggered(false), 5000);
        } else {
          setIndex(next);
        }
      } else {
        setIndex(0);
      }
    },
    [index],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!triggered) return null;

  return (
    <div className="animate-fade-in pointer-events-none fixed inset-0 z-[200] flex items-center justify-center">
      {/* Matrix rain effect */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {MATRIX_RAIN_DATA.map((rain) => (
          <div
            key={rain.columnClassName}
            className={`text-neon-green absolute font-mono text-xs whitespace-pre ${styles.matrixColumn} ${rain.columnClassName} ${rain.timingClassName}`}
          >
            {rain.chars}
          </div>
        ))}
      </div>

      {/* Message */}
      <div className="relative text-center">
        <p className="text-neon-cyan glow-cyan animate-scale-in font-mono text-4xl font-bold md:text-6xl">
          ☁ CLOUDLESS MODE
        </p>
        <p className="text-neon-green glow-green animate-fade-in-up mt-4 font-mono text-lg delay-300">
          [CHEAT ACTIVATED] All systems overclocked
        </p>
      </div>
    </div>
  );
}
