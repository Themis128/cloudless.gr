# Lighthouse Optimization — Technical Implementation Guide

**For developers:** Exact code changes, line numbers, and testing procedures for each of the 5 quick wins.

---

## Win #1: Extract Service Data (Bundle De-duplication)

### Symptom

`src/app/[locale]/services/page.tsx` is 1,184 lines. The `getServices()` and `getServicesFaqs()` functions (340 lines) contain static data that never changes and have zero dependencies on React components. They're loaded into the services JS bundle regardless of SSR caching.

### Root Cause

The functions are defined inline in the page component, so they're tree-shaken into the services JS chunk even if unused elsewhere.

### Fix: Extract to `src/lib/services-data.ts`

**Step 1:** Create new file `src/lib/services-data.ts`

```typescript
// src/lib/services-data.ts
export type ServiceColor = "cyan" | "magenta" | "green" | "blue";

// ── Service data ─────────────────────────────────────────────── 
export const getServices = (t: (key: string, fallback: string) => string) => [
  {
    tag: t("servicesSection.service1Tag", "CLOUD"),
    num: "01",
    title: t("servicesSection.service1Title", "Cloud Architecture & Migration"),
    price: "From €2,000",
    unit: t("servicesPage.perProject", "per project"),
    color: "cyan" as const,
    planKey: "cloud",
    outcome: t(
      "servicesPage.s1Outcome",
      "Typically saves €15K–€50K/year in infrastructure costs alone."
    ),
    perfectFor: t(
      "servicesSection.service1For",
      "For teams paying €500+/mo for infrastructure they can't explain."
    ),
    description: t(
      "servicesSection.service1Desc",
      "Design resilient, cost-optimised cloud infrastructure on AWS, GCP, or Azure. We handle architecture blueprints, zero-downtime migrations, and Infrastructure as Code — so your team ships faster with less risk."
    ),
    features: [
      "AWS / GCP / Azure architecture design",
      "Zero-downtime migration planning",
      "Cost optimization & right-sizing",
      "Security & compliance review",
      "Infrastructure as Code (Terraform / CDK)",
    ],
    stats: [
      { value: "99.99%", label: "Uptime SLA" },
      { value: "40-60%", label: "Cost Reduction" },
      { value: "Zero", label: "Downtime Migrations" },
      { value: "IaC", label: "First Approach" },
    ],
    terminal: [
      "$ cloudless infra plan --provider aws",
      "  ✓ VPC + subnets designed",
      "  ✓ ECS Fargate cluster configured",
      "  ✓ RDS Multi-AZ provisioned",
      "  ✓ CloudFront CDN attached",
      "  ✓ WAF rules applied",
      "  ---",
      "  status: ready to deploy",
      "  estimated cost: €420/mo",
    ],
  },
  // ... (copy remaining 5 services from line 107–331 of services/page.tsx)
];

export const getServicesFaqs = (t: (key: string, fallback: string) => string) => [
  {
    question: t("servicesPage.faq1Q", "How much will I actually save?"),
    answer: t(
      "servicesPage.faq1A",
      "Cloud Architecture projects typically save €15K–€50K/year in infrastructure costs. Serverless cuts hosting bills by up to 60–80%. The full bundle at €3,600/mo replaces €20K+ in salaries. The free audit gives you exact numbers for your specific setup."
    ),
  },
  // ... (copy remaining FAQs from line 342–373 of services/page.tsx)
];

export const colorMap: Record<ServiceColor, Record<string, string>> = {
  cyan: {
    badge: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    dot: "bg-neon-cyan",
    tag: "text-neon-cyan/60 bg-neon-cyan/5",
    stat: "border-neon-cyan/20 bg-neon-cyan/5",
    statValue: "text-neon-cyan",
    check: "text-neon-cyan",
    num: "bg-neon-cyan/10 border-neon-cyan/20 text-neon-cyan",
    price: "text-neon-cyan",
    link: "text-neon-cyan hover:text-white",
  },
  // ... (copy remaining colors from line 392–436 of services/page.tsx)
};

export const bundleTerminal = [
  "$ cloudless bundle --plan growth-engine",
  "  ✓ Cloud Architecture & Migration",
  "  ✓ Serverless Development",
  "  ✓ Data Analytics & Dashboards",
  "  ✓ AI & Digital Marketing",
  "  ✓ Web Design & Development",
  "  ✓ Managed Hosting & Maintenance",
  "  ---",
  "  total: €3,600/mo  (save 30%)",
  "  lock-in: none",
  "  guarantee: results in 14 days",
];
```

