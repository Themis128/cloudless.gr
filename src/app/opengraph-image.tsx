import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "cloudless.gr Cloud Computing, Serverless, Analytics & AI Marketing";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: "linear-gradient(135deg, #0a0a0f 0%, #12121a 50%, #1a1a2e 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid pattern overlay with rgba(0, 255, 245, 0.04) */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          backgroundImage: `linear-gradient(90deg, rgba(0, 255, 245, 0.04) 1px, transparent 1px), linear-gradient(rgba(0, 255, 245, 0.04) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
          pointerEvents: "none",
        }}
      />

      {/* Content container with logo, tagline, and decorative line */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Logo: cloud emoji + cloudless + .gr in cyan */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <div
            style={{
              fontSize: "48px",
              color: "#00fff5",
              textShadow: "0 0 20px rgba(0, 255, 245, 0.5)",
            }}
          >
            ☁
          </div>
          <div
            style={{ fontSize: "56px", fontWeight: 800, color: "#ffffff", letterSpacing: "-2px" }}
          >
            cloudless
          </div>
          <div
            style={{ fontSize: "56px", fontWeight: 800, color: "#00fff5", letterSpacing: "-2px" }}
          >
            .gr
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: "24px",
            color: "#94a3b8",
            textAlign: "center",
            fontWeight: 400,
            letterSpacing: "0.5px",
          }}
        >
          Cloud Computing · Serverless · Analytics · AI Marketing
        </div>

        {/* Decorative neon line gradient */}
        <div
          style={{
            width: "200px",
            height: "2px",
            background: "linear-gradient(90deg, transparent, #00fff5, transparent)",
            marginTop: "16px",
          }}
        />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
