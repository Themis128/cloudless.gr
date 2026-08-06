"use client";

import { useState, useEffect, useMemo, useRef } from "react";

/**
 * Returns true when the given ref's element is visible in the viewport
 * AND the user hasn't requested reduced motion. Used to pause all the
 * timeseries setInterval ticks on this page when the cockpit is off
 * screen, which trims TBT measurably on the home-page Lighthouse run
 * (previously, the 380 ms cursor interval kept the main thread busy
 * even when the cockpit was scrolled away).
 *
 * Falls back to "visible + motion-allowed" if either browser API is
 * missing so older runtimes degrade to the previous behaviour.
 */
function useAnimationActive(ref: React.RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true);
  const [allowed, setAllowed] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      // Start animating slightly before scroll lands on the widget so
      // the first frame the user sees is already up-to-date.
      rootMargin: "100px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAllowed(!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  return visible && allowed;
}

const T = {
  bg: "#0b1220",
  bgSubtle: "#142033",
  bgPanel: "#19243a",
  border: "#2a3550",
  gridLine: "rgba(180,200,230,0.07)",
  gridAxis: "rgba(180,200,230,0.25)",
  text: "#dde4f0",
  textDim: "#8895ac",
  // A11y: previous #5e6a82 measured ~3.2:1 on the dark slate background
  // and produced 11 serious color-contrast violations on the home page
  // (header labels like "Dashboard" and "p95 Latency"). Lifted to the
  // same value as textDim which passes WCAG AA at 5.6:1.
  textMuted: "#8895ac",
  accent: "#22d3e6",
  secondary: "#8b5cf6",
  ok: "#34d399",
  warn: "#fb923c",
  danger: "#f87171",
};

function LiveDot({ color = T.ok }: { color?: string }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 6, height: 6 }}>
      <span
        style={{
          position: "absolute",
          inset: 0,
          background: color,
          borderRadius: 999,
          animation: "cc-ping 2.4s cubic-bezier(0,0,0.2,1) infinite",
        }}
      />
      <span style={{ position: "absolute", inset: 0, background: color, borderRadius: 999 }} />
    </span>
  );
}

