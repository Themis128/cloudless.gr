import ScrollReveal from "@/components/ScrollReveal";
import { translate, type Locale } from "@/lib/i18n";
import type { Testimonial } from "@/lib/cms-static";

/**
 * Homepage testimonials section — presentational; the parent server
 * component fetches AppFlowy testimonials and passes them in. Renders
 * nothing when the list is empty so the homepage never shows a blank
 * section. Featured testimonials sort first; top 3 are shown.
 */
export default function TestimonialsSection({
  locale,
  items,
}: {
  locale: Locale;
  items: Testimonial[];
}) {
  const visible = items
    .filter((item) => item.quote?.trim())
    .slice()
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, 3);
  if (visible.length === 0) return null;

  const t = (key: string, fallback: string) => translate(locale, key, fallback);

  return (
    <section
      data-testid="testimonials-section"
      className="py-20 lg:py-24"
      style={{ background: "var(--surface-subtle)" }}
    >
      <div className="mx-auto max-w-6xl px-6">
        <ScrollReveal>
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p
              className="mb-3 font-mono text-xs font-medium tracking-[0.3em] uppercase"
              style={{ color: "var(--accent)" }}
            >
              {t("testimonialsSection.label", "[ TESTIMONIALS ]")}
            </p>
            <h2
              className="font-heading text-3xl font-bold md:text-4xl"
              style={{ color: "var(--ink-primary)" }}
            >
              {t("testimonialsSection.title", "What clients")}{" "}
              <span style={{ color: "var(--accent)" }}>
                {t("testimonialsSection.titleHighlight", "say")}
              </span>
            </h2>
            <p className="mt-4 text-lg" style={{ color: "var(--ink-muted)" }}>
              {t(
                "testimonialsSection.subtitle",
                "Real outcomes from real engagements — verified feedback, no invented metrics."
              )}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {visible.map((item, i) => {
            const stars = item.rating ? Math.max(0, Math.min(5, Math.round(item.rating))) : 0;
            return (
              <ScrollReveal key={item.id} delay={i * 100}>
                <figure
                  className="flex h-full flex-col rounded-xl border p-6"
                  style={{
                    background: "var(--surface-raised)",
                    borderColor: "var(--border-subtle)",
                    boxShadow: "var(--shadow-md)",
                  }}
                >
                  {stars > 0 ? (
                    <div
                      className="mb-3 font-mono text-sm tracking-wider"
                      style={{ color: "var(--accent)" }}
                      aria-label={`${item.rating} out of 5 stars`}
                    >
                      {"★".repeat(stars)}
                      <span style={{ color: "var(--ink-faint, var(--ink-muted))" }}>
                        {"★".repeat(5 - stars)}
                      </span>
                    </div>
                  ) : null}
                  <blockquote
                    className="flex-1 text-sm leading-relaxed"
                    style={{ color: "var(--ink-body)" }}
                  >
                    &ldquo;{item.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold"
                      style={{
                        background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        borderColor: "color-mix(in srgb, var(--accent) 25%, transparent)",
                        color: "var(--accent)",
                      }}
                    >
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--ink-primary)" }}>
                        {item.name}
                      </p>
                      <p className="font-mono text-[10px]" style={{ color: "var(--ink-muted)" }}>
                        {item.role || item.company}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
