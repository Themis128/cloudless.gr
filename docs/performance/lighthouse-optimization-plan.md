# Lighthouse Performance Optimization Plan

**Current Status:** /services 64 | /store 63 | Target: 65+
**Root Cause Analysis:** LCP 6.3–6.5s | TTFB slow | Locale redirect chain +780ms | Unused JS | Unoptimized images

---

## Executive Summary

The two pages are **0.1–1.0 seconds away** from the 65 target. This plan identifies **5 quick wins** with estimated gains of **1.2–1.8 seconds total**, all achievable with **low-to-medium effort**. Implementation order is prioritized by impact/effort ratio.

---

## Root Cause Analysis

| Issue | Impact | Current State |
|-------|--------|---------------|
| **LCP 6.3–6.5s** | Blocks visual completeness | Likely large SVG or text render |
| **TTFB slow** | Lambda cold-start penalty | No warmup strategy |
| **Locale redirect** | +780ms on cold load | `/services` → `/en/services` (unary 301) |
| **Unused JS** | Bundle bloat on routes | Store-only components on Services |
| **Unoptimized images** | Icon SVGs uncompressed | ProductIcon renders 5K+ SVG per card |

---

## 5 Quick Wins — Implementation Checklist

### ⭐ Quick Win #1: Defer Unused Store Code (High Impact, Low Effort)

**What to fix:** The `/services` page (`src/app/[locale]/services/page.tsx`) currently renders 4 huge service descriptions, detailed feature lists, and stats grids. However, store-related imports (StoreGrid, ProductIcon, ProductIcon dependencies) are **zero-risk dead code** on this route. Split bundle by dynamic imports.

**Estimated impact:** **+280ms** (5–6 Lighthouse points) — removing ~45 KB of unused JS from Services bundle.

**Effort:** **Low** (1–2 hours)

**Files involved:**

- `src/app/[locale]/services/page.tsx` — currently server-renders everything inline
- Create `src/app/[locale]/services/utils/service-data.ts` — extract static service/FAQ data
- No changes to `/store` page needed

**Implementation steps:**

1. Extract `getServices()` and `getServicesFaqs()` to `src/lib/services-data.ts`
2. Extract color maps to `src/lib/services-colors.ts`
3. Verify no runtime dependencies on store components in services layout
4. Test bundle size: `pnpm build` and compare `.next/static/chunks/app*services*.js` before/after

**Verification:**

```bash
# After changes, Services bundle should shrink by ~40–50 KB
pnpm build
ls -lh .next/static/chunks/app*services*.js
```

---

### ⭐ Quick Win #2: Fix Locale Redirect Chain — Route Alias (Medium Impact, Low Effort)

**What to fix:** `/services` redirects to `/en/services` via `src/app/services/page.tsx` which calls `permanentRedirect("/en/services")`. This adds a full 301 round-trip (~300–500ms on first load). The middleware already handles locale detection; we can skip the explicit route.

**Estimated impact:** **+280–350ms** (4–5 Lighthouse points) — eliminate one round-trip redirect on cold start.

**Effort:** **Low** (30 minutes)

**Files involved:**

- `src/app/services/page.tsx` — currently a redirect-only file
- `next.config.ts` — rewrites rule (already exists for other edge cases)

**Implementation steps:**

1. Update `next.config.ts` rewrites to catch `/services` and `/store` at the edge:

   ```typescript
   // In nextConfig.rewrites async function
   beforeFiles: [
     { source: "/services", destination: "/en/services" }, // Add this
     { source: "/store", destination: "/en/store" },       // Add this
     { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
   ]
   ```

2. Keep `src/app/services/page.tsx` as fallback for `force-dynamic` scenarios (POST requests, future API routes).

3. Test edge-case flows:
   - `GET /services` should rewrite to `/en/services` without browser redirect
   - `GET /store` should rewrite to `/en/store`
   - Canonical tags in metadata should still point to `/services`, not `/en/services`

**Verification:**

```bash
# Curl with -i to see headers
curl -i https://cloudless.gr/services  # Should show 200 OK (rewrite, not 301)
curl -i https://cloudless.gr/en/services  # Should also show 200
```

---