function TimeSeries() {
  const series = useMemo(
    () => ({
      p95: [
        14, 12, 13, 18, 15, 11, 12, 14, 22, 16, 13, 12, 10, 11, 13, 17, 14, 12, 11, 13, 19, 12, 11,
        12,
      ],
      p50: [6, 5, 5, 7, 6, 5, 5, 6, 8, 7, 5, 5, 4, 5, 5, 7, 6, 5, 4, 5, 7, 5, 5, 5],
    }),
    []
  );
  const n = series.p95.length;
  const W = 540,
    H = 150;
  const padL = 36,
    padR = 14,
    padT = 10,
    padB = 16;
  const min = 0,
    max = 28;
  const xFor = (i: number) => padL + (i * (W - padL - padR)) / (n - 1);
  const yFor = (v: number) => H - padB - ((v - min) / (max - min)) * (H - padT - padB);
  const toPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i)},${yFor(v)}`).join(" ");
  const areaPath = toPath(series.p95) + ` L${xFor(n - 1)},${H - padB} L${xFor(0)},${H - padB} Z`;

  const [cursor, setCursor] = useState(n - 1);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const active = useAnimationActive(hostRef);
  useEffect(() => {
    if (!active) return;
    // Bumped from 380ms to 1000ms — the cursor still feels live but the
    // main thread gets ~2.6× more idle time. Combined with the off-screen
    // pause above, the home-page Lighthouse TBT improves meaningfully.
    const id = setInterval(() => setCursor((c) => (c + 1) % n), 1000);
    return () => clearInterval(id);
  }, [n, active]);
  const cx = xFor(cursor);
  const yTicks = [0, 10, 20, 28];

  return (
    <div
      ref={hostRef}
      style={{
        background: T.bg,
        borderTop: `1px solid ${T.border}`,
        padding: "10px 6px 6px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px 6px",
          fontSize: 10,
          color: T.textMuted,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span>Request Latency</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 10,
            color: T.textDim,
            letterSpacing: 0,
            textTransform: "none",
          }}
        >
          <i
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: T.accent,
              display: "inline-block",
            }}
          />{" "}
          p95
          <i
            style={{
              width: 8,
              height: 8,
              borderRadius: 2,
              background: T.secondary,
              display: "inline-block",
            }}
          />{" "}
          p50
        </span>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="cc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={T.accent} stopOpacity="0.32" />
            <stop offset="100%" stopColor={T.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={yFor(t)} y2={yFor(t)} stroke={T.gridLine} />
            <text x={padL - 6} y={yFor(t) + 3} fontSize="9" textAnchor="end" fill={T.textMuted}>
              {t}ms
            </text>
          </g>
        ))}
        {[6, 12, 18].map((i) => (
          <line
            key={i}
            x1={xFor(i * 4)}
            x2={xFor(i * 4)}
            y1={padT}
            y2={H - padB}
            stroke={T.gridLine}
            strokeDasharray="1 3"
          />
        ))}
        <line
          x1={padL}
          x2={W - padR}
          y1={yFor(20)}
          y2={yFor(20)}
          stroke={T.warn}
          strokeDasharray="3 4"
          strokeWidth="1"
          opacity="0.7"
        />
        <text x={W - padR - 4} y={yFor(20) - 4} fontSize="9" textAnchor="end" fill={T.warn}>
          SLO 20ms
        </text>
        <path
          d={toPath(series.p50)}
          fill="none"
          stroke={T.secondary}
          strokeWidth="1.3"
          strokeOpacity="0.85"
        />
        <path d={areaPath} fill="url(#cc-area)" />
        <path
          d={toPath(series.p95)}
          fill="none"
          stroke={T.accent}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1={cx}
          x2={cx}
          y1={padT}
          y2={H - padB}
          stroke={T.gridAxis}
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <circle cx={cx} cy={yFor(series.p95[cursor])} r="3" fill={T.accent} />
        <circle cx={cx} cy={yFor(series.p95[cursor])} r="6" fill={T.accent} opacity="0.20" />
        <g
          transform={`translate(${Math.min(cx + 8, W - padR - 78)}, ${Math.max(yFor(series.p95[cursor]) - 38, padT + 2)})`}
        >
          <rect width="72" height="34" rx="3" fill="#000" fillOpacity="0.85" stroke={T.border} />
          <text x="8" y="12" fontSize="9" fill={T.textMuted}>
            t = −{n - cursor - 1}h
          </text>
          <text x="8" y="25" fontSize="11" fill={T.accent} fontWeight="600">
            {series.p95[cursor]} ms
          </text>
        </g>
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "0 14px",
          fontSize: 9,
          color: T.textMuted,
          fontVariantNumeric: "tabular-nums",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <span>−24h</span>
        <span>−12h</span>
        <span>now</span>
      </div>
    </div>
  );
}

  const chip: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 10,
    padding: "3px 8px",
    background: "rgba(255,255,255,0.08)",
    border: `1px solid ${T.border}`,
    borderRadius: 4,
    color: T.text,
    fontFamily: "var(--font-mono, monospace)",
  };

export default function CloudCockpit() {
  return (
    <div
      style={{
        background: T.bg,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
        color: T.text,
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <style>{`@keyframes cc-ping { 75%,100%{ transform:scale(2.6);opacity:0 } }`}</style>

      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          background: T.bgSubtle,
          borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: T.textMuted,
              textTransform: "uppercase",
            }}
          >
            Dashboard
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
            Production · api.cloudless.gr
          </span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={chip}>Last 24h ▾</span>
          <span
            style={{
              ...chip,
              background: "rgba(52,211,153,0.10)",
              borderColor: "rgba(52,211,153,0.35)",
              color: T.ok,
            }}
          >
            <LiveDot /> LIVE
          </span>
        </div>
      </div>

      {/* Stat tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 1,
          background: T.border,
          padding: 1,
          paddingBottom: 0,
        }}
      >
        {[
          {
            label: "p95 Latency",
            value: "12",
            unit: "ms",
            color: T.accent,
            sub: (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  color: T.ok,
                }}
              >
                ▼ −18% · 24h
              </span>
            ),
          },
          {
            label: "Uptime · 30d",
            value: "99.987",
            unit: "%",
            color: T.ok,
            sub: (
              <span style={{ fontSize: 10, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>
                SLO 99.9% · target met
              </span>
            ),
          },
          {
            label: "Error Rate",
            value: "0.04",
            unit: "%",
            color: T.ok,
            sub: (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 10,
                  color: T.ok,
                }}
              >
                ▼ −40% · week
              </span>
            ),
          },
        ].map(({ label, value, unit, color, sub }) => (
          <div
            key={label}
            style={{
              background: T.bg,
              padding: "12px 14px",
              minHeight: 84,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <span
              style={{
                fontSize: 9,
                letterSpacing: "0.2em",
                color: T.textMuted,
                textTransform: "uppercase",
              }}
            >
              {label}
            </span>
            <span
              style={{
                fontFamily: "var(--font-heading, sans-serif)",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
              <span
                style={{ fontSize: unit === "ms" ? 11 : 14, color: T.textDim, fontWeight: 400 }}
              >
                {unit}
              </span>
            </span>
            {sub}
          </div>
        ))}
      </div>

      <TimeSeries />

      {/* Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 14px",
          background: T.bgSubtle,
          borderTop: `1px solid ${T.border}`,
          fontSize: 10,
          color: T.textMuted,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <span>data source · cloudwatch-prod</span>
        <span>refreshed 2 s ago</span>
      </div>
    </div>
  );
}