**Step 2:** Update `src/app/[locale]/services/page.tsx`

- Delete lines 40–387 (all `getServices`, `getServicesFaqs`, `colorMap` definitions)
- Add at the top:

```typescript
import { getServices, getServicesFaqs, colorMap, bundleTerminal } from "@/lib/services-data";
```

- Page now starts at line ~40 (the `Arrow` function)

**Step 3:** Verify no broken references

```bash
pnpm build 2>&1 | grep -i "services" | grep -E "error|undefined"
# Should be empty — if not, you missed a reference
```

**Step 4:** Test rendering

```bash
pnpm dev
# Open http://localhost:3000/en/services
# Visual inspection: all 6 service cards, colors, terminal blocks render correctly
```

**Step 5:** Measure bundle reduction

```bash
# Build and check JS chunk size
pnpm build
ls -lh .next/static/chunks/app*services*.js | tail -1
# Before: ~250 KB
# After: ~205 KB (goal: -45 KB = -18%)
```

---

## Win #2: Fix Locale Redirect Chain (Next.js Rewrites)

### Symptom

User hits `/services` on first visit. Browser sees 301 redirect to `/en/services`, adding 300–500ms round-trip latency. This is visible in Lighthouse trace as a gap between "Send Request" and first network activity.

### Root Cause

`src/app/services/page.tsx` uses `permanentRedirect("/en/services")` to enforce locale prefix. This is the **only way** to do SSR redirects in Next.js App Router, but it adds a network round-trip.

### Fix: Use Next.js Rewrites at the Edge

**Step 1:** Update `next.config.ts` (lines 107–111)

**Before:**

```typescript
nextConfig.rewrites = async () => ({
  beforeFiles: [{ source: "/manifest.webmanifest", destination: "/api/pwa-manifest" }],
  afterFiles: [],
  fallback: [],
});
```

**After:**

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

**Why this works:**

