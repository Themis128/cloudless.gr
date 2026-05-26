# Next.js App Router — SSR/Hydration Patterns

Reference guide for avoiding React hydration mismatches in this codebase.

---

## 1. React Error #418 — What It Means

**Hydration mismatch**: the HTML the server rendered does not match what React produces on the first client render. React bails out and throws error #418.

URL format in the console:
```
https://react.dev/errors/418?args[]=text&args[]=
```

**When it fires:**
- A component reads browser-only state (`window`, `localStorage`, `matchMedia`) during render
- `useState` initializer calls a non-deterministic function (`Math.random()`, `Date.now()`, `crypto.randomUUID()`)
- `useSyncExternalStore` returns a different value on server vs. first client render
- A `dynamic()` import renders on the server when the component uses client-only APIs

---

## 2. Three Safe Patterns for Deferring Client-Only Rendering

### Pattern A — `useState(false) + useEffect`

Use when the component must render nothing (or a stable placeholder) on the server.

```tsx
// ✅ Safe — server renders null, client renders after mount
export function MyWidget() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <div>{window.location.hostname}</div>;
}
```

### Pattern B — `dynamic(() => import(...), { ssr: false })`

Use for entire components with no SEO value (chat widgets, analytics scripts, banners).

```tsx
// ✅ Safe — component is skipped entirely during SSR
import dynamic from "next/dynamic";

const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
});
```

**`{ ssr: false }` is not optional.** Without it Next.js still SSR-renders the component, which defeats the purpose.

### Pattern C — Stable Initial State

Avoid non-deterministic values in the render phase or `useState` initializer.

```tsx
// ❌ Wrong — different value each render cycle
const [id] = useState(() => crypto.randomUUID());

// ✅ Correct — stable literal; assign real ID after mount if needed
const [id] = useState("initial-assistant-msg");

useEffect(() => {
  setId(crypto.randomUUID());
}, []);
```

---

## 3. What NOT to Do

### Reading browser APIs outside `useEffect`

```tsx
// ❌ Wrong — window doesn't exist on the server
function Banner() {
  const isLocal = window.location.hostname === "localhost";
  return isLocal ? <DevBanner /> : null;
}

// ✅ Correct
function Banner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(window.location.hostname === "localhost");
  }, []);
  return show ? <DevBanner /> : null;
}
```

If you must read a browser API outside `useEffect`, guard with a `typeof` check:

```tsx
const isClient = typeof window !== "undefined";
```

### `useSyncExternalStore` with mismatched snapshots

```tsx
// ❌ Wrong — getServerSnapshot returns "" but getSnapshot returns
//    the real sessionStorage value on first client render → mismatch
useSyncExternalStore(
  subscribe,
  () => sessionStorage.getItem("banner-dismissed") ?? "false",
  () => "",   // server snapshot
);

// ✅ Correct — use useState + useEffect instead
const [dismissed, setDismissed] = useState(false);
useEffect(() => {
  setDismissed(sessionStorage.getItem("banner-dismissed") === "true");
}, []);
```

### `dynamic()` without `{ ssr: false }` on a non-deterministic component

```tsx
// ❌ Wrong — Next.js SSR-renders this; crypto.randomUUID() fires on server
const ChatWidget = dynamic(() => import("@/components/ChatWidget"));

// ✅ Correct
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,
});
```

---

## 4. Project-Specific Fixes

### `ChatWidget`

**Problem:** `dynamic()` without `ssr: false` + `crypto.randomUUID()` in `useState` initializer.

**Fix:**
```tsx
// components/ChatWidget loaded via:
const ChatWidget = dynamic(() => import("@/components/ChatWidget"), {
  ssr: false,  // ← added
});

// Inside ChatWidget.tsx — initial message id:
// Before: useState(() => crypto.randomUUID())
// After:
const [messages, setMessages] = useState([
  { id: "initial-assistant-msg", role: "assistant", content: "..." },
]);
```

### `TrainingBanner`

**Problem:** `useSyncExternalStore` reading `sessionStorage` — server snapshot `""` differed from client snapshot on first render.

**Fix:** replaced `useSyncExternalStore` with `useState(false) + useEffect`:
```tsx
const [dismissed, setDismissed] = useState(false);
useEffect(() => {
  setDismissed(sessionStorage.getItem("training-banner") === "hidden");
}, []);
```

### `HubSpotScript`

**Problem:** `useSyncExternalStore` reading `window.location.hostname` — undefined on server.

**Fix:**
```tsx
const [shouldLoad, setShouldLoad] = useState(false);
useEffect(() => {
  setShouldLoad(window.location.hostname !== "localhost");
}, []);
```

---

## 5. `suppressHydrationWarning` Scope

`suppressHydrationWarning={true}` on an element **only** suppresses:
- Attribute differences on that element
- Text content differences of direct text children

It does **NOT** suppress mismatches in child elements. Do not use it as a catch-all.

```tsx
// ✅ Suppresses class/style attribute drift on <html>
<html lang="el" suppressHydrationWarning>

// ❌ Does NOT suppress a missing/extra child <div> inside
<div suppressHydrationWarning>
  <ConditionalChild />  {/* mismatch here still throws #418 */}
</div>
```

---

## 6. `useSyncExternalStore` Rules

`getServerSnapshot` must return the **same type and shape** as the initial value `getSnapshot` would return in a clean E2E environment (empty localStorage, no system theme set, no cookies).

| Scenario | `getServerSnapshot` | `getSnapshot` initial |
|---|---|---|
| Theme preference | `"light"` | `"light"` (default before media query runs) |
| localStorage flag | `false` | `false` (storage is empty) |
| window.location | not readable — use `useState+useEffect` instead | — |

When in doubt, prefer **Pattern A** (`useState + useEffect`) over `useSyncExternalStore` for browser-storage subscriptions. Reserve `useSyncExternalStore` for external stores that have a well-defined server-safe default.
