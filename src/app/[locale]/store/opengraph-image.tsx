export const runtime = "edge";
export const alt = "Cloudless — Store";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

import { ImageResponse } from "next/og";

export default function StoreOGImage() {
  return new ImageResponse(
    <div
      style={{
        background: "#0a0a1a",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "72px 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Glow */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-60px",
          width: "560px",
          height: "560px",
          background:
            "radial-gradient(circle, rgba(180,0,255,0.10) 0%, transparent 65%)",
          borderRadius: "50%",
        }}
      />

      {/* Badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "rgba(180,0,255,0.08)",
          border: "1px solid rgba(180,0,255,0.25)",
          borderRadius: "999px",
          padding: "8px 20px",
          marginBottom: "28px",
        }}
      >
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#b400ff",
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "13px",
            letterSpacing: "0.12em",
            color: "#b400ff",
          }}
        >
          STORE
        </span>
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: "72px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 16px",
          lineHeight: 1.05,
          letterSpacing: "-0.02em",
        }}
      >
        Digital Products
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "26px",
          color: "rgba(148,163,184,0.9)",
          margin: "0 0 48px",
          lineHeight: 1.4,
          maxWidth: "680px",
        }}
      >
        Templates, tools, and resources built for modern digital agencies.
      </p>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            background: "rgba(0,212,255,0.15)",
            border: "1px solid rgba(0,212,255,0.3)",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "14px",
              height: "14px",
              background: "#00d4ff",
              borderRadius: "2px",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "18px",
            color: "rgba(100,116,139,0.9)",
            letterSpacing: "0.04em",
          }}
        >
          cloudless.gr
        </span>
      </div>
    </div>,
    { ...size },
  );
}