- `beforeFiles` rewrites happen at the Edge (Vercel's network), **before the browser sees a response**.
- User's browser receives a `200 OK` for `/services`, not a `301 redirect`.
- To the user, it's a single HTTP request. To Next.js, the actual route is `/en/services`.
- Metadata canonical links still point to `/services` (unchanged in page metadata).

**Step 2:** Keep the fallback route for non-GET requests

File `src/app/services/page.tsx` can stay as-is. It's a fallback for:

- POST requests (if any future API endpoint uses this path)
- Navigations from outside Next.js (e.g., old bookmarks)

It will be hit **rarely** now.

**Step 3:** Test the rewrite

```bash
# Start dev server
pnpm dev

# In a new terminal, test with curl (no browser caching)
curl -i http://localhost:3000/services
# Expected output:
#   HTTP/1.1 200 OK  (NOT 301 Found)
#   Content-Type: text/html; charset=utf-8
#   ... actual /en/services content

curl -i http://localhost:3000/en/services
# Should also return 200 OK with same content
```

**Step 4:** Verify metadata canonical

```bash
# The page should still advertise itself as /services for SEO
curl -s http://localhost:3000/services | grep -o '<link rel="canonical"[^>]*>'
# Expected: <link rel="canonical" href="https://cloudless.gr/services">
```

**Step 5:** Measure latency improvement

```bash
# Use DevTools Network tab or curl with time breakdown
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/services
# Before: TTFB ~500ms (includes redirect)
# After: TTFB ~150ms (no redirect overhead)
```

---

## Win #3: Compress ProductIcon SVGs (Static Asset Extraction)

### Symptom

`src/components/store/ProductIcon.tsx` defines 6 inline SVG icons as React components. Each is 2–3 KB of uncompressed JSX/SVG markup. The `/store` page renders 3+ cards, loading 6–15 KB of SVG code just to render 6 icons.

### Root Cause

SVG icons are defined as JavaScript functions, not static assets. They're bundled, not cached by the CDN, and they're parsed as JS before rendering.

### Fix: Extract SVGs to Static Files

**Step 1:** Create `public/icons/store/` directory

```bash
mkdir -p public/icons/store
```

**Step 2:** Extract each icon as an SVG file

**Example: `public/icons/store/cloud-audit.svg`** (from `CloudAuditIcon` in `ProductIcon.tsx` lines 11–76)

```xml
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Dashed orbit ring -->
  <circle cx="100" cy="95" r="52" fill="none" stroke="currentColor" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="4 4"/>
  <circle cx="100" cy="95" r="32" fill="currentColor" fill-opacity="0.06"/>
  <!-- Cloud shape -->
  <rect x="72" y="78" width="56" height="30" rx="15" fill="currentColor" fill-opacity="0.1" stroke="currentColor" stroke-opacity="0.5" stroke-width="1.5"/>
  <!-- Nodes inside cloud -->
  <circle cx="88" cy="90" r="4" fill="currentColor" fill-opacity="0.8"/>
  <circle cx="100" cy="86" r="3" fill="currentColor" fill-opacity="0.5"/>
  <circle cx="112" cy="93" r="3.5" fill="currentColor" fill-opacity="0.6"/>
  <line x1="92" y1="90" x2="100" y2="86" stroke="currentColor" stroke-opacity="0.4" stroke-width="1"/>
  <line x1="100" y1="86" x2="112" y2="93" stroke="currentColor" stroke-opacity="0.3" stroke-width="1"/>
  <!-- Magnifier -->
  <circle cx="135" cy="80" r="10" fill="none" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5"/>
  <line x1="142" y1="87" x2="150" y2="95" stroke="currentColor" stroke-opacity="0.6" stroke-width="1.5"/>
  <!-- Corner brackets -->
  <path d="M55 55 h12" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
  <path d="M55 55 v12" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
  <path d="M145 135 h-12" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
  <path d="M145 135 v-12" stroke="currentColor" stroke-opacity="0.3" stroke-width="1.5" fill="none"/>
  <!-- Orbiting dots -->
  <circle cx="60" cy="80" r="3" fill="currentColor" fill-opacity="0.2"/>
  <circle cx="75" cy="55" r="2.5" fill="currentColor" fill-opacity="0.3"/>
  <circle cx="130" cy="55" r="2" fill="currentColor" fill-opacity="0.25"/>
  <circle cx="145" cy="110" r="3" fill="currentColor" fill-opacity="0.15"/>
  <circle cx="65" cy="120" r="2.5" fill="currentColor" fill-opacity="0.2"/>
</svg>
```

**Key change:** Replace `{color}` interpolations with `currentColor`. This lets CSS `color` property control the SVG stroke/fill at runtime.

**Repeat for:** `lambda.svg`, `analytics.svg`, `dlc.svg`, `web-design.svg`, `hosting.svg`

**Step 3:** Minify all SVGs

```bash
pnpm add -D svgo

# Minify in place
svgo --multipass public/icons/store/*.svg
# Should reduce each file by ~30–40% (removes whitespace, optimizes paths)
```

**Step 4:** Rewrite `ProductIcon.tsx`

**Before:** ~200 lines of React component definitions  
**After:**

```typescript
"use client";

import type { ProductCategory } from "@/lib/store-products";

const accentColors: Record<ProductCategory, string> = {
  service: "#00fff5",
  digital: "#ff00ff",
  physical: "#00ff41",
};

// Map product IDs to icon file paths
const iconMap: Record<string, string> = {
  cloud_audit: "/icons/store/cloud-audit.svg",
  lambda: "/icons/store/lambda.svg",
  analytics: "/icons/store/analytics.svg",
  dlc: "/icons/store/dlc.svg",
  web_design: "/icons/store/web-design.svg",
  hosting: "/icons/store/hosting.svg",
};

export default function ProductIcon({
  productId,
  category,
}: {
  productId: string;
  category: ProductCategory;
}) {
  const iconPath = iconMap[productId] || "/icons/store/generic.svg";
  const color = accentColors[category];

  return (
    <svg
      as="img"
      src={iconPath}
      alt=""
      className="h-full w-full"
      style={{ color }}
    />
  );
}
```

**Wait, that's not quite right** — you can't `src` an `<svg>` tag. Instead:

```typescript
"use client";

import Image from "next/image";
import type { ProductCategory } from "@/lib/store-products";

const accentColors: Record<ProductCategory, string> = {
  service: "#00fff5",
  digital: "#ff00ff",
  physical: "#00ff41",
};

const iconMap: Record<string, string> = {
  cloud_audit: "/icons/store/cloud-audit.svg",
  lambda: "/icons/store/lambda.svg",
  analytics: "/icons/store/analytics.svg",
  dlc: "/icons/store/dlc.svg",
  web_design: "/icons/store/web-design.svg",
  hosting: "/icons/store/hosting.svg",
};

export default function ProductIcon({
  productId,
  category,
}: {
  productId: string;
  category: ProductCategory;
}) {
  const iconPath = iconMap[productId] || "/icons/store/generic.svg";
  const color = accentColors[category];

  return (
    <div
      className="h-full w-full"
      style={{
        backgroundImage: `url(${iconPath})`,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        filter: `brightness(0) saturate(100%) invert(${color === "#00fff5" ? "1" : "0"})`,
      }}
      aria-label={`Icon for ${productId}`}
    />
  );
}
```

**Or, simplest approach: Load SVG as `<img>` with CSS filter:**

```typescript
"use client";

import type { ProductCategory } from "@/lib/store-products";

const accentColors: Record<ProductCategory, string> = {
  service: "#00fff5",    // cyan
  digital: "#ff00ff",    // magenta
  physical: "#00ff41",   // green
};

const iconMap: Record<string, string> = {
  cloud_audit: "/icons/store/cloud-audit.svg",
  lambda: "/icons/store/lambda.svg",
  analytics: "/icons/store/analytics.svg",
  dlc: "/icons/store/dlc.svg",
  web_design: "/icons/store/web-design.svg",
  hosting: "/icons/store/hosting.svg",
};

export default function ProductIcon({
  productId,
  category,
}: {
  productId: string;
  category: ProductCategory;
}) {
  const iconPath = iconMap[productId] || "/icons/store/generic.svg";

  return (
    <img
      src={iconPath}
      alt=""
      className="h-full w-full"
      style={{ colorScheme: "light" }}
    />
  );
}
```

**For color animation**, add a CSS filter to match the category accent color. Since the SVGs now use `currentColor`, you can apply a hue rotation or color-dodge filter:

```typescript
// Add to style object:
style={{
  colorScheme: "light",
  // Optional: recolor SVG to match category if original color doesn't match
  filter: category === "service" ? "hue-rotate(180deg)" : "none",
}}
```

**Step 5:** Test visual rendering

```bash
pnpm dev
# Load http://localhost:3000/en/store
# Visual inspection: all 3+ product cards render icons with correct colors
# Icon should fill the 4:3 aspect ratio box (aspect-[4/3])
```

**Step 6:** Verify bundle reduction

```bash
pnpm build
ls -lh public/icons/store/
# Should be ~5–8 KB total (minified SVGs, not JS)

du -sh .next/static/chunks/app*store*.js | tail -1
# Before: ~320 KB
# After: ~275 KB (goal: -45 KB = -14%)
```

---

## Win #4: Defer Non-Critical JS with `requestIdleCallback()`

### Symptom

The `/services` page renders:

- 6 `TerminalBlock` components (2 KB JS each = 12 KB)
- 24 `StatCounter` components (0.5 KB JS × 24 = 12 KB)
- FAQ accordion (3 KB JS)

These are all **below the fold** on mobile and don't contribute to LCP. They're parsed and executed synchronously, blocking FID.

### Root Cause

All components are imported and rendered in the same component tree. Next.js can't tree-shake them because they're in the JSX.

### Fix: Lazy-Load with `requestIdleCallback()`

**Step 1:** Create `src/components/DeferredRender.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";

interface DeferredRenderProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Defers rendering of children until the browser is idle (via requestIdleCallback).
 * Renders a fallback placeholder while waiting.
 * 
 * Use for below-the-fold, non-interactive content that doesn't affect LCP/FID.
 * 
 * @example
 * <DeferredRender fallback={<div className="h-24 bg-gray-200 rounded" />}>
 *   <ExpensiveComponent />
 * </DeferredRender>
 */
export function DeferredRender({ children, fallback }: DeferredRenderProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ("requestIdleCallback" in window) {
      // Use requestIdleCallback if available (supported in all modern browsers)
      requestIdleCallback(() => setReady(true), { timeout: 2000 });
    } else {
      // Fallback for very old browsers: defer with setTimeout
      const timer = setTimeout(() => setReady(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  return ready ? children : (fallback ?? <div className="h-24 bg-void-light/30 rounded" />);
}
```

**Step 2:** Update `src/app/[locale]/services/page.tsx`

Add import at the top (after other imports):

```typescript
import { DeferredRender } from "@/components/DeferredRender";
```

**Wrap TerminalBlock** (around line 743):

```typescript
// Before:
<TerminalBlock
  lines={service.terminal}
  title={`cloudless-cli — ${service.tag.toLowerCase()}`}
/>

// After:
<DeferredRender>
  <TerminalBlock
    lines={service.terminal}
    title={`cloudless-cli — ${service.tag.toLowerCase()}`}
  />
</DeferredRender>
```

**Wrap stat grid** (around line 749):

```typescript
// Before:
<div className="grid grid-cols-2 gap-3">
  {service.stats.map((stat) => (
    <StatCounter
      key={stat.label}
      value={stat.value}
      label={stat.label}
      valueClassName={`font-mono text-xl font-bold ${colors.statValue}`}
      showLabel={false}
    />
  ))}
</div>

// After:
<DeferredRender>
  <div className="grid grid-cols-2 gap-3">
    {service.stats.map((stat) => (
      <StatCounter
        key={stat.label}
        value={stat.value}
        label={stat.label}
        valueClassName={`font-mono text-xl font-bold ${colors.statValue}`}
        showLabel={false}
      />
    ))}
  </div>
</DeferredRender>
```

**Wrap FAQ section** (around line 1119):

```typescript
// Before:
<div className="space-y-4">
  {servicesFaqs.map((faq, i) => (
    <ScrollReveal key={i} delay={i * 80}>
      <details className="...">
        ...
      </details>
    </ScrollReveal>
  ))}
</div>

// After:
<DeferredRender>
  <div className="space-y-4">
    {servicesFaqs.map((faq, i) => (
      <ScrollReveal key={i} delay={i * 80}>
        <details className="...">
          ...
        </details>
      </ScrollReveal>
    ))}
  </div>
</DeferredRender>
```

**Step 3:** Test with Lighthouse throttling

```bash
pnpm dev

# Use Chrome DevTools Performance tab:
# 1. Open http://localhost:3000/en/services
# 2. Open DevTools > Performance
# 3. Enable CPU throttling (6x slowdown) and Network throttling (Slow 4G)
# 4. Record a page load
# 5. Mark where LCP fires (green line labeled "Largest Contentful Paint")
# 6. Verify TerminalBlock and FAQ components load AFTER LCP fires

# Or use Lighthouse CLI:
pnpm lighthouse https://localhost:3000/en/services \
  --throttle-method=provided \
  --throttle-cpu-slowdown=6

# Expected: LCP unchanged, FID improves by ~50–100ms
```

**Step 4:** Verify no visual jarring

- Manual test on slow network (DevTools throttling)
- FAQ section should show gray placeholder while loading
- Placeholder should be roughly same height as final content (so layout doesn't shift)

---

## Win #5: Optimize Icon Assets to WebP

### Symptom

`public/icons/icon-192.png`, `icon-512.png`, `icon-512-maskable.png` are 28 KB each (84 KB total). These are only used in the PWA manifest, but they're still downloaded by PWA installers.

### Root Cause

PNG format is older and less efficient than modern WebP. A 512×512 PNG with simple colors can be 50–60% smaller in WebP format.

### Fix: Convert to WebP with PNG Fallback

**Step 1:** Install WebP encoder

```bash
# macOS
brew install webp

# Ubuntu/Debian
sudo apt-get install webp

# Or use a Node.js tool
pnpm add -D imagemin imagemin-webp
```

**Step 2:** Convert PNG icons

```bash
cwebp -q 90 public/icons/icon-192.png -o public/icons/icon-192.webp
cwebp -q 90 public/icons/icon-512.png -o public/icons/icon-512.webp
cwebp -q 90 public/icons/icon-512-maskable.png -o public/icons/icon-512-maskable.webp

# Verify file sizes
ls -lh public/icons/icon-*.webp
# Expected: ~12–15 KB each (down from 28 KB)
```

**Step 3:** Update manifest generation

File: `src/app/api/pwa-manifest/route.ts`

Update to include WebP with PNG fallback:

```typescript
export async function GET() {
  const icons = [
    // WebP first (modern browsers)
    { src: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp" },
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, // fallback
    
    { src: "/icons/icon-512.webp", sizes: "512x512", type: "image/webp" },
    { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    
    { src: "/icons/icon-512-maskable.webp", sizes: "512x512", type: "image/webp", purpose: "maskable" },
    { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ];

  const manifest = {
    name: "Cloudless",
    short_name: "Cloudless",
    description: "Cloud computing, serverless & AI marketing",
    start_url: "/",
    scope: "/",
    display: "standalone",
    theme_color: "#0a7785",
    background_color: "#0a0e27",
    orientation: "portrait-primary",
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=31536000", // Cache for 1 year
    },
  });
}
```

**Step 4:** Update layout metadata (if explicitly listing icons)

File: `src/app/layout.tsx` (lines 67–69)

**Before:**

```typescript
icons: {
  apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
},
```

**After:**

```typescript
icons: {
  apple: [
    { url: "/icons/icon-192.webp", sizes: "192x192", type: "image/webp" },
    { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
},
```

**Step 5:** Verify manifest endpoint

```bash
curl http://localhost:3000/manifest.webmanifest | jq .icons
# Should output:
# [
#   { "src": "/icons/icon-192.webp", "sizes": "192x192", "type": "image/webp" },
#   { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
#   ...
# ]
```

**Step 6:** Test PWA install

```bash
# Open DevTools > Application > Manifest
# Should show all icons listed (WebP + PNG)
# WebP should be ~50% smaller than PNG in file listing
```

---

## Testing Checklist

### Local Testing

```bash
# After each win, verify nothing breaks:
pnpm dev
# Load both /en/services and /en/store
# Check browser console for errors
# Test interactive features: buttons, forms, modals

# Win #1: Bundle size
pnpm build && du -sh .next/static/chunks/app*services*.js

# Win #2: No redirects
curl -i http://localhost:3000/services | head -10

# Win #3: SVG icons
# Visual inspection of /en/store, all 3+ product cards render
curl http://localhost:3000/public/icons/store/cloud-audit.svg | wc -c
# Should be <2 KB (minified)

# Win #4: Deferred rendering
# Open DevTools > Performance, throttle 6x CPU, record page load
# Mark LCP, verify TerminalBlock loads after

# Win #5: WebP icons
ls -lh public/icons/icon-*.webp
# Should be ~15 KB each (vs 28 KB PNG)
```

### Lighthouse Testing

```bash
# Install Lighthouse CLI if needed
npm install -g @lhci/cli@latest

# Run audit on both routes
lighthouse https://localhost:3000/en/services --output=json --chrome-flags="--headless --disable-device-emulation"
lighthouse https://localhost:3000/en/store --output=json --chrome-flags="--headless --disable-device-emulation"

# Parse results
# Expected improvement: +1.2–1.8 seconds LCP, +4–18 Lighthouse points
```

### CI Validation

```bash
# Run E2E tests to catch regressions
pnpm test:e2e

# Check lighthouse-budget.json thresholds
# Should pass with new timings
pnpm test:performance
```

---

## Rollback Plan

If any win introduces regressions:

### Win #1: Undo service data extraction

```bash
git revert <commit-hash>
# Or: manually restore services/page.tsx from Git history
```

### Win #2: Undo rewrites

```bash
# Revert next.config.ts to original rewrites
# Users on old cached 301s will still redirect (safe), new users see correct URLs
```

### Win #3: Undo ProductIcon changes

```bash
# If SVG color filters don't work, revert to inline React components
# Temporarily accept higher bundle size
```

### Win #4: Undo DeferredRender

```bash
# Remove <DeferredRender> wrappers, restore inline TerminalBlock/FAQ
# No API changes, fully backward compatible
```

### Win #5: Undo WebP conversion

```bash
# Delete .webp files, keep .png as primary in manifest
# WebP support is 95%+ anyway, no breakage
```

---

## Summary

| Win | Lines Changed | Files Modified | Complexity | Testing Time |
|-----|---|---|---|---|
| #1 | +100 | 2 | Low | 15 min |
| #2 | +2 | 1 | Low | 10 min |
| #3 | -150 | 8 | Low | 20 min |
| #4 | +30 | 2 | Med | 30 min |
| #5 | +20 | 2 | Low | 15 min |
| **TOTAL** | **+~100 net** | **7** | **Low–Med** | **90 min** |

**Expected Lighthouse gain:** +18 points (64→66–68)  
**Expected latency gain:** 1.2–1.8 seconds (LCP 6.4s→5.2s)  
**Bundle reduction:** -90 KB (8% overall)
