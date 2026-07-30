> **HISTORICAL — 2026-06-02.** This document describes the app architecture when auth was provided by an external OIDC provider. Auth migrated to Cognito on 2026-06-08 (PR #677). Code paths described here for `/api/auth/[...nextauth]` are still valid; only the OIDC provider changed.

# User Flow Simulation — Wins & Failures

_Code-level trace of the three core user journeys on cloudless.gr (Next.js App Router + Cognito + Stripe). Date: 2026-06-02._

This is a static trace of the actual code paths (not a live browser run). Each
step lists the file that implements it and flags wins ✅ and failures ❌.

---

## Flow 1 — A new user creates an account

**Entry point:** Navbar → "Create Account" → `/auth/signup` (`Navbar.tsx:307`).

| # | User action | Code path |
|---|-------------|-----------|
| 1 | Open `/auth/signup` | `src/app/[locale]/auth/signup/page.tsx` |
| 2 | Type full name (optional), email, password (min 8), confirm password | form state |
| 3 | Submit | client checks `password === confirmPassword` (`signup/page.tsx:43`) |
| 4 | → `POST /api/auth/register` | `src/app/api/auth/register/route.ts` |
| 5 | Server: rate-limit 5/10 min, validate email + length, create user via Cognito admin API | `register/route.ts:28-129` |
| 6 | UI switches to "Check Your Email" | `signup/page.tsx:59` |
| 7 | User clicks link in email → Cognito marks `emailVerified` | Cognito hosted |
| 8 | `/auth/login` → "Continue with Cognito" → Cognito login → `/api/auth/callback/cognito` → `/auth/post-login` → `/dashboard` | `login/page.tsx:64`, `post-login/page.tsx` |

### ✅ Wins

- Real Cognito user creation via Admin API, rate limiting, email validation, duplicate handling (`409` → friendly message).
- Correct locale-aware navigation (`@/i18n/navigation`) on signup/login/forgot pages.
- Post-login admin-vs-dashboard routing resolved **server-side** (no flash) in `post-login/page.tsx`.
- Refresh-token rotation + RP-initiated federated logout in `src/lib/auth.ts`.

### ❌ Failures / risks

- **Email verification is a hard SMTP dependency with no escape hatch.** If SES/SMTP isn't configured in Cognito, the new user is created, never gets the email, and **can never log in** — with no UI to recover.
- **No "resend verification email"** anywhere in the UI. The check-email screen only links to `/auth/login`.
- **Forgot-password link is unreachable in production.** The "Forgot Password?" link is rendered **only** in the non-Cognito branch of the login form (`login/page.tsx:207-214`). When Cognito is configured (production), the login page shows just the "Continue with Cognito" button — so `/auth/forgot-password` exists and works but has **no link pointing to it**.
- **Two divergent signup implementations.** The page posts to `/api/auth/register` (admin-create), while `AuthContext.handleSignUp` (unused) redirects to Cognito's hosted `/registrations`. Dead/confusing, not user-facing.

---

## Flow 2 — A registered user buys a product

**Entry point:** Navbar → "Store" → `/store`.

| # | User action | Code path |
|---|-------------|-----------|
| 1 | Browse grid (search/filter/sort) | `StoreGrid.tsx` over static `defaultProducts` |
| 2 | Open a product | `/store/[id]/page.tsx` |
| 3 | "Add to Cart" / "Subscribe" | `AddToCartButton.tsx` / `ProductCard` |
| 4 | Open cart drawer | `CartSlideOver.tsx` |
| 5 | "Checkout" → `POST /api/checkout` → Stripe session → redirect | `api/checkout/route.ts` |
| 6 | Pay on Stripe → redirect to `/store/success` | `store/success/page.tsx` |
| 7 | `checkout.session.completed` webhook: email, team notify, Slack, EspoCRM deal, persist | `api/webhooks/stripe/route.ts` |

### ✅ Wins

- Catalog renders with **zero** Stripe dependency; client (`store-products-client.ts`) and server (`store-products.ts`) `defaultProducts` IDs verified **in sync** → no "unknown product" on checkout.
- Checkout route is hardened: origin allowlist (anti open-redirect), quantity clamp 1–99, idempotency-key support, subscription-vs-payment mode, EU+ shipping for physical goods, `503` when Stripe unconfigured.
- Webhook: signature verification, duplicate suppression, failure marking, Sentry, graceful EspoCRM/Slack degradation.
- Purchases read **live from Stripe by email** — no separate order DB to drift.

### ❌ Failures / risks

- **Cart checkout never sends the auth token.** `CartSlideOver.handleCheckout` (`CartSlideOver.tsx:20`) uses plain `fetch` with no `Authorization` header, so `authUser` in the checkout route is `null` → `customer_email` is **not** prefilled and `userId` is **not** put in metadata. The purchase links to the account **only if** the user happens to type their exact account email at Stripe. Different email → the order is invisible in their dashboard. Fragile coupling.
- **Silent checkout failure.** `handleCheckout` does `if (data.url) …`. On any non-`url` response (e.g. `503` Stripe-not-configured, `400`) it does nothing — the spinner resets and **no error is shown**; the `catch` only fires on a network error. A user hitting an unconfigured/erroring Stripe sees the button do nothing.
- **Store-grid "Add to Cart" gives no feedback.** `ProductCard` calls only `addItem` (`StoreGrid.tsx:101`) and `ADD_ITEM` does not open the drawer — only the badge count changes. The product **detail** page button does open the cart (`AddToCartButton.tsx`). Inconsistent; grid users may think nothing happened.
- **Locale double-prefix bug on the product page.** `store/[id]/page.tsx` builds `localePath()` (which prepends `/el`, `/fr`, …) **and** passes it to the i18n `<Link>`, which prepends the locale **again** → `/el/el/store`, `/el/el/store/{id}`. The breadcrumb "Store" link and related-product links **404 for non-default locales** (el/fr/de). English (default) is unaffected. Violates the locale rule in `CLAUDE.md`.
- **Success page over-promises fulfilment.** It tells digital buyers "Download links have been sent to your email," but the webhook only sends a generic order-confirmation email — there is no code that attaches/serves actual digital files.

---

## Flow 3 — What a registered user can do in the app

**Gating:** `DashboardLayoutClient.tsx:20-24` redirects to `/auth/login` if there's no session (client-side). The underlying API routes are independently protected by `requireAuth`.

**Nav:** Overview · Profile · Purchases · Consultations · Settings (`DashboardLayoutClient.tsx:7-13`).

| Action | Status | Notes |
|--------|--------|-------|
| View dashboard overview + stats | ✅ Works | aggregates purchases + consultations (`dashboard/page.tsx`) |
| View purchases & subscriptions | ✅ Works | live from Stripe by email (`api/user/purchases`) — _email-linkage caveat from Flow 2 applies_ |
| View consultations | ✅ Works | Google Calendar by email; unconfigured → graceful empty state (`api/user/consultations`) |
| Update profile (name/company/phone) | ⚠️ Write-only | `POST /api/user/profile` → Cognito Account API succeeds, but **nothing reads it back** |
| Change settings (theme/language/notifications) | ⚠️ Partial | theme persists (localStorage); language + notification prefs **don't survive reload** |
| Sign out | ✅ Works | federated logout (`AuthContext.handleSignOut`) |
| Reset password | ⚠️ Works but unreachable | page redirects to Cognito reset-credentials; no link from login (Flow 1) |
| Client portal `/portal/[token]` | ✅ Works (admin-issued link) | timeline, invoices, subscriptions; invalid token → friendly message |
| Waiting room `/portal/waiting` | ✅ Works | post-service-purchase status, polls every 30s |

### ✅ Wins

- All dashboard data loads through authenticated same-origin routes; `requireAuth` supports both the next-auth session cookie **and** a Bearer token with full JWKS signature verification (`api-auth.ts`).
- Consistent graceful empty states — no hard crashes when Stripe/Calendar/Notion are unconfigured.

### ❌ Failures

- **Profile & preferences are write-only.** `AuthContext.checkAuth` only hydrates `name`/`email` from the session (`AuthContext.tsx:117-124`); there is **no GET** that reads `company`, `phone`, or `preferences` back from Cognito. So after saving, the Profile fields show blank again on reload and Settings toggles reset to defaults — the data persisted, but the UI makes it look like the save failed. **This is the biggest functional papercut.**
- **"Preferred Language" in Settings does nothing to the site locale** (locale is driven by the URL/Navbar, not this preference).
- **Dashboard auth gate is client-side only** — the page shell can render briefly before redirect. No data leak (APIs are guarded server-side), but a visible flash.

---

## Summary scoreboard

| Journey | Verdict |
|---------|---------|
| Create account | Works **iff** Cognito SMTP is configured; otherwise users get permanently stuck with no recovery UI. Forgot-password link missing from production login. |
| Buy a product | Core path works; account↔order linkage is fragile (no token on checkout), checkout errors fail silently, and non-English product pages have 404 links. |
| Registered-user actions | Reads work well; **writes (profile/preferences) don't read back**, so saves appear to not stick. |

### Highest-impact fixes (suggested order)

1. Guarantee Cognito SMTP **or** add a "resend verification" + clear messaging (unblocks all new signups).
2. Add a `GET /api/user/profile` and hydrate `company`/`phone`/`preferences` in `AuthContext` (makes saves visibly stick).
3. Send the Bearer token from `CartSlideOver.handleCheckout`, and surface checkout errors instead of failing silently.
4. Fix the `store/[id]` locale double-prefix (drop `localePath`, pass bare paths to the i18n `<Link>`).
5. Add the forgot-password link to the Cognito-mode login screen.
6. Open the cart drawer (or toast) from the store-grid "Add to Cart".
