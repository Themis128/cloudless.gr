#!/usr/bin/env node
/**
 * scripts/seed-espocrm-from-pending.mjs
 *
 * One-time import: reads pending clients from D1 app_config → EspoCRM Contacts.
 * Re-runnable: uses search-then-PUT to avoid duplicates.
 * Test addresses (*.test, e2e-*) are skipped automatically.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=xxx ESPOCRM_BASE_URL=https://espocrm.cloudless.gr ESPOCRM_API_KEY=yyy \
 *     node scripts/seed-espocrm-from-pending.mjs [--dry-run]
 *
 * Required env vars:
 *   CLOUDFLARE_API_TOKEN — token with D1:Read on the account
 *   ESPOCRM_BASE_URL     — e.g. https://espocrm.cloudless.gr
 *   ESPOCRM_API_KEY      — the cloudless-app API user key
 */

const DRY_RUN = process.argv.includes("--dry-run");
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ESPO_BASE = (process.env.ESPOCRM_BASE_URL ?? "").replace(/\/$/, "");
const ESPO_KEY = process.env.ESPOCRM_API_KEY;

const CF_ACCOUNT_ID = "fb7dc7b69b662480cd5961a4d1913c78";
const D1_DB_ID = "7ca74513-23c3-412a-b9ca-b0c55835973d";

if (!CF_TOKEN) {
  console.error("Error: CLOUDFLARE_API_TOKEN is required");
  process.exit(1);
}
if (!ESPO_BASE || !ESPO_KEY) {
  console.error("Error: ESPOCRM_BASE_URL and ESPOCRM_API_KEY are required");
  process.exit(1);
}

// ── D1 ──────────────────────────────────────────────────────────────────────

async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DB_ID}/raw`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql, params }),
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) {
    throw new Error(`D1 HTTP ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  }
  return data.result?.[0]?.results ?? [];
}

// ── EspoCRM ──────────────────────────────────────────────────────────────────

async function espoFetch(path, init = {}) {
  return fetch(`${ESPO_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": ESPO_KEY,
      ...(init.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

/**
 * Search-then-POST/PUT. Returns { id, mode: "created" | "updated" }.
 */
async function upsertContact(fields) {
  const params = new URLSearchParams({
    "where[0][type]": "equals",
    "where[0][attribute]": "emailAddress",
    "where[0][value]": fields.emailAddress,
    maxSize: "1",
  });
  const search = await espoFetch(`/Contact?${params}`);
  if (search.ok) {
    const data = await search.json();
    const existing = data.list?.[0];
    if (existing) {
      if (!DRY_RUN) {
        const upd = await espoFetch(`/Contact/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(fields),
        });
        if (!upd.ok) {
          const body = await upd.text().catch(() => "");
          throw new Error(`PUT Contact ${existing.id} → ${upd.status}: ${body.slice(0, 200)}`);
        }
      }
      return { id: existing.id, mode: "updated" };
    }
  }
  if (DRY_RUN) return { id: "dry-run", mode: "created" };
  const res = await espoFetch("/Contact", {
    method: "POST",
    body: JSON.stringify(fields),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`POST Contact → ${res.status}: ${body.slice(0, 200)}`);
  }
  const created = await res.json();
  return { id: created.id, mode: "created" };
}

async function createNote(contactId, post) {
  if (DRY_RUN) {
    console.log(`  [dry-run] Note → "${post.slice(0, 80)}${post.length > 80 ? "…" : ""}"`);
    return;
  }
  const res = await espoFetch("/Note", {
    method: "POST",
    body: JSON.stringify({ type: "Post", post, parentType: "Contact", parentId: contactId }),
  });
  if (!res.ok) {
    console.warn(`  ⚠ Note create failed: ${res.status}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function isTestAddress(email) {
  return email.endsWith(".test") || /^e2e[-_]/.test(email.split("@")[0]);
}

function parseNameParts(name) {
  const parts = (name ?? "").trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

(async () => {
  console.log(`\nSeeding EspoCRM from D1 pending clients${DRY_RUN ? " (DRY RUN)" : ""}…\n`);

  const rows = await d1Query(
    "SELECT value FROM app_config WHERE key = 'PENDING_CLIENTS_JSON'"
  );
  const rawJson = rows[0]?.value;
  if (!rawJson) {
    console.log("No PENDING_CLIENTS_JSON found in D1. Nothing to import.");
    return;
  }

  const all = JSON.parse(rawJson);
  const clients = all.filter((c) => !isTestAddress(c.email));
  console.log(`${all.length} pending clients in D1, ${clients.length} non-test\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const client of clients) {
    const { email, name, plan, planLabel, submittedAt, status, notes } = client;
    console.log(`Processing ${email} (${planLabel ?? plan}, ${status})`);

    const { firstName, lastName } = parseNameParts(name);
    const submittedFmt = new Date(submittedAt).toLocaleString("en-IE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Athens",
    });

    const description = [
      `Portal plan: ${planLabel ?? plan}`,
      `Status: ${status}`,
      `Submitted: ${submittedFmt}`,
      notes ? `Client notes: ${notes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const { id, mode } = await upsertContact({
        emailAddress: email,
        firstName,
        lastName: lastName || email.split("@")[0],
        leadSource: "Web Site",
        description,
      });

      if (mode === "created") {
        // Only add a Note on first import to avoid duplicate notes on re-runs.
        const noteLines = [
          `Portal enrollment: ${planLabel ?? plan}`,
          `Status: ${status}`,
          `Submitted: ${submittedFmt}`,
          notes ? `Client notes: ${notes}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        await createNote(id, noteLines);
        created++;
        console.log(`  ✓ Created (id: ${id})\n`);
      } else {
        updated++;
        console.log(`  ✓ Updated (id: ${id})\n`);
      }
    } catch (err) {
      failed++;
      console.error(`  ✗ Failed: ${err.message}\n`);
    }
  }

  console.log(
    `Done: ${created} created, ${updated} updated, ${failed} failed out of ${clients.length} total.`
  );
})();
