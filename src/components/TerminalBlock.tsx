"use client";

interface TerminalBlockProps {
  lines: string[];
  title?: string;
  className?: string;
}

export default function TerminalBlock({
  lines,
  title = "terminal",
  className = "",
}: TerminalBlockProps) {
  return (
    // data-theme="dark" pins the terminal block to dark-mode tokens even when
    // its parent route is light. Terminal aesthetic is intentional and the
    // syntax-highlighting palette only reads correctly on a dark surface.
    <div
      data-theme="dark"
      className={`neon-border bg-void/90 overflow-hidden rounded-lg backdrop-blur-sm ${className}`}
    >
      {/* Title bar */}
      <div className="bg-void-lighter/80 border-neon-cyan/10 flex items-center gap-2 border-b px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/60" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
        <span className="h-3 w-3 rounded-full bg-green-500/60" />
        <span className="ml-2 font-mono text-xs text-slate-500">{title}</span>
      </div>

      {/* Content */}
      <div className="p-4 font-mono text-sm leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-neon-cyan/40 shrink-0 select-none">
              {line.startsWith("$") ? "" : "  "}
            </span>
            <span
              className={
                line.startsWith("$")
                  ? "text-neon-green"
                  : line.startsWith("//") || line.startsWith("#")
                    ? "text-slate-500"
                    : line.includes("✓") || line.includes("success")
                      ? "text-neon-cyan"
                      : "text-slate-300"
              }
            >
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