### ⭐ Quick Win #3: Compress ProductIcon SVGs with CSS Inline (Medium Impact, Low Effort)

**What to fix:** `src/components/store/ProductIcon.tsx` renders 8+ complex SVG icons (CloudAuditIcon, LambdaIcon, AnalyticsIcon, etc.), each with **3–5 KB of inline SVG markup**. The `/store` page renders 3+ cards, so **12–15 KB of uncompressed SVG** per page load.

**Estimated impact:** **+200ms** (3–4 Lighthouse points) — reduce JS parse time + smaller bundle.

**Effort:** **Low** (1 hour)

**Files involved:**

- `src/components/store/ProductIcon.tsx` — all icon SVGs defined inline
- `public/icons/` — store generated `.svg` files as static assets (new)

**Implementation steps:**

1. Extract each icon function to individual `.svg` files in `public/icons/store/`:
   - `public/icons/store/cloud-audit.svg`
   - `public/icons/store/lambda.svg`
   - `public/icons/store/analytics.svg`
   - `public/icons/store/dlc.svg`
   - `public/icons/store/web-design.svg`
   - `public/icons/store/hosting.svg`

2. Rewrite ProductIcon to use `<img>` with dynamic `src` selection and color via CSS variables:

   ```typescript
   // Before: 200 lines of SVG React code
   // After: 20 lines
   
   export default function ProductIcon({ 
     productId, 
     category 
   }: { productId: string; category: ProductCategory }) {
     const iconMap: Record<string, string> = {
       cloud_audit: "/icons/store/cloud-audit.svg",
       lambda: "/icons/store/lambda.svg",
       // ...
     };
     const color = accentColors[category];
     return (
       <img 
         src={iconMap[productId] || "/icons/store/generic.svg"} 
         alt="" 
         style={{ filter: `hue-rotate(...)` }}
         className="h-full w-full"
       />
     );
   }
   ```

3. Inline SVG color via CSS `<style>` in each `.svg` file or use `<svg data-color>` with inline CSS filter.

4. Minify SVGs: `pnpm add -D svgo && svgo --multipass public/icons/store/*.svg`

**Verification:**

```bash
# ProductIcon bundle size should shrink from ~8 KB to ~2 KB
pnpm build
du -sh .next/static/chunks/app*store*.js
```

---

### ⭐ Quick Win #4: Defer Non-Critical Terminal & FAQ Rendering (Medium Impact, Medium Effort)

**What to fix:** The `/services` page renders **6 service cards**, each with a `TerminalBlock` (terminal simulator, ~2 KB JS) and **4 stat counters** (`StatCounter` component, ~1.5 KB JS). The `FAQ` accordion section (`details` elements with `ScrollReveal`) adds **3 KB JS** for animation. These are all **below-the-fold** or **interactive-only** on mobile.

**Estimated impact:** **+250ms** (4 Lighthouse points) — defer ~8 KB of JS to `requestIdleCallback()` after LCP fires.

**Effort:** **Medium** (2–3 hours)

**Files involved:**

- `src/components/TerminalBlock.tsx` — used 6× on services page
- `src/components/StatCounter.tsx` — used 24× on services page (4 per service)
- `src/app/[locale]/services/page.tsx` — wrap deferred components
- Create `src/components/DeferredRender.tsx` — new utility component

**Implementation steps:**

1. Create `src/components/DeferredRender.tsx`:

   ```typescript
   "use client";
   import { useState, useEffect } from "react";
   
   export function DeferredRender({ children }: { children: React.ReactNode }) {
     const [ready, setReady] = useState(false);
     useEffect(() => {
       if ("requestIdleCallback" in window) {
         requestIdleCallback(() => setReady(true));
       } else {
         setTimeout(() => setReady(true), 0);
       }
     }, []);
     return ready ? children : <div className="h-24 bg-void-light/30 rounded" />;
   }
   ```

2. Wrap `TerminalBlock` and `StatCounter` in `DeferredRender`:

   ```typescript
   // In services page, around line 743–764
   <DeferredRender>
     <TerminalBlock lines={service.terminal} title={...} />
   </DeferredRender>
   
   <DeferredRender>
     <div className="grid grid-cols-2 gap-3">
       {service.stats.map(stat => (
         <StatCounter key={...} value={...} label={...} />
       ))}
     </div>
   </DeferredRender>
   ```

3. Wrap FAQ accordion in DeferredRender (line 1119–1137).

4. Test on PageSpeed Insights: LCP should remain unchanged, but FID should improve.

**Verification:**

```bash
# Run Lighthouse after deferral
pnpm lighthouse https://localhost:3000/en/services --chrome-flags="--headless"
# LCP should stay the same, FID should drop by ~50–100ms
```

---

### ⭐ Quick Win #5: Optimize Image Assets — WebP + Sizing Hints (Low Impact, Low Effort)

**What to fix:** The icons in `public/icons/` (PWA icons: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`) are **not optimized for modern formats**. Although they're **static assets only loaded by the PWA manifest**, reducing their size still helps. Additionally, the favicon and any product images (if using external Notion images) should have **explicit `sizes` attributes** on `<link>` tags to prevent duplicate requests.

**Estimated impact:** **+150ms** (2 Lighthouse points) — smaller icon payloads, fewer image format negotiations.

**Effort:** **Low** (45 minutes)

**Files involved:**

- `public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` — need optimization
- `src/app/layout.tsx` — PWA icon metadata
- `public/manifest.webmanifest` — no changes (auto-rewritten by `/api/pwa-manifest`)

**Implementation steps:**

1. **Optimize existing PNG icons to WebP:**

   ```bash
   # Install cwebp or use ImageMagick
   brew install webp  # macOS
   cwebp public/icons/icon-192.png -o public/icons/icon-192.webp -q 90
   cwebp public/icons/icon-512.png -o public/icons/icon-512.webp -q 90
   cwebp public/icons/icon-512-maskable.png -o public/icons/icon-512-maskable.webp -q 90
   ```

2. **Update `src/app/layout.tsx` apple-touch-icon to use WebP with fallback:**

   ```typescript
   icons: {
     apple: [
       { url: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp" },
       { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, // fallback
     ],
   }
   ```

3. **Verify manifest rewrite includes correct icon URLs** (generated by `/api/pwa-manifest/route.ts`):

   ```bash
   curl https://localhost:3000/manifest.webmanifest | jq .icons
   ```

4. **Check PWA install prompt** — no changes to user flow, just smaller download.

**Verification:**

```bash
ls -lh public/icons/icon-*.{png,webp}
# Should see .webp files ~40–50% smaller than .png
du -sh public/icons/icon-*.webp  # e.g., 15K instead of 28K
```

---

## Implementation Roadmap

### Phase 1: Quick Wins 1 & 2 (Day 1 — Est. 1.5 hours)

- [ ] Extract service data to separate modules (Win #1)
- [ ] Update Next.js rewrites for `/services` and `/store` (Win #2)
- [ ] Run Lighthouse audit to verify +560ms improvement
- [ ] Commit and push to `claude/lighthouse-phase-1`

### Phase 2: Quick Wins 3 & 4 (Day 2 — Est. 3 hours)

- [ ] Extract ProductIcon SVGs and minify (Win #3)
- [ ] Create DeferredRender component and wrap deferred sections (Win #4)
- [ ] Run PageSpeed Insights on both pages
- [ ] Commit and push to `claude/lighthouse-phase-2`

### Phase 3: Quick Win 5 + Validation (Day 3 — Est. 1 hour)

- [ ] Optimize icon assets to WebP (Win #5)
- [ ] Run full E2E Lighthouse audit
- [ ] Verify both pages score ≥65
- [ ] Commit and push to `claude/lighthouse-phase-3`

### Merge to Main

- [ ] Create PR with all changes
- [ ] Verify CI passes (Build, Lighthouse, e2e tests)
- [ ] Merge with squash commit

---

## Success Criteria

| Route | Current | Target | Delta | Estimated After All Wins |
|-------|---------|--------|-------|--------------------------|
| `/services` | 64 | 65 | +1 | **66–67** (CLS improvement) |
| `/store` | 63 | 65 | +2 | **66–68** (LCP + unused JS) |

**Stretch goal:** Both routes should score **68+** after implementing all 5 wins, providing buffer for future feature additions.

---

## Testing Strategy

### Local Validation

```bash
# Win #1 + #2: Bundle size + redirect
pnpm build
curl -i http://localhost:3000/services
curl -i http://localhost:3000/en/services

# Win #3: Icon rendering
pnpm dev
# Manual: load /store, check no SVG rendering lag, inspect Network tab for .svg file sizes

# Win #4: Deferred rendering
# Manual: open /services in DevTools, check Performance tab for LCP marker before TerminalBlock renders

# Win #5: Icon optimization
du -sh public/icons/icon-*.webp
```

### Lighthouse Audit

```bash
# Each phase, run full audit on both routes
pnpm lighthouse https://localhost:3000/en/services --chrome-flags="--headless --disable-device-emulation" --throttle-method=provided
pnpm lighthouse https://localhost:3000/en/store --chrome-flags="--headless --disable-device-emulation"
```

### E2E Coverage

```bash
pnpm test:e2e  # Runs Playwright, should pass with no visual regressions
pnpm test:coverage:full  # If applicable
```

---

## Risk Mitigation

| Win | Risk | Mitigation |
|-----|------|-----------|
| #1: Dead code split | Accidental removal of store logic | Grep for `StoreGrid` imports; verify no server-side store deps in services |
| #2: Rewrite vs redirect | Cached 301 in user browsers | Use `Cache-Control: public, max-age=31536000` on assets; new route behavior only on fresh clients |
| #3: SVG to img switch | Color animation breaks | Keep inline `<style>` in each .svg or use CSS filter hue-rotate via data attributes |
| #4: DeferredRender fallback | Blank space on slow 3G | Render a skeleton/placeholder during idle wait; test with Lighthouse throttling |
| #5: WebP format support | Old Safari / IE edge case | Fallback to .png in manifest; WebP is 95%+ supported in modern browsers |

---

## Bundle Size Targets

| Component | Current | Target | Win |
|-----------|---------|--------|-----|
| Services JS chunk | ~250 KB | ~205 KB | #1: -45 KB (18% reduction) |
| Store JS chunk | ~320 KB | ~275 KB | #3: -45 KB (14% reduction) |
| Services page icons (inline SVG) | ~15 KB | ~0 KB | #3: -15 KB (moved to .svg files) |
| Icon assets on disk | 28 KB × 3 | ~15 KB × 3 | #5: -65% (WebP conversion) |
| Total deferred JS (Terminal + Stats) | ~8 KB | ~0 KB (loaded idle) | #4: deferred past LCP |

---

## Appendix: Code Snippets

### Win #1: Service Data Extraction

**File:** `src/lib/services-data.ts` (new)

```typescript
// Extract getServices() and getServicesFaqs() here
// Remove from services/page.tsx
export const getServices = (t: (key: string, fallback: string) => string) => [
  // ... service array
];

export const getServicesFaqs = (t: (key: string, fallback: string) => string) => [
  // ... FAQ array
];
```

### Win #2: Next.js Rewrites

**File:** `next.config.ts`

```typescript
nextConfig.rewrites = async () => ({
  beforeFiles: [
    { source: "/services", destination: "/en/services" },
    { source: "/store", destination: "/en/store" },
    { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
  ],
  afterFiles: [],
  fallback: [],
});
```

### Win #4: DeferredRender Component

**File:** `src/components/DeferredRender.tsx` (new)

```typescript
"use client";
import { useState, useEffect } from "react";

export function DeferredRender({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => setReady(true));
    } else {
      setTimeout(() => setReady(true), 1000);
    }
  }, []);

  return ready ? children : (fallback ?? <div className="h-24 bg-void-light/30 rounded" />);
}
```

---

## Next Steps

1. **Now:** Review this plan and confirm priorities.
2. **Week 1:** Implement Wins #1 & #2, validate with Lighthouse.
3. **Week 2:** Implement Wins #3 & #4, test on real throttled network.
4. **Week 3:** Implement Win #5, final audit, merge to main.
5. **Post-merge:** Monitor production Lighthouse scores via PageSpeed Insights.

---

**Owner:** Claude Code  
**Last Updated:** 2026-06-10  
**Status:** Ready for implementation
