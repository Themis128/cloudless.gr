"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#050814",
          color: "#fff",
          fontFamily: "monospace",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          textAlign: "center",
        }}
      >
        <div>
          <p style={{ fontSize: "5rem", fontWeight: 700, color: "#ff0080", margin: 0 }}>
            500
          </p>
          <h1 style={{ marginTop: "1rem", fontSize: "1.5rem" }}>
            Something went wrong
          </h1>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2rem",
              padding: "0.75rem 2rem",
              background: "transparent",
              border: "1px solid rgba(0,255,245,0.5)",
              color: "#00fff5",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              cursor: "pointer",
              borderRadius: "0.5rem",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
