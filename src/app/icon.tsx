/**
 * Favicon (32×32) — Next.js Metadata API icon generator.
 *
 * Renders the v2 cloud silhouette filled with the calm-cloud accent
 * (#0a7785). Bundled at build time so the favicon ships from the same
 * source of truth as the in-app brand mark.
 *
 * Reference: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */

import { ImageResponse } from "next/og";

export const dynamic = "force-static";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <svg
        width="28"
        height="21"
        viewBox="0 0 32 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 22 A6 6 0 0 1 6 10 A4 4 0 0 1 10.5 7 A7 7 0 0 1 23 5.2 A6 6 0 0 1 28.5 14 A5 5 0 0 1 26 22 Z"
          fill="#0a7785"
        />
      </svg>
    </div>,
    { ...size },
  );
}
