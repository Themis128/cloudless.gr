---
name: api-security-audit
description: Audit and fix security vulnerabilities in Next.js API route handlers. Covers the most common classes found in this codebase: missing await on async auth guards, cross-client data leaks, timing-unsafe secret comparisons, AbortSignal reuse across retries, and SSM-vs-env-var confusion on Lambda. Use when the user asks to "check for issues", "security review", "audit api routes", or after a code review surfaces API findings.
allowed-tools: Bash, Read, Grep, Glob, Edit
---

# API Security Audit

## What this skill fixes

Six recurring vulnerability classes in `src/app/api/**`:

### 1. Missing `await` on async auth guards (Critical — auth bypass)

```ts
// ❌ Wrong — isCronAuthorized returns a Promise (truthy!), guard always passes
if (!isCronAuthorized(request)) return 401;

// ✅ Fix
if (!(await isCronAuthorized(request))) return 401;
```

**How to find:**

```bash
grep -rn "isCronAuthorized\|isAdminAuthorized\|isAuthorized" src/app/api/ | grep -v "await"
```

### 2. Cross-client data leaks in portal/shared endpoints

Routes that call `listProjects()` / `listPortals()` / similar aggregators and return unfiltered results to a caller who only has credentials for one record.

```ts
// ❌ Wrong — all client projects returned to any valid portal token
const all = await listProjects();
return all;

// ✅ Fix — filter after fetch
const clientEmail = portal.clientEmail.toLowerCase();
return all.filter(
  (p) => p.type === "Client" && p.owner.toLowerCase() === clientEmail
);
```

**How to find:**

```bash
grep -rn "listProjects\|listPortals\|listClients" src/app/api/portal/ src/app/api/public/
```

### 3. Timing-unsafe secret comparison (Security Hotspot — S4787)

Using `===` to compare secrets allows timing attacks. But importing `timingSafeEqual` from `node:crypto` triggers SonarCloud S4787. Use the project-local wrapper instead:

```ts
// ❌ Wrong — timing-unsafe
if (header !== secret) return 401;

// ❌ Also wrong — triggers S4787 SonarCloud hotspot
import { timingSafeEqual } from "node:crypto";
timingSafeEqual(Buffer.from(a), Buffer.from(b));

// ✅ Correct — use the project wrapper
import { safeEqual } from "@/lib/cron-auth";
if (!safeEqual(header, secret)) return 401;
```

`safeEqual` is exported from `src/lib/cron-auth.ts` and wraps `timingSafeEqual` — SonarCloud sees the hotspot only on `cron-auth.ts`, not on every caller.

### 4. AbortSignal reuse across retries

When a caller passes an `AbortSignal` to a fetch loop, every retry after the first uses an already-aborted signal and fails immediately.

```ts
// ❌ Wrong — reuses caller's (possibly aborted) signal on every attempt
signal: init?.signal ?? AbortSignal.timeout(timeoutMs)

// ✅ Fix — always create a fresh signal per attempt
signal: AbortSignal.timeout(timeoutMs)
```

This is already fixed in `src/lib/integrations/http.ts`. Do NOT pass `init?.signal` through.

### 5. SSM secrets not available as env vars on Lambda

On Lambda (production), secret values live in SSM — NOT in `process.env`. Only build-time public vars (`NEXT_PUBLIC_*`) are available as env vars at runtime.

```ts
// ❌ Wrong — undefined on Lambda
const secret = process.env.CRON_SECRET;

// ✅ Fix — read from SSM config
const cfg = await getConfig();
const secret = cfg.CRON_SECRET ?? process.env.CRON_SECRET ?? "";
```

**How to find:**

```bash
grep -rn "process\.env\." src/app/api/ | grep -v "NEXT_PUBLIC_\|AWS_REGION\|NODE_ENV\|VERCEL"
```

### 6. Parallel auth + session fetch with shared try/catch (Admin lockout)

```ts
// ❌ Wrong — transient fetchAuthSession() failure clears the user's admin status
const [currentUser, session] = await Promise.all([getCurrentUser(), fetchAuthSession()]);

// ✅ Fix — separate try/catch so a session blip doesn't log out the user
const currentUser = await getCurrentUser();
let groups: string[] = [];
try {
  const session = await fetchAuthSession();
  // decode groups from idToken
} catch {
  groups = []; // keep existing admin state
}
```

## Audit workflow

1. **Grep for async guard calls without await:**

   ```bash
   grep -rn "if (!is[A-Z]" src/app/api/ | grep -v "await"
   ```

2. **Find aggregator calls in public/portal endpoints:**

   ```bash
   grep -rn "listProjects\|listPortals\|list[A-Z]" src/app/api/portal/ src/app/api/public/
   ```

3. **Find `===` comparisons with `secret` or `token` in route handlers:**

   ```bash
   grep -rn "secret\|token\|key" src/app/api/ | grep "!=="
   ```

4. **Find raw `process.env` for non-public values:**

   ```bash
   grep -rn "process\.env\." src/app/api/ | grep -v "NEXT_PUBLIC_\|AWS_REGION\|NODE_ENV"
   ```

5. **Check for AbortSignal passthrough in fetch loops:**

   ```bash
   grep -rn "init\?\.signal\|options\?\.signal" src/lib/ src/app/api/
   ```

## Files to check every time

| File | Vulnerability class |
|---|---|
| `src/app/api/cron/*/route.ts` | #1 (async guard), #5 (SSM) |
| `src/app/api/portal/[token]/route.ts` | #2 (data leak) |
| `src/app/api/admin/*/route.ts` | #3 (timing), #5 (SSM) |
| `src/lib/integrations/http.ts` | #4 (AbortSignal) |
| `src/context/AuthContext.tsx` | #6 (admin lockout) |

## After fixing

Run `pnpm typecheck && pnpm lint` to verify no regressions, then commit with a message like:

```
fix(api): [brief description of what was fixed]
```
