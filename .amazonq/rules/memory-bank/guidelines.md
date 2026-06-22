# Guidelines: cloudless.gr Development Patterns

## Code Quality Standards

### TypeScript

- Strict mode everywhere (`strict: true`, `noEmit: true`)
- `moduleResolution: "bundler"` — do not use `node16`/`nodenext`
- Absolute imports via `@/` alias (maps to `src/`) — always prefer over relative paths for `src/` code
- No `any` except at integration boundaries (cast with a narrow type alias immediately after)
- Readonly props: use `readonly` on destructured props in components and `ReadonlyArray<T>` for arrays that should not be mutated
- Export interface/type for all non-trivial shapes; inline only for one-off props

### Naming Conventions

- Files: `kebab-case.ts`, `PascalCase.tsx` for components
- Functions/variables: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE` for module-level config/threshold values
- Private/internal helpers: prefix with `_` underscore (e.g. `_esphome_post`, `_dispatch_command`)
- Test constants at top of file: named constants instead of magic strings (e.g. `const PAGE_ID = "page-1"`)

### File-Level Structure

1. JSDoc module comment (optional but used on complex files)
2. Imports (external → internal `@/` → relative)
3. Module-level constants (`SCREAMING_SNAKE_CASE`)
4. Types/interfaces
5. Internal helper functions (unexported)
6. Exported functions / default export

### Section Separators

Use `// ── Section Name ──────────────────────────────────────────────────` (em-dash + trailing dashes) to visually separate major sections within a file. Seen in both TypeScript and Python files:

```ts
// ── Types ────────────────────────────────────────────────────────────────────
// ── Helper components ─────────────────────────────────────────────────────────
// ── Fetcher helper ───────────────────────────────────────────────────────────
```

---

## API Route Patterns

### Route Handler Structure (`src/app/api/**/route.ts`)

```ts
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // 1. Parse/validate input early — return 400 on invalid
  const body = await request.text(); // or .json()

  // 2. Load config from SSM
  const config = await getConfig();

  // 3. Authenticate / verify signatures before any processing
  if (!signature) return Response.json({ error: "..." }, { status: 400 });

  // 4. Business logic in extracted async functions
  try {
    await handleEvent(event);
  } catch (err) {
    // 5. Map integration errors first
    const integrationResponse = mapIntegrationError(err);
    if (integrationResponse) return integrationResponse;
    // 6. Sentry capture on handler errors (dynamic import, fire-and-forget)
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      await import("@sentry/nextjs").then(({ captureException }) =>
        captureException(err)
      ).catch(() => {});
    }
    return Response.json({ error: "..." }, { status: 500 });
  }

  return Response.json({ received: true });
}
```

### Key API Route Conventions

- Always use `Response.json()` (not `NextResponse.json()`) for response creation
- SSM config loaded via `await getConfig()` — never read secrets from `process.env` directly in production routes
- Fire-and-forget side effects (Slack, EspoCRM) call `.catch(() => {})` inline — they never fail the main response
- Webhook routes verify signatures **before** any payload processing
- `mapIntegrationError(err)` called first in every catch block — handles known AWS/Stripe/Slack errors uniformly
- Sentry: dynamic `import("@sentry/nextjs")` only when `NEXT_PUBLIC_SENTRY_DSN` is set; always `.catch(() => {})` to prevent Sentry from failing the route
- Checkout validation: Both POST (store) and GET (campaign) checkout routes redirect to the contact page with product/campaign context as URL params — no Stripe session is created. The contact form pre-fills the message with purchase context.
- Duplicate event detection for idempotency (see `persistStripeEvent` in webhook handler)

---

## React Component Patterns

### Client Components (`"use client"`)

- All admin dashboard pages are `"use client"` with data fetching via `fetchWithAuth`
- State organized by concern: data state, loading state (per-tab/section), error state, UI state
- Per-section loading/error state tracked with `Record<TabName, boolean>` and `Record<TabName, string | null>`

### Data Fetching in Client Components

