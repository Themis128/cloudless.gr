/**
 * SocialLinks — shared social icon row for cloudless.gr.
 * Used in Footer, ContactFormSection, and the home page (credibility strip + founder section).
 * Account data lives in ./social-accounts (single source of truth).
 *
 * Props:
 *   size       — icon button size: "sm" (h-9 w-9 / 16px icon) | "md" (h-10 w-10 / 18px icon)
 *   className  — extra class on the wrapping <div>
 */
import { SOCIAL_ACCOUNTS } from "@/components/social-accounts";

type SocialLinksSize = "sm" | "md";

interface SocialLinksProps {
  size?: SocialLinksSize;
  className?: string;
}

const sizeClasses: Record<SocialLinksSize, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
};

export default function SocialLinks({ size = "sm", className = "" }: Readonly<SocialLinksProps>) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {SOCIAL_ACCOUNTS.map(({ key, name, handle, href, icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Cloudless on ${name} (${handle})`}
          className={`bg-void-light/50 hover:text-neon-cyan hover:border-neon-cyan/30 active:text-neon-cyan flex items-center justify-center rounded-lg border border-slate-800 text-slate-400 transition-colors ${sizeClasses[size]}`}
        >
          {icon}
        </a>
      ))}
    </div>
  );
}
