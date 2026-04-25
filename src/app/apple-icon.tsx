/**
 * Apple touch icon (180×180) — iOS home-screen, Safari pinned tabs, etc.
 *
 * Renders the cloud silhouette on a soft sky-tinted background that matches
 * the v2 hero gradient mesh. Apple icons render with rounded corners on
 * iOS automatically, so the visual rectangle is fine.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */

import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #d6f0f6 0%, #e3e9ff 60%, #fbf8ff 100%)",
        }}
      >
        <svg
          width="140"
          height="105"
          viewBox="0 0 32 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6 22 A6 6 0 0 1 6 10 A4 4 0 0 1 10.5 7 A7 7 0 0 1 23 5.2 A6 6 0 0 1 28.5 14 A5 5 0 0 1 26 22 Z"
            fill="#0a7785"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
