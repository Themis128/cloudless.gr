/**
 * Logo — the brand wordmark.
 *
 * Three variants:
 *   - "wordmark" (default): CloudMark + "cloudless.gr" text
 *   - "mark":               CloudMark only (use for tight spaces)
 *   - "text":               text only (rarely needed; SEO/print fallback)
 *
 * The wordmark uses the heading font and follows the v2 spec: brand text
 * in --ink-primary, ".gr" suffix in --accent. The mark color flows from
 * currentColor so it adapts to the surrounding text color (white in dark
 * navbar, --ink-primary in light marketing pages).
 */

import CloudMark from "@/components/CloudMark";

interface LogoProps {
  variant?: "wordmark" | "mark" | "text";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { mark: 20, text: "text-base" },
  md: { mark: 24, text: "text-xl" },
  lg: { mark: 32, text: "text-2xl" },
};

export default function Logo({
  variant = "wordmark",
  size = "md",
  className = "",
}: LogoProps) {
  const s = SIZES[size];

  if (variant === "mark") {
    return (
      <CloudMark
        size={s.mark}
        className={className}
        aria-label="cloudless.gr"
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2 ${className}`}
      aria-label="cloudless.gr"
    >
      {variant === "wordmark" && (
        <CloudMark size={s.mark} aria-hidden />
      )}
      <span
        className={`font-heading ${s.text} font-bold tracking-tight`}
      >
        cloudless<span className="text-neon-cyan">.gr</span>
      </span>
    </span>
  );
}
