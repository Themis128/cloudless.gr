---
name: sonarcloud-triage
description: Triage and resolve SonarCloud findings on PRs in this repo. Covers the difference between Issues (code fixes) vs Hotspots (UI acknowledgement only), the specific rules that fire most often (S3699 void-use, S3776 cognitive-complexity, S1192 no-duplicate-string, S4787 crypto), and the correct fix pattern for each. Use when the user asks to "fix sonarcloud", "address sonar issues", or when a PR CI check shows SonarCloud failure.
allowed-tools: Bash, Read, Grep, Glob, Edit, mcp__github__pull_request_read
---

# SonarCloud Triage

## Issues vs Hotspots — critical distinction

| Type | What it means | How to resolve |
|---|---|---|
| **Issue** | Code has a definite defect by SonarCloud's rules. Gate fails if new issues exist. | Fix the code |
| **Hotspot** | Code pattern *may* be a security concern — needs human review. Gate passes even if hotspots are open. | Acknowledge in the SonarCloud UI (or fix if genuinely wrong) |

**You cannot "fix" a hotspot by changing code** if the underlying pattern (e.g. any use of `node:crypto`) triggers it. The only resolution is a human marking it "Reviewed" in the SonarCloud web UI at `sonarcloud.io/project/...`.

## Common rules in this codebase

### S3699 — `sonarjs/void-use` (Issue)

Calling an async function with `void` to suppress the return value is flagged.

```ts
// ❌ Flagged
void someAsyncFn();

// ✅ Fix
someAsyncFn().catch(() => {});
```

### S3776 — `sonarjs/cognitive-complexity` (Issue)

Functions with complexity > 15 are flagged. Fix by extracting helper functions.

```ts
// ❌ Deep nesting, ternaries, short-circuits all add to the score
function big() { if ... for ... switch ... }

// ✅ Extract inner logic
function handleCase(x: X) { ... }
function big() { handleCase(x); }
```

### S1192 — `sonarjs/no-duplicate-string` (Issue)

String literals used 3+ times must be extracted to a constant.

```ts
// ❌ "application/json" used 4× in the same file
res.setHeader("application/json")
...

// ✅
const JSON_CONTENT_TYPE = "application/json";
```

### S4787 — `sonarjs/prefer-using-cryptographic-primitives-correctly` (Hotspot)

Any new `import { ... } from "node:crypto"` triggers this hotspot.

**Do NOT** add a new `node:crypto` import just to use `timingSafeEqual`. Instead, use the project wrapper:

```ts
import { safeEqual } from "@/lib/cron-auth";
if (!safeEqual(a, b)) return 401;
```

If you absolutely must add a new crypto import, acknowledge the hotspot in the SonarCloud UI after it appears. You cannot suppress it in code.

### `sonarjs/prefer-global-this` (Issue)

```ts
// ❌ Flagged
global.fetch(...)

// ✅ Fix
globalThis.fetch(...)
```

## Triage workflow for a failing PR

1. **Read the SonarCloud bot comment** on the PR — it lists rule IDs and file:line for each new issue.

2. **Classify each finding:**
   - Contains "Security Hotspot" → UI-only fix (class 4: state to user once, skip duplicates).
   - Contains a rule ID like `sonarjs/...` → code fix (class 2: fix immediately).

3. **Apply the fix pattern** from the table above. Then push.

4. **Verify locally before pushing:**

   ```bash
   pnpm lint   # catches most sonarjs/ rule violations via ESLint plugin
   pnpm typecheck
   ```

5. **After pushing**, SonarCloud re-runs automatically on the new commit. Wait for the next webhook event to confirm the gate passes.

## When SonarCloud gate still fails after code fix

- Check if it's a **hotspot that looks like an issue** — the gate text says "X Security Hotspots" not "X New Issues". Hotspots never block the gate.
- Check if the code fix introduced a **new violation** in a different location.
- Check if the PR branch is behind `main` — SonarCloud compares against the base branch. If `main` advanced, rebase first.

  ```bash
  git fetch origin main && git rebase origin/main
  git push --force-with-lease
  ```

## SonarCloud project identifiers

- **Organization:** `baltzakisthemiscom`
- **Project key:** `cloudless-gr`
- **Dashboard:** `sonarcloud.io/project/overview?id=cloudless-gr`

Hotspot acknowledgement URL pattern:
`sonarcloud.io/project/security_hotspots?id=cloudless-gr&hotspots=<hotspot-key>`

The hotspot key is in the SonarCloud API response — the UI is the simplest path.
