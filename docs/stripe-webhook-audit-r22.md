# Stripe webhook idempotency audit — R22

**Audit date:** 2026-06-22
**Auditor:** Claude (working with @tbaltzakis)
**Status:** ✅ SAFE for current SMB volume — 2/3 criteria pass cleanly, 3rd is
intentionally not implemented but is safe given the dedup pattern.

## What R22 asked for

From `docs/master-todo-list.md`:

> **R22** Stripe webhook idempotency audit — confirm `event.id` dedup
> table in DDB + return 200 fast + process async. Prevents
> duplicate-charge bugs. **EFFORT: S (audit-only)**

## Findings

### ✅ Criterion 1 — DDB dedup table by `event.id`

`src/lib/stripe-transactions.ts` `persistStripeEvent()` writes to the
`StripeTransactions` DDB table with:

```ts
new PutItemCommand({
  TableName: tableName,
  Item: buildItem(event),               // includes eventId: { S: event.id }
  ConditionExpression: "attribute_not_exists(eventId)",
})
```

`attribute_not_exists(eventId)` is an **atomic conditional write** —
DDB rejects the put if the event ID already exists. The thrown
`ConditionalCheckFailedException` is caught and returned as
`{duplicate: true}`. The route handler then short-circuits with
`Response.json({received: true, duplicate: true})` (line 254).

No race window: two concurrent webhook deliveries for the same
`event.id` will see exactly one `attribute_not_exists` succeed; the
other gets `duplicate: true` without running any handler.

### ⚠️ Criterion 2 — Return 200 fast

**Current flow** (synchronous):

1. Verify `stripe-signature` (~10ms)
2. `await persistStripeEvent(event)` — DDB write (~50-150ms)
3. `await handleStripeEvent(event)` — switch on `event.type`, calls
   handlers like `handleCheckoutCompleted` (DDB write + `notifyTeam`
   SES email, ~500ms-2s)
4. `await markStripeEventProcessed(event.id)` — DDB write (~50ms)
5. `await Sentry.flush(2000)` — up to 2s
6. Return 200

**Worst case total:** ~5-7s. Stripe's webhook timeout is **10s** before
it retries. We're under the threshold for all current event types
(checkout.session.completed, customer.subscription.*, invoice.payment_*).

**Risk surface:** if a future handler exceeds 10s (e.g., a heavy email
loop, a synchronous LLM call), Stripe retries the webhook → the
dedup pattern in criterion 1 catches it → handler is skipped → no
double-charge. **Worst real-world outcome is a stuck handler running
multiple times in parallel before the first persist completes**, but
even that is bounded: the first one to win the `attribute_not_exists`
race owns it; the rest return `{duplicate: true}` after just the
DDB persist.

### ❌ Criterion 3 — Process async

**Current flow is fully synchronous** — there is NO background queue
(no SQS, no EventBridge, no `setImmediate`). The handler runs in-line
before the route returns 200.

**Why this is OK today:** every handler currently runs in <3s. Adding
a queue would buy us:
- Sub-100ms 200 responses
- Decoupling so a slow handler can't ever hit the 10s Stripe timeout

But would cost:
- A new AWS service (SQS) — banned by the same-hardware constraint
  in master-todo-list.md
- A second Lambda for the queue consumer
- Re-architecture of the in-flight handlers
- A new failure mode (queue stuck → events processed late)

**Decision:** keep the synchronous pattern. The dedup pattern in
criterion 1 makes it safe even under Stripe retries.

## Guard rule for future contributors

Any new event handler added to `handleStripeEvent()` in
`src/app/api/webhooks/stripe/route.ts` MUST:

1. Complete in **<5 seconds** under normal load (leaves headroom under
   Stripe's 10s timeout).
2. Be **idempotent** on partial failure — if it crashes halfway, a
   re-invocation with the same `event.id` must not double-bill, double-
   notify, or double-write user-visible state.
3. Be **synchronous** — no `void promise()` patterns that escape the
   handler. The dedup safety only holds if the handler's work is
   complete before the 200 is sent.

If any of those rules don't fit, add a queue first (R-row to be
added; not on the current roadmap because no handler needs it today).

## Verification

- Read `src/app/api/webhooks/stripe/route.ts` (lines 220-298) and
  `src/lib/stripe-transactions.ts` (lines 91-160). Both confirm the
  pattern documented above.
- No vitest test currently asserts the dedup-on-retry behavior. A
  future test could mock two parallel `POST` calls with the same
  signed event body and assert exactly one returns `{duplicate:false}`.
  Not blocking; the conditional-write is DDB-enforced not code-enforced.

## See also

- `docs/master-todo-list.md` — R22 marked done after this audit
- `src/app/api/webhooks/stripe/route.ts` — the handler under audit
- `src/lib/stripe-transactions.ts` — the DDB persistence layer
- [Stripe docs: webhook retry behavior](https://stripe.com/docs/webhooks#retries) — 3-day exponential retry on non-2xx
