# Skill: Cloudless Client-Side State & Context Architecture

## When to use this skill

Load this skill when working on components that consume any of the contexts below, when adding new client components to the root layout, or when debugging hydration mismatches.

---

## 1. AuthContext (`src/context/AuthContext.tsx`)

- `isLoading` starts as `true` on **both** SSR and first client render.
- Navbar renders nothing while loading: `{!isLoading && <NavbarContent />}`.
- Auth check runs inside `useEffect` via Cognito Amplify (lazy-imported to avoid 2 MB bundle on SSR).
- **Hydration safe:** server snapshot = `{ isLoading: true, user: null }`, client snapshot on first render = same.

---

## 2. CartContext (`src/context/CartContext.tsx`)

- Initial state: `{ items: [], isOpen: false }`.
- `localStorage` hydration happens in `useEffect` (key: `"cloudless-cart"`).
- `totalItems` and `totalPrice` are derived — both start at `0`.
- CartButton badge is conditionally rendered: only shown when `totalItems > 0`.
- **Hydration safe:** server and client agree on empty initial state.

---

## 3. CookieConsentContext (`src/context/CookieConsentContext.tsx`)

- Introduces a `mounted` boolean; banner visibility is gated: `visibleBannerOnClient = state.mounted ? state.bannerVisible : false`.
- `CookieConsent` component returns `null` until after first paint (mounted = false on server).
- `GoogleAnalyticsConsent` always returns `null` — it only fires `useEffect` side effects (script injection).

---

## 4. Theme system (`src/lib/theme-pref.ts`)

- `useStoredPref()` uses `useSyncExternalStore`:
  - `getServerSnapshot = () => null`
  - `getSnapshot` reads from `localStorage`
- **E2E tests / empty localStorage:** client snapshot is also `null` — no mismatch.
- **Real users with a stored pref:** client snapshot differs from server `null` on first render → SVG icon element mismatch (not text).
- Fix if needed: add `suppressHydrationWarning` to the icon container inside `ThemeSwitcher`.

---

## 5. Locale system (`src/lib/use-locale.ts`, `src/lib/i18n.ts`)

- `useCurrentLocale()` wraps `useLocale()` from next-intl — reads from `NextIntlClientProvider` context.
- Locale is set by middleware and passed as `locale` prop to `NextIntlClientProvider` — always consistent SSR ↔ client.
- `translate(locale, key, fallback)` is a plain dictionary lookup — fully deterministic, no hydration risk.
- **Navigation rule:** always import `Link`, `useRouter`, `usePathname`, `redirect` from `@/i18n/navigation`, never from `next/link` or `next/navigation`. The app uses `localePrefix: "always"`.

---

## 6. Root layout component order (`src/app/[locale]/layout.tsx`)

```
NextIntlClientProvider
  AuthProvider
    CartProvider
      CookieConsentProvider
        GoogleAnalyticsConsent   ← null render, useEffect only
        JsonLd                   ← server component
        TrainingBanner           ← useState(false) + useEffect defer
        Navbar                   ← renders nothing while isLoading
        <main>{children}</main>
        Footer
        CartSlideOver            ← dynamic, SSR default; safe (state starts empty)
        ServiceWorkerRegistration
        ClientDecorators         ← dynamic({ ssr: false })
        CookieConsent            ← null until mounted
        ChatWidget               ← dynamic({ ssr: false }) — was source of React #418
```

---

## 7. Rules for new client components in the layout

| Scenario | Solution |
|---|---|
| Uses `crypto.randomUUID()`, `Math.random()`, `Date.now()` **in render** | `dynamic(..., { ssr: false })` |
| Reads `localStorage`, `sessionStorage`, `window.*`, `document.*` **in render** | `useState(false) + useEffect` mount guard |
| Only fires `useEffect` side effects, renders `null` | Safe to SSR as-is |
| Reads stable props or context (locale, auth) only | Safe to SSR as-is |
| Renders random/time-based content and cannot be deferred | `suppressHydrationWarning` on the specific element |

**React hydration error #418** is caused by a server/client DOM mismatch — most commonly from a component that reads browser APIs in the render phase without a mount guard. When in doubt, use `dynamic(..., { ssr: false })`.

---

## 8. Quick reference: context import paths

```ts
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useCookieConsent } from "@/context/CookieConsentContext";
import { useStoredPref } from "@/lib/theme-pref";
import { useCurrentLocale } from "@/lib/use-locale";
import { translate } from "@/lib/i18n";
// Navigation (always use these, never next/link or next/navigation):
import { Link, useRouter, usePathname, redirect } from "@/i18n/navigation";
```
