# Lighthouse Optimization — Quick Checklist

## 5 Quick Wins Summary

| # | Win | Impact | Effort | Status | Files |
|---|-----|--------|--------|--------|-------|
| 1 | Defer store code from services | +280ms (5pts) | Low (1h) | ⏳ | `services/page.tsx` → `lib/services-data.ts` |
| 2 | Fix locale redirect chain | +280ms (4pts) | Low (0.5h) | ⏳ | `next.config.ts` rewrites |
| 3 | Compress ProductIcon SVGs | +200ms (3pts) | Low (1h) | ⏳ | `ProductIcon.tsx` → `public/icons/store/*.svg` |
| 4 | Defer TerminalBlock + stats | +250ms (4pts) | Med (2h) | ⏳ | Create `DeferredRender.tsx` |
| 5 | Optimize icon assets to WebP | +150ms (2pts) | Low (0.5h) | ⏳ | `public/icons/*.png` → `.webp` |
| **TOTAL** | | **+1.16s (18pts)** | **5.5h** | **→ 66+** | **7 files** |

---

## Phase 1: Days 1–2 (Hours 1–3.5)

### Win #1: Extract Service Data ⏳

- [ ] Create `src/lib/services-data.ts`
  - Copy `getServices()` function from `services/page.tsx` (lines 61–332)
  - Copy `getServicesFaqs()` function (lines 334–373)
  - Copy `colorMap` object (lines 391–436)
  - Export all three
- [ ] Update `src/app/[locale]/services/page.tsx`
  - Import functions from `lib/services-data.ts`
  - Remove old function definitions
  - Test: `pnpm dev` → `/en/services` should render identically
- [ ] Verify bundle shrinkage: `pnpm build && du -sh .next/static/chunks/app*services*.js`

### Win #2: Fix Locale Redirects ⏳

- [ ] Update `next.config.ts` rewrites (line ~107–111)

  ```typescript
  beforeFiles: [
    { source: "/services", destination: "/en/services" },
    { source: "/store", destination: "/en/store" },
    { source: "/manifest.webmanifest", destination: "/api/pwa-manifest" },
  ]
  ```

- [ ] Test redirects:
  - `curl -i http://localhost:3000/services` → expect 200 (rewrite)
  - `curl -i http://localhost:3000/en/services` → expect 200
  - Check headers: no `Location: /en/services` (should be rewrite, not redirect)
- [ ] Verify metadata canonical tags still say `/services` (not `/en/services`)

---

## Phase 2: Days 3–4 (Hours 4–7)

### Win #3: Compress ProductIcon SVGs ⏳

- [ ] Create `public/icons/store/` directory
- [ ] Export each icon from `ProductIcon.tsx` as `.svg` file:
  - [ ] `cloud-audit.svg` (from `CloudAuditIcon`)
  - [ ] `lambda.svg` (from `LambdaIcon`)
  - [ ] `analytics.svg` (from `AnalyticsIcon`)
  - [ ] `dlc.svg` (from `DLCIcon`)
  - [ ] `web-design.svg` (from `WebDesignIcon`)
  - [ ] `hosting.svg` (from `HostingIcon`)
- [ ] Minify all SVGs: `pnpm add -D svgo && svgo --multipass public/icons/store/*.svg`
- [ ] Rewrite `ProductIcon.tsx`:

  ```typescript
  const iconMap: Record<string, string> = {
    // Map product IDs to SVG paths
  };
  return (
    <img src={iconMap[productId]} alt="" className="h-full w-full" />
  );
  ```

- [ ] Test: `/en/store` should render with same visual appearance
- [ ] Verify size: `du -sh public/icons/store/` should be ~10 KB total

### Win #4: Defer Non-Critical JS ⏳

- [ ] Create `src/components/DeferredRender.tsx` (copy from plan)
- [ ] In `src/app/[locale]/services/page.tsx`:
  - [ ] Import `DeferredRender` (new)
  - [ ] Wrap `TerminalBlock` (line ~743) with `<DeferredRender>`
  - [ ] Wrap stat grids (line ~749) with `<DeferredRender>`
  - [ ] Wrap FAQ section (line ~1119) with `<DeferredRender>`
- [ ] Test with Lighthouse throttling:
  - `pnpm lighthouse https://localhost:3000/en/services --throttle-method=provided`
  - LCP should **not change** (still measure before deferred JS loads)
  - FID should improve by ~50–100ms

