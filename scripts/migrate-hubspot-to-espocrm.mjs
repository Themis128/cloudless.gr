#!/usr/bin/env node
/**
 * scripts/migrate-hubspot-to-espocrm.mjs
 *
 * Exports HubSpot Contacts, Companies, and Deals into self-hosted EspoCRM.
 * Run once with your HUBSPOT_API_KEY + ESPOCRM_BASE_URL + ESPOCRM_API_KEY set.
 *
 * Usage:
 *   HUBSPOT_API_KEY=xxx ESPOCRM_BASE_URL=https://espocrm.cloudless.gr ESPOCRM_API_KEY=yyy \
 *     node scripts/migrate-hubspot-to-espocrm.mjs [--dry-run]
 *
 * What migrates:
 *   HubSpot Contact  → EspoCRM Contact  (email, firstname, lastname, phone, company)
 *   HubSpot Company  → EspoCRM Account  (name, website, phone, industry, description)
 *   HubSpot Deal     → EspoCRM Opportunity (name, stage, amount, closeDate)
 */

const DRY_RUN = process.argv.includes("--dry-run");

// ── HubSpot API ─────────────────────────────────────────────────────────────

const HS_BASE = "https://api.hubapi.com";

async function hsGet(path, token, qs = {}) {
  const url = new URL(`${HS_BASE}${path}`);
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HubSpot GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function hsPaginateAll(path, token, properties) {
  const items = [];
  let after;
  do {
    const qs = { limit: 100, properties: properties.join(",") };
    if (after) qs.after = after;
    const data = await hsGet(path, token, qs);
    items.push(...(data.results ?? []));
    after = data.paging?.next?.after;
  } while (after && items.length < 5000);
  return items;
}

// ── EspoCRM API ─────────────────────────────────────────────────────────────

async function espoPost(path, apiKey, baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`EspoCRM POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function espoSearch(entity, apiKey, baseUrl, where) {
  const qs = new URLSearchParams({ where: JSON.stringify(where), maxSize: "1" });
  const res = await fetch(`${baseUrl}/api/v1/${entity}?${qs.toString()}`, {
    headers: { "X-Api-Key": apiKey },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.list?.[0] ?? null;
}

// ── Stage mapping ────────────────────────────────────────────────────────────

const STAGE_MAP = {
  appointmentscheduled: "Prospecting",
  qualifiedtobuy: "Qualification",
  presentationscheduled: "Proposal/Price Quote",
  decisionmakerboughtin: "Value Proposition",
  contractsent: "Perception Analysis",
  closedwon: "Closed Won",
  closedlost: "Closed Lost",
};

function mapStage(hsStage) {
  return STAGE_MAP[hsStage?.toLowerCase()] ?? "Prospecting";
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const hsToken = process.env.HUBSPOT_API_KEY;
  const espoBase = (process.env.ESPOCRM_BASE_URL ?? "").replace(/\/$/, "");
  const espoKey = process.env.ESPOCRM_API_KEY ?? "";

  if (!hsToken) { console.error("HUBSPOT_API_KEY not set"); process.exit(1); }
  if (!espoBase || !espoKey) { console.error("ESPOCRM_BASE_URL and ESPOCRM_API_KEY required"); process.exit(1); }

  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}`);
  const summary = { contacts: 0, companies: 0, deals: 0 };

  // ── Contacts ───────────────────────────────────────────────────────────────
  console.log("\n── HubSpot Contacts →  EspoCRM Contacts");
  const contacts = await hsPaginateAll("/crm/v3/objects/contacts", hsToken, [
    "email", "firstname", "lastname", "phone", "company", "hs_lead_status",
  ]);
  console.log(`  Found ${contacts.length} contacts`);

  for (const c of contacts) {
    const p = c.properties ?? {};
    if (!p.email) continue;

    const payload = {
      emailAddress: p.email,
      firstName: p.firstname ?? "",
      lastName: p.lastname ?? "",
      phoneNumber: p.phone ?? "",
      accountName: p.company ?? "",
      description: `Migrated from HubSpot ID ${c.id}`,
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] Contact: ${p.email}`);
      summary.contacts++;
      continue;
    }

    try {
      const existing = await espoSearch("Contact", espoKey, espoBase, [
        { type: "equals", attribute: "emailAddress", value: p.email },
      ]);
      if (!existing) {
        await espoPost("/Contact", espoKey, espoBase, payload);
        summary.contacts++;
      }
    } catch (err) {
      console.error(`  Failed contact ${p.email}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log(`  Migrated: ${summary.contacts}`);

  // ── Companies ──────────────────────────────────────────────────────────────
  console.log("\n── HubSpot Companies → EspoCRM Accounts");
  const companies = await hsPaginateAll("/crm/v3/objects/companies", hsToken, [
    "name", "domain", "phone", "industry", "description",
  ]);
  console.log(`  Found ${companies.length} companies`);

  for (const co of companies) {
    const p = co.properties ?? {};
    if (!p.name) continue;

    const payload = {
      name: p.name,
      website: p.domain ? `https://${p.domain}` : "",
      phoneNumber: p.phone ?? "",
      industry: p.industry ?? "",
      description: p.description ?? `Migrated from HubSpot ID ${co.id}`,
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] Account: ${p.name}`);
      summary.companies++;
      continue;
    }

    try {
      const existing = await espoSearch("Account", espoKey, espoBase, [
        { type: "equals", attribute: "name", value: p.name },
      ]);
      if (!existing) {
        await espoPost("/Account", espoKey, espoBase, payload);
        summary.companies++;
      }
    } catch (err) {
      console.error(`  Failed account ${p.name}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log(`  Migrated: ${summary.companies}`);

  // ── Deals ──────────────────────────────────────────────────────────────────
  console.log("\n── HubSpot Deals → EspoCRM Opportunities");
  const deals = await hsPaginateAll("/crm/v3/objects/deals", hsToken, [
    "dealname", "dealstage", "amount", "closedate", "pipeline",
  ]);
  console.log(`  Found ${deals.length} deals`);

  for (const d of deals) {
    const p = d.properties ?? {};
    if (!p.dealname) continue;

    const payload = {
      name: p.dealname,
      stage: mapStage(p.dealstage),
      amount: p.amount ? parseFloat(p.amount) : 0,
      closeDate: p.closedate ? p.closedate.slice(0, 10) : new Date().toISOString().slice(0, 10),
      description: `Migrated from HubSpot Deal ID ${d.id}`,
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] Deal: ${p.dealname} (${mapStage(p.dealstage)})`);
      summary.deals++;
      continue;
    }

    try {
      await espoPost("/Opportunity", espoKey, espoBase, payload);
      summary.deals++;
    } catch (err) {
      console.error(`  Failed deal ${p.dealname}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 80));
  }
  console.log(`  Migrated: ${summary.deals}`);

  console.log("\n── Migration summary ──");
  console.log(`  Contacts:  ${summary.contacts}`);
  console.log(`  Companies: ${summary.companies}`);
  console.log(`  Deals:     ${summary.deals}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