```ts
// Pattern: lazy load — only fetch when tab is first visited
const [fetchedTabs, setFetchedTabs] = useState<Set<Tab>>(new Set());

useEffect(() => {
  if (!fetchedTabs.has(tab)) {
    fetchers[tab]();
  }
}, [tab, fetchedTabs, ...fetchers]);

// Pattern: reset fetched cache when filter changes (use ref to avoid mount trigger)
const prevDaysRef = useRef<number>(days);
useEffect(() => {
  if (prevDaysRef.current !== days) {
    prevDaysRef.current = days;
    setFetchedTabs(new Set());
  }
}, [days]);
```

### useState Initialization

- Use lazy initializer `useState(() => expensiveComputation())` to avoid SSR/mount issues
- For localStorage reads: guard with `typeof window === "undefined"` before accessing

### useCallback/useMemo

- Wrap fetch functions in `useCallback` with correct `[deps]` array
- Use `useMemo` for derived values (e.g. `presetForDays(days)`)

### Component Props

- Always use `readonly` for destructured props
- Prefer small focused sub-components over monolithic render — extract tab components, card components, state components
- Loading/error/empty states are dedicated components: `LoadingState`, `ErrorState`

### Promise.allSettled for Parallel Fetches

```ts
const [seoRes, webRes] = await Promise.allSettled([
  fetchWithAuth("/api/admin/analytics/seo"),
  fetchWithAuth("/api/admin/analytics/web"),
]);
// Check .status === "fulfilled" before accessing .value
```

---

## Testing Patterns

### Test File Structure

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 1. Module-level test constants (avoid magic strings)
const PAGE_ID = "page-1";
const TEXT_HELLO_WORLD = "Hello world";

// 2. Global mocks (vi.stubGlobal / vi.fn())
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// 3. describe blocks mirror the module's public API
describe("module-name — Description", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("functionName", () => {
    it("does the expected thing", async () => { ... });
    it("handles edge case", async () => { ... });
  });
});
```

### Dynamic Imports in Tests

Modules are imported **inside test bodies** to pick up mocked globals:

```ts
it("sends correct headers", async () => {
  const { notionFetch } = await import("@/lib/notion");
  await notionFetch("/pages/123");
  ...
});
```

This ensures `vi.stubGlobal("fetch", mockFetch)` is in effect when the module initializes.

### Mock Patterns

- `vi.fn()` for function mocks
- `vi.stubGlobal()` for globals (`fetch`, `setTimeout`)
- `vi.spyOn(globalThis, "setTimeout")` to make timers synchronous in retry tests
- `vi.clearAllMocks()` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach` for spy tests
- Never mock the module under test — mock its dependencies (external calls)

### Test Coverage Conventions

- Test both happy path and error/edge cases for every exported function
- Pagination tests: verify cursor is passed in subsequent calls
- Error tests: HTTP 4xx/5xx, parse failures, retry exhaustion
- Side effects (PATCH/POST calls): inspect `mockFetch.mock.calls[0][1]` for method and body

---

## Library Module Patterns (`src/lib/`)

### Self-Contained Modules

Scripts that need portability (e.g. `scripts/article-quality-gates.ts`) are explicitly kept self-contained:

```ts
// Self-contained: reads no src/lib/* (kept as a sibling script module so
// the cron tooling stays portable).
```

### Constants as Single Source of Truth

```ts
export const WORD_MIN = 700;    // exported so tests and consumers share the value
export const WORD_MAX = 1400;
export const MIN_CRITIC_SCORE = 7.0;
```

### Discriminated Union Return Types

Complex multi-outcome functions return discriminated unions:

```ts
export type AutoPromoteVerdict =
  | { promote: true; gates: GateResult[]; critic: CriticResponse }
  | { promote: false; reason: "deterministic" | "critic" | "critic_unavailable"; gates: GateResult[]; critic?: CriticResponse; criticError?: string };
```

### Robust JSON Parsing

LLM/external JSON: try strict parse first, then extract largest `{...}` block as fallback:

```ts
export function parseCriticJson(raw: string): CriticResponse {
  try { return JSON.parse(raw); } catch {
    const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error(`Not parseable: ${raw.slice(0, 300)}`);
  }
}
```

### Error Propagation

- Functions that do I/O: throw on unrecoverable errors, return `null`/`false`/`[]` on expected failures (missing config, 404s)
- Callers decide whether to surface or swallow
- Never silently swallow unexpected errors at lib level

---

