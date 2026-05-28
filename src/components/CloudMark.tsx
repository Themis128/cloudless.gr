/**
 * CloudMark — the cloudless.gr brand logomark.
 *
 * Design: literal cloud silhouette, flat-stylised. Three rounded humps
 * (small left, large center, medium right) over a flat base. Single fill
 * color via currentColor so it picks up the parent text color.
 *
 * Reference register: Stripe Atlas / Linear / Resend — flat icon, clean
 * geometry, single accent color, no gradient or stroke detail.
 *
 * The viewBox is 32×24 (4:3) so the cloud reads as wider than tall, the way
 * a real cloud silhouette does. For square uses (favicon, app icon), wrap
 * in a square container with padding.
 */

interface CloudMarkProps {
  size?: number;
  className?: string;
  /** When true, paint the cloud with --accent regardless of currentColor. */
  accent?: boolean;
  "aria-label"?: string;
}

const CLOUD_PATH =
  "M6 22 A6 6 0 0 1 6 10 A4 4 0 0 1 10.5 7 A7 7 0 0 1 23 5.2 A6 6 0 0 1 28.5 14 A5 5 0 0 1 26 22 Z";

export default function CloudMark({
  size = 28,
  className = "",
  accent = false,
  ...rest
}: CloudMarkProps) {
  const ariaLabel = rest["aria-label"];
  const role = ariaLabel ? "img" : "presentation";
  const labelProps = ariaLabel ? { "aria-label": ariaLabel, role } : { "aria-hidden": true };
  const h = (size * 28) / 32;

  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 32 28"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={accent ? { color: "var(--accent)" } : undefined}
      {...labelProps}
    >
      <defs>
        <linearGradient id="cm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" />
          <stop offset="55%" stopColor="currentColor" stopOpacity="0.92" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.72" />
        </linearGradient>
        <radialGradient id="cm-spec" cx="45%" cy="20%" r="42%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="60%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cm-rim" x1="0" y1="1" x2="0" y2="0.6">
          <stop offset="0%" stopColor="#000" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <filter id="cm-shadow">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" />
          <feOffset dy="0.6" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Ground shadow */}
      <ellipse cx="16" cy="25.5" rx="11" ry="1.3" fill="currentColor" opacity="0.15" />
      <g filter="url(#cm-shadow)">
        {/* Body fill */}
        <path d={CLOUD_PATH} fill="url(#cm-body)" />
        {/* Underside shading */}
        <path d={CLOUD_PATH} fill="url(#cm-rim)" />
        {/* Top specular highlight */}
        <path d={CLOUD_PATH} fill="url(#cm-spec)" />
        {/* Left-hump glint */}
        <ellipse cx="13.5" cy="7.6" rx="2.6" ry="1.0" fill="#fff" opacity="0.5" />
      </g>
    </svg>
  );
}
