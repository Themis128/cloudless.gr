import ScrollReveal from "@/components/ScrollReveal";
import { SOCIAL_ACCOUNTS } from "@/components/social-accounts";
import { translate, type Locale } from "@/lib/i18n";

/**
 * SocialMediaSection — homepage "follow us" grid listing every Cloudless
 * business profile. Data comes from ./social-accounts (single source of
 * truth shared with the SocialLinks icon row).
 */
export default function SocialMediaSection({ locale }: Readonly<{ locale: Locale }>) {
  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <section
      data-testid="social-section"
      className="py-16 lg:py-20"
      style={{ background: "var(--surface-canvas)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p
              className="mb-3 font-mono text-xs font-medium tracking-[0.3em] uppercase"
              style={{ color: "var(--accent)" }}
            >
              {t("social.label", "[ CONNECT ]")}
            </p>
            <h2
              className="font-heading text-3xl font-bold md:text-4xl"
              style={{ color: "var(--ink-primary)" }}
            >
              {t("social.title", "Follow Cloudless")}{" "}
              <span style={{ color: "var(--accent)" }}>
                {t("social.titleHighlight", "everywhere")}
              </span>
            </h2>
            <p
              className="mt-4 text-sm leading-relaxed md:text-base"
              style={{ color: "var(--ink-body)" }}
            >
              {t(
                "social.subtitle",
                "Cloud tips, carousels, and build-in-public updates — pick your platform."
              )}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SOCIAL_ACCOUNTS.map((account, i) => (
            <ScrollReveal key={account.key} delay={i * 60}>
              <a
                href={account.href}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={`social-card-${account.key}`}
                className="v2-hover-card group flex h-full flex-col rounded-xl p-5"
                aria-label={`Cloudless on ${account.name} (${account.handle})`}
              >
                <span
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border transition-colors"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--accent) 20%, transparent)",
                    color: "var(--accent)",
                  }}
                >
                  {account.icon}
                </span>
                <span
                  className="font-heading text-sm font-semibold"
                  style={{ color: "var(--ink-primary)" }}
                >
                  {account.name}
                </span>
                <span className="mt-1 font-mono text-xs" style={{ color: "var(--ink-muted)" }}>
                  {account.handle}
                </span>
                <span
                  className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] font-semibold"
                  style={{ color: "var(--accent)" }}
                >
                  {account.kind === "chat"
                    ? t("social.chat", "Chat")
                    : t("social.follow", "Follow")}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  >
                    <path d="M7 17L17 7M7 7h10v10" />
                  </svg>
                </span>
              </a>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
