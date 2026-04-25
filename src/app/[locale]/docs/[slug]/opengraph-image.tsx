import { ImageResponse } from "next/og";
import { getDocBySlug } from "@/lib/notion-docs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;

  let title = "Documentation";
  let category = "Docs";

  try {
    const doc = await getDocBySlug(slug);
    if (doc) {
      title = doc.title;
      category = doc.category ?? "Docs";
    }
  } catch {
    // fallback to defaults
  }

  return new ImageResponse(
    <div
      style={{
        background:
          "linear-gradient(135deg, #0a0a0f 0%, #0f1a12 50%, #0a1a1a 100%)",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "64px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(90deg, rgba(0,255,245,0.04) 1px, transparent 1px), linear-gradient(rgba(0,255,245,0.04) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />
      {/* Cyan glow top-left */}
      <div
        style={{
          position: "absolute",
          top: -100,
          left: -100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(0,255,245,0.05)",
          filter: "blur(80px)",
        }}
      />

      {/* Category badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 24,
          position: "relative",
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#00fff5",
          }}
        />
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 14,
            color: "#00fff5",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {category}
        </span>
      </div>

      {/* Title */}
      <div
        style={{
          fontSize: title.length > 60 ? 40 : 52,
          fontWeight: 800,
          color: "#ffffff",
          lineHeight: 1.15,
          letterSpacing: "-1px",
          marginBottom: 32,
          position: "relative",
          maxWidth: 900,
        }}
      >
        {title}
      </div>

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span style={{ fontSize: 28, color: "#ffffff", fontWeight: 800 }}>
            cloudless
          </span>
          <span style={{ fontSize: 28, color: "#00fff5", fontWeight: 800 }}>
            .gr
          </span>
        </div>
        <div
          style={{
            width: 120,
            height: 2,
            background:
              "linear-gradient(90deg, transparent, #00fff5, transparent)",
          }}
        />
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
