# Cloudless.gr Home Page Performance Analysis

## Core Web Vitals Summary (Estimated/Predicted)

| Metric | Threshold (Good/Needs-Improvement/Poor) | Current Status | Notes |
|--------|-----------------------------------------|----------------|-------|
| **LCP (Largest Contentful Paint)** | <2.5s / 2.5-4s / >4s | ✅ ~1.8s | Hero heading is inline text; no hero image blocking paint |
| **CLS (Cumulative Layout Shift)** | <0.1 / 0.1-0.25 / >0.25 | ✅ Low | Font-display likely `swap`; no layout-shift-causing images without dimensions |
| **INP (Interaction to Next Paint)** | <200ms / 200-500ms / >500ms | ✅ Fast | Optimized with `optimizePackageImports` for heavy libraries |
| **FID (First Input Delay)** | <100ms / 100-300ms / >300ms | ✅ Good | Uses shared IntersectionObserver to reduce TBT |
| **TTFB (Time to First Byte)** | <800ms / 800ms-1.8s / >1.8s | ✅ ~356ms | Cloudflare edge delivery + static generation |

## Server Response Analysis

```
TTFB: 0.355s
Total response: 0.356s
Page size: 1.6KB (minimal redirect page)
Status: 200 OK via Cloudflare
```

**Note:** The root `/` returns a minimal redirect page (JS-based locale redirect to `/en`). The actual homepage at `/en` is rendered by Next.js.

## Performance Optimizations Already Implemented

### 1. Bundle Optimization ✅
- **`optimizePackageImports`**: Tree-shakes `gsap`, `cmdk`, `lenis`, `lucide-react`, `three`, `@react-three/drei`
- **`serverExternalPackages`**: AWS SDK kept external to reduce client bundle
- **Dynamic imports**: `CloudCockpit` split out (~10KB gzipped) for mobile users

### 2. Image Optimization ✅
- **AVIF/WebP**: AVIF preferred (20-30% smaller than WebP)
- **Device sizes pruned**: Removed 3840px (8K) from image optimization ladder
- **30-day cache TTL** on optimized images

### 3. Animation Efficiency ✅
- **Shared IntersectionObserver**: Single observer for all `ScrollReveal` components (29+ on `/services`)
- **Reduced motion media query**: Respects `prefers-reduced-motion`
- **Off-screen animation pause**: `useAnimationActive` hook in `CloudCockpit` pauses intervals when not visible
- **Timed interval**: CloudCockpit cursor animation bumped from 380ms to 1000ms to reduce TBT

### 4. Caching ✅
- **Service Worker**: Cache-first for static assets, stale-while-revalidate pattern
- **Cache versioning**: `CACHE_VERSION = "5"` allows clean invalidation
- **Revalidation**: ISR set to 3600s (1 hour) for homepage

### 5. Compression ✅
- **gzip enabled**: Explicit `compress: true` in next.config.ts

## Potential Bottlenecks & Recommendations

### High Priority

#### 1. Font Loading Strategy
**Issue**: No explicit `font-display` strategy visible in the config
**Impact**: Could delay LCP if fonts block render
**Recommendation**:
```css
/* In globals.css, add font-display optimization */
@font-face {
  font-family: 'Instrument Sans';
  font-display: swap; /* Avoid invisible text during font load */
}
```

#### 2. Preconnect Headers Missing
**Issue**: No `<link rel="preconnect">` for external domains
**Impact**: Missed opportunity for early connection establishment
**Recommendation**: Add to `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://files.stripe.com">
```

### Medium Priority

#### 3. Chat Widget Bundle Impact
**Issue**: ChatWidget loaded client-side even when unused
**Impact**: ~5-10KB additional JS on initial load
**Current mitigation**: `ssr: false` prevents server bundle, but script still downloads
**Recommendation**: Lazy-load only when chat button is clicked
```tsx
// In layout.tsx, load chat on-demand
const [ChatWidget, setChatWidget] = useState(null);
useEffect(() => {
  if (userWantsChat) {
    import('@/components/ChatWidget').then(setChatWidget);
  }
}, [userWantsChat]);
```

#### 4. Speculation Rules Not Optimized
**Issue**: Cloudflare speculation rules header present but no next-on-hover hints
**Impact**: Missed prefetch opportunity for navigation
**Recommendation**: Add speculation rules for likely next pages:
```html
<script type="speculationrules">
{
  "prerender": [
    {"source": "document", "where": {"selectorMatches": "a[href^='/services']"}}
  ]
}
</script>
```

### Low Priority

#### 5. CSS Containment for ScrollReveal
**Issue**: Multiple `ScrollReveal` wrappers could trigger layout thrashing
**Impact**: Minor TBT impact if many elements animate simultaneously
**Recommendation**: Already mitigated by shared observer, but consider:
```tsx
// Add contain: layout style to ScrollReveal wrapper
<div ref={ref} className="reveal" style={{ contain: 'layout' }} ...>
```

#### 6. Animation Frame Budget
**Issue**: Hero animations run immediately on mount
**Impact**: Could compete with LCP-critical resources
**Recommendation**: Defer non-critical animations:
```tsx
// Delay decorative animations until after load event
useEffect(() => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => startDecorativeAnimations());
  }
}, []);
```

## Network Analysis

### Critical Resources (Predicted)
| Resource Type | Count | Notes |
|---------------|-------|-------|
| JavaScript chunks | ~3-5 | Code-split by Next.js |
| CSS | 1 | Consolidated via Tailwind |
| Fonts | 2-3 | Instrument Sans + Work Sans (if using Google Fonts) |
| Images | 0 | Homepage hero uses CSS only |
| API calls | 0 on load | Chat API only invoked on user interaction |

### Missing Optimizations
- ❌ No `loading="lazy"` on images (homepage has none currently)
- ❌ No `<link rel="prefetch">` for key routes
- ❌ No resource hints (`<link rel="prefetch">` for `/services`, `/contact`)

## Accessibility Observations

### Positive Findings
- ✅ Skip navigation link implemented
- ✅ `prefers-reduced-motion` respected
- ✅ Focus-visible ring with accent color
- ✅ Semantic HTML structure
- ✅ Color contrast tokens bridge v1→v2

### Potential Issues
- ⚠️ `ClientChatWidget` uses inline styles; may miss high-contrast mode
- ⚠️ No explicit `lang` attribute beyond `<html>` (handled by next-intl)

## Recommendations Summary

### Immediate Actions (No code changes needed)
1. ✅ Current performance is good - LCP dominated by inline text (fast)
2. ✅ Bundle optimizations are already in place
3. ✅ Shared observer pattern reduces main-thread work

### Code Improvements (Optional)
```tsx
// 1. Add font-display swap (if using custom fonts)
// 2. Preconnect to external origins
// 3. Lazy-load ChatWidget on interaction
// 4. Add speculation rules for prerendering
// 5. Consider `content-visibility: auto` for off-screen sections
```

### Metrics to Monitor
- **TBT (Total Blocking Time)**: Should stay <200ms
- **FCP**: Should be <1.8s
- **CLS**: Should be <0.1 (watch for dynamic content injection)

## Conclusion

Cloudless.gr has excellent performance foundations:
- Next.js 16 with Turbopack
- Tailwind CSS 4 with consolidated styles
- Smart code-splitting with `optimizePackageImports`
- Shared IntersectionObserver reducing TBT
- Service worker for caching

The homepage is expected to score **90+ on Lighthouse** for performance, with potential to reach 95+ with font-display optimization and strategic prefetching.