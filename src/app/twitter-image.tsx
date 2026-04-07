import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "Cloudless — Cloud Computing, Serverless & AI Marketing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 80px",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
        fontFamily: "system-ui, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Category pills */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#06B6D4",
            background: "rgba(6, 182, 212, 0.12)",
            padding: "6px 16px",
            borderRadius: "20px",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          CLOUD
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#06B6D4",
            background: "rgba(6, 182, 212, 0.12)",
            padding: "6px 16px",
            borderRadius: "20px",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          SERVERLESS
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#06B6D4",
            background: "rgba(6, 182, 212, 0.12)",
            padding: "6px 16px",
            borderRadius: "20px",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          ANALYTICS
        </div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#06B6D4",
            background: "rgba(6, 182, 212, 0.12)",
            padding: "6px 16px",
            borderRadius: "20px",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          AI
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: "64px",
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.15,
          letterSpacing: "-1px",
          marginBottom: "16px",
          display: "flex",
        }}
      >
        Clear skies. Zero friction.
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: "24px",
          color: "#94A3B8",
          lineHeight: 1.5,
          maxWidth: "700px",
          display: "flex",
        }}
      >
        Cloud architecture, serverless, analytics & AI marketing for startups and SMBs.
      </div>

      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "auto",
          paddingTop: "40px",
        }}
      >
        <div style={{ fontSize: "28px", fontWeight: 700, color: "#ffffff", display: "flex" }}>
          cloudless.gr
        </div>
      </div>
    </div>,
    { ...size },
  );
}