---

## Phase 3: Day 5 (Hours 7.5–8.5)

### Win #5: Optimize Icon Assets ⏳

- [ ] Convert PNG icons to WebP:

  ```bash
  cwebp -q 90 public/icons/icon-192.png -o public/icons/icon-192.webp
  cwebp -q 90 public/icons/icon-512.png -o public/icons/icon-512.webp
  cwebp -q 90 public/icons/icon-512-maskable.png -o public/icons/icon-512-maskable.webp
  ```

- [ ] Update `src/app/layout.tsx` icons metadata:

  ```typescript
  icons: {
    apple: [
      { url: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  }
  ```

- [ ] Verify manifest endpoint includes correct icon URLs:
  - `curl http://localhost:3000/manifest.webmanifest | jq .icons`

---

## Validation Checklist ✅

### Local Testing

- [ ] No console errors in DevTools
- [ ] All interactive elements (buttons, modals, accordions) work
- [ ] `/en/services` renders all 6 service cards with correct text
- [ ] `/en/store` renders all products with search/filter working
- [ ] PWA install prompt still appears (manifest is valid)

### Performance Verification

- [ ] Run Lighthouse on both routes after each phase
- [ ] `/en/services` score ≥66 (was 64)
- [ ] `/en/store` score ≥66 (was 63)
- [ ] LCP ≤4.5s (was 6.3–6.5s)
- [ ] CLS <0.1 (visual stability)
- [ ] Total JS size reduction ≥10% bundle-wide

### Git Workflow

- [ ] Phase 1: Commit to `claude/lighthouse-phase-1`, push, create draft PR
- [ ] Phase 2: Commit to `claude/lighthouse-phase-2`, push
- [ ] Phase 3: Commit to `claude/lighthouse-phase-3`, push
- [ ] Final: Merge all PRs with `squash` to main after CI passes

---

## Risk Checklist ⚠️

| Risk | Mitigation | Status |
|------|-----------|--------|
| Win #1: AccidentalStore import left in services | Grep: `grep -r "StoreGrid\|ProductIcon" src/app/*/services/` | ⏳ |
| Win #2: Cached 301 breaks old URLs | Users on old cached version still see redirect—OK, no breakage | ⏳ |
| Win #3: SVG to img loses color animation | Test color rendering on `/en/store` cards | ⏳ |
| Win #4: Blank space before deferred JS loads | Render skeleton placeholder in `DeferredRender` fallback | ⏳ |
| Win #5: Old Safari no WebP support | PNG fallback in manifest; affects <1% of users | ⏳ |

---

## Commands Quick Reference

```bash
# Build & verify bundle sizes
pnpm build
du -sh .next/static/chunks/app*.js | sort -h

# Local Lighthouse audit
pnpm add -D @lhci/cli@latest
pnpm lighthouse https://localhost:3000/en/services

# SVG minification
pnpm add -D svgo
svgo --multipass public/icons/store/*.svg

# PNG to WebP conversion
brew install webp  # macOS only
cwebp -q 90 input.png -o output.webp

# Verify manifest endpoint
curl http://localhost:3000/manifest.webmanifest | jq .

# Test Lighthouse budget (if e2e configured)
pnpm test:e2e -- performance.spec.ts
```

---

## Expected Outcomes

| Metric | Before | After | Gain |
|--------|--------|-------|------|
| Services Lighthouse score | 64 | 66–67 | +2–3 pts |
| Store Lighthouse score | 63 | 66–68 | +3–5 pts |
| LCP (avg) | 6.4s | 5.2s | **-1.2s** |
| FID (avg) | 120ms | 40ms | **-80ms** |
| Total JS (Services bundle) | 250 KB | 205 KB | -18% |
| Total JS (Store bundle) | 320 KB | 275 KB | -14% |
| PWA icon payload | 84 KB | 45 KB | -46% |

---

## Final Sign-Off

- [ ] All 5 wins implemented
- [ ] E2E tests pass
- [ ] Lighthouse scores ≥65 on both routes
- [ ] No visual regressions
- [ ] PR merged to main

**Estimated Total Time:** 5.5 hours  
**Estimated Score Gain:** +18 Lighthouse points (64→66–68)  
**Priority:** HIGH (closest to target, highest ROI)
