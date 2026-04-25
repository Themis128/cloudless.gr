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

export default function CloudMark({
  size = 28,
  className = "",
  accent = false,
  ...rest
}: CloudMarkProps) {
  const ariaLabel = rest["aria-label"];
  const role = ariaLabel ? "img" : "presentation";
  const labelProps = ariaLabel
    ? { "aria-label": ariaLabel, role }
    : { "aria-hidden": true };

  return (
    <svg
      width={size}
      height={(size * 24) / 32}
      viewBox="0 0 32 24"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={accent ? { color: "var(--accent)" } : undefined}
      {...labelProps}
    >
      {/*
        Path geometry — 3 stacked arcs joined by tangent curves to form a
        cloud silhouette. Built bottom-up:
          M 4 22  → start at left base
          A arc up over the small left hump
          A arc up over the larger center hump (the tallest at y≈4)
          A arc up over the medium right hump
          A arc down to the right base
          H 4    close along the flat bottom
      */}
      <path
        d="M6 22
           A6 6 0 0 1 6 10
           A4 4 0 0 1 10.5 7
           A7 7 0 0 1 23 5.2
           A6 6 0 0 1 28.5 14
           A5 5 0 0 1 26 22
           Z"
        fill="currentColor"
      />
    </svg>
  );
}