## Python / Infrastructure Patterns (FastAPI on Pi)

### Route Module Pattern

```python
router = APIRouter()  # Router defined at module level, included in main.py
```

### Pydantic Input Models

All route inputs use Pydantic `BaseModel`:

```python
class CommandIn(BaseModel):
    action: str
    value: Any | None = None
```

### Async HTTP with httpx

```python
async with httpx.AsyncClient(timeout=CMD_TIMEOUT) as client:
    r = await client.post(url, data=params)
return r.status_code == 200
```

Private helpers prefixed with `_`: `_esphome_post`, `_esphome_get`, `_dispatch_command`

### Error Handling in FastAPI

```python
raise HTTPException(status_code=400, detail=f"Unknown command: {action!r}")
raise HTTPException(status_code=502, detail="ESPHome did not acknowledge")
```

### Background Tasks for Long Operations

```python
async def esp32_ota(body: OtaIn, background_tasks: BackgroundTasks):
    background_tasks.add_task(_do_ota)
    return {"ok": True, "message": "OTA triggered — device will reboot after flashing (~30 s)"}
```

OTA endpoint returns immediately; actual HTTP call is in background task.

### Environment-Based Config

```python
ESPHOME_BASE = os.getenv("ESPHOME_URL", "http://192.168.1.201:9101")
```

---

## Tailwind CSS / Design System Conventions

### Custom Design Tokens (from admin pages)

- `font-mono` — monospace labels, table data, badges, metric values
- `font-heading` — section headings
- `font-body` — paragraph text
- Custom colors: `text-neon-magenta`, `text-neon-cyan`, `text-neon-green`, `bg-void-light/50`, `bg-void-lighter/30`
- Badge pattern: `bg-neon-magenta/10 border-neon-magenta/20 text-neon-magenta rounded-full border px-3 py-1.5 font-mono text-xs`
- Active tab: `bg-neon-magenta/10 text-neon-magenta border-neon-magenta/20 border`
- Inactive tab: `border border-slate-800 text-slate-500 hover:border-slate-700 hover:text-white`
- Table row hover: `hover:bg-void-lighter/30 transition-colors`
- Card container: `bg-void-light/50 rounded-xl border border-slate-800 p-4`
- Loading spinner: `border-neon-magenta h-6 w-6 animate-spin rounded-full border-2 border-t-transparent`

### Accessibility

- Interactive filter groups: `role="group" aria-label="..."` on container
- Buttons: `aria-pressed` for toggle state, `aria-label` on icon-only buttons
- Tables: proper `<thead>/<tbody>`, `<th>` elements with scope implied

---

## i18n Patterns

### Server Components

```ts
import { getServerLocale } from "@/lib/server-locale";
const locale = await getServerLocale();
const label = translate(locale, "section.key", "Fallback string");
```

### Client Components

```ts
import { useCurrentLocale } from "@/lib/use-locale";
const locale = useCurrentLocale();
```

### Translation Keys

- Add to both `src/locales/en.json` and `src/locales/el.json` (and fr/de for full parity)
- The `locales-parity.test.ts` test enforces all four locale files have matching keys — CI will fail if parity breaks

---

## Security Patterns

### Webhook Signature Verification

Always verify before processing payload:

```ts
// Stripe
event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

// Slack (HMAC-SHA256)
await verifySlackSignature(request, signingSecret);

// Notion
crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(expectedSecret));
```

### HTML Escaping

Use `escapeHtml()` from `@/lib/escape-html` for all user-controlled data rendered in HTML email bodies.

### JWT Validation

`src/lib/api-auth.ts` validates Bearer JWTs against the Cognito JWKS endpoint, enforcing `issuer`, `audience`, and group claims. All admin API routes call this before processing.

### Rate Limiting

`src/lib/rate-limit.ts` provides IP-based rate limiting. Applied to public-facing endpoints like `/api/unsubscribe` (5 req/IP/min).

---

## Commit / PR Conventions

- Conventional Commits style implied by `pr-labeler.yml` auto-labeling
- PRs auto-labeled by size and file paths via `labeler.yml`
- `CODEOWNERS` enforces review requirements
- `dependabot.yml` manages dependency updates automatically
- `stale.yml` closes stale issues/PRs
