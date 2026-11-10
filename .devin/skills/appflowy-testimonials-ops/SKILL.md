---
name: appflowy-testimonials-ops
description: Manage Cloudless.gr testimonials end-to-end — AppFlowy `[Testimonial]` pages, field schema, the surfaces that render them (homepage, /store, /links, /api/testimonials), and live verification. Use when adding/editing/removing a testimonial, the micro1-style "highlight feedback" request, or when a testimonial isn't showing on the site.
---

# appflowy-testimonials-ops — testimonial lifecycle (verified 2026-11-09, PR #2406)

## Data model

- Source of truth: **AppFlowy Cloud** on omv k3s. One page per testimonial, title prefix **`[Testimonial] <name>`** — the prefix is what `getTestimonials()` filters on.
- Page body is markdown with `**Field**: value` lines parsed by `src/lib/appflowy-testimonials.ts` — the colon after `**Field**` is required (regex `\*\*Key\*\*:\s*(.+)`):
  - `**Company**:`, `**Role**:`, `**Quote**:`, `**Service**:`, `**Rating**:` (1–5 int), `**Featured**:` (true/false), optional `**Avatar**:`.
- Reader: `src/lib/appflowy-testimonials.ts` → `getTestimonials()` (all), `getFeaturedTestimonials()`, `getAllTestimonialsAdmin()`. Unconfigured/unreachable AppFlowy → returns `[]` safely (surfaces must degrade, never 500).

## Surfaces (all render the same AppFlowy data)

| Surface | File | Behavior |
|---|---|---|
| Homepage `/` | `src/app/[locale]/page.tsx` + `src/components/TestimonialsSection.tsx` | Server component fetches, presentational child renders featured-first top 3; `null` when empty |
| `/en/store` | `src/app/[locale]/store/page.tsx` | AppFlowy first (top 3, `role \|\| company`, rating→★); `fallbackTestimonials` static array when CMS empty |
| `/links` | `src/app/links/page.tsx` | `getFeaturedTestimonials()` hero social-proof block |
| API | `src/app/api/testimonials/route.ts` | public JSON list |

i18n: `testimonialsSection.*` keys exist in all four locales (`en/el/fr/de`) — keep parity when editing copy.

## Adding a testimonial

1. **Preferred**: AppFlowy admin UI — create page `[Testimonial] <name>` in the testimonials view/space with the `**Field**: value` markdown above. No deploy needed; surfaces pick it up on next render/ISR.
2. **Scripted**: `scripts/appflowy-upload-md.mjs` (repo root `scripts/`) or `src/lib/appflowy.ts` helpers (`createPage`, `appendBlockToPage`, `updateViewName`). Env: `APPFLOWY_API_URL`/`APPFLOWY_BASE_URL`, `APPFLOWY_EMAIL`, `APPFLOWY_PASSWORD`, `APPFLOWY_WORKSPACE_ID` — never print/commit them.
3. The generic admin write route `src/app/api/admin/appflowy/**` returns `appflowyWriteNotImplemented` (501 stub) — do NOT route CMS writes through it.
4. **Namespace hygiene**: only `[Testimonial] <name>` pages render. To retire one without deleting (AppFlowy-Cloud HTTP API has no page-delete endpoint — 405; deletion is a websocket/collab op), rename the page out of the prefix (e.g. `archived-…`) via `updateViewName`/page rename. Verify count drops via `/api/testimonials`.

## Content rules

- Public quotes must be real, attributable feedback — no invented metrics, no private recruiter correspondence, no growth-area/negative feedback unless the author explicitly approves.
- `**Rating**:` is clamped 0–5 and rounded at render; still store clean ints.
- Pages with a missing/empty `**Quote**:` parse to `quote=""` and are filtered at render (`TestimonialsSection`, `/store`) — fix the CMS page rather than relying on the filter. There is intentionally no whole-markdown quote fallback.

## Verify

```bash
.devin/skills/appflowy-testimonials-ops/scripts/verify_testimonials.sh
```

Checks `/api/testimonials` count + homepage `data-testid="testimonials-section"` + store testimonial names. Expect `x-served-by: pi-tunnel-proxy` path; deploys land via `deploy-pi.yml` (~6 min) after merge to `main`.

## Gotchas

- `getTestimonials()` runs server-side per request/ISR — if AppFlowy Cloud is unreachable from the Pi pod, homepage hides the section and store falls back to static quotes (by design).
- `TestimonialsSection` must stay a **sync presentational** component — async RSC fetch lives in the page; tests render `await Page()`.
- Coverage gate is 99.5% lines — any new testimonial UI code needs tests in the same PR (see `cloudless-pr-ops`).
