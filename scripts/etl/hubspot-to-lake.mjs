/**
 * ETL: HubSpot CRM → S3 Data Lake (Parquet)
 *
 * Pulls all contacts + deals + tickets from HubSpot via the v3 API,
 * writes three parquet files for Athena:
 *   - lake/hubspot-contacts/contacts.parquet
 *   - lake/hubspot-deals/deals.parquet
 *   - lake/hubspot-tickets/tickets.parquet
 *
 * Auth: HUBSPOT_API_KEY env (GH secret in CI). Same scope the app uses.
 * Runs daily via .github/workflows/etl-hubspot-to-lake.yml.
 * Full refresh — overwrites the parquet each run. At our volume (≤ a few
 * thousand contacts) the file is well under 1 MB and the run takes < 1 min.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const HUBSPOT_API = "https://api.hubapi.com";
const PAGE_SIZE = 100;

const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const TOKEN = process.env.HUBSPOT_API_KEY;

if (!TOKEN) {
  console.error("HUBSPOT_API_KEY not set");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Schemas — flat, typed, matched to Athena/Glue expectations
// ---------------------------------------------------------------------------

const contactSchema = new ParquetSchema({
  contact_id: { type: "UTF8" },
  email: { type: "UTF8", optional: true },
  firstname: { type: "UTF8", optional: true },
  lastname: { type: "UTF8", optional: true },
  company: { type: "UTF8", optional: true },
  phone: { type: "UTF8", optional: true },
  lifecyclestage: { type: "UTF8", optional: true },
  lead_status: { type: "UTF8", optional: true },
  lead_source: { type: "UTF8", optional: true },
  service_interest: { type: "UTF8", optional: true },
  country: { type: "UTF8", optional: true },
  createdate: { type: "UTF8", optional: true },
  lastmodifieddate: { type: "UTF8", optional: true },
});

const dealSchema = new ParquetSchema({
  deal_id: { type: "UTF8" },
  dealname: { type: "UTF8", optional: true },
  amount: { type: "DOUBLE", optional: true },
  currency: { type: "UTF8", optional: true },
  dealstage: { type: "UTF8", optional: true },
  pipeline: { type: "UTF8", optional: true },
  closedate: { type: "UTF8", optional: true },
  createdate: { type: "UTF8", optional: true },
  hubspot_owner_id: { type: "UTF8", optional: true },
});

const ticketSchema = new ParquetSchema({
  ticket_id: { type: "UTF8" },
  subject: { type: "UTF8", optional: true },
  content: { type: "UTF8", optional: true },
  hs_pipeline: { type: "UTF8", optional: true },
  hs_pipeline_stage: { type: "UTF8", optional: true },
  hs_ticket_priority: { type: "UTF8", optional: true },
  createdate: { type: "UTF8", optional: true },
  hs_lastmodifieddate: { type: "UTF8", optional: true },
});

// ---------------------------------------------------------------------------
// HubSpot client — cursor pagination per HubSpot v3 spec
// ---------------------------------------------------------------------------

async function hubspotListAll(path, propertyList) {
  const props = propertyList.join(",");
  const results = [];
  let after;
  do {
    const sep = path.includes("?") ? "&" : "?";
    const url =
      `${HUBSPOT_API}${path}${sep}limit=${PAGE_SIZE}&properties=${props}` +
      (after ? `&after=${encodeURIComponent(after)}` : "");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`HubSpot ${res.status} on ${path}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    for (const r of data.results || []) results.push(r);
    after = data.paging?.next?.after;
  } while (after);
  return results;
}

// ---------------------------------------------------------------------------
// Sink helpers
// ---------------------------------------------------------------------------

async function writeParquet(schema, rows, tmpPath, s3Key) {
  const writer = await ParquetWriter.openFile(schema, tmpPath);
  for (const r of rows) await writer.appendRow(r);
  await writer.close();
  const body = readFileSync(tmpPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: "application/octet-stream",
    })
  );
  unlinkSync(tmpPath);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Fetching HubSpot contacts...");
  const rawContacts = await hubspotListAll("/crm/v3/objects/contacts", [
    "email", "firstname", "lastname", "company", "phone",
    "lifecyclestage", "hs_lead_status", "lead_source", "service_interest",
    "country", "createdate", "lastmodifieddate",
  ]);
  const contacts = rawContacts.map((c) => ({
    contact_id: c.id,
    email: c.properties?.email || null,
    firstname: c.properties?.firstname || null,
    lastname: c.properties?.lastname || null,
    company: c.properties?.company || null,
    phone: c.properties?.phone || null,
    lifecyclestage: c.properties?.lifecyclestage || null,
    lead_status: c.properties?.hs_lead_status || null,
    lead_source: c.properties?.lead_source || null,
    service_interest: c.properties?.service_interest || null,
    country: c.properties?.country || null,
    createdate: c.properties?.createdate || null,
    lastmodifieddate: c.properties?.lastmodifieddate || null,
  }));
  console.log(`  ${contacts.length} contacts`);

  console.log("Fetching HubSpot deals...");
  const rawDeals = await hubspotListAll("/crm/v3/objects/deals", [
    "dealname", "amount", "deal_currency_code", "dealstage", "pipeline",
    "closedate", "createdate", "hubspot_owner_id",
  ]);
  const deals = rawDeals.map((d) => ({
    deal_id: d.id,
    dealname: d.properties?.dealname || null,
    amount: d.properties?.amount ? Number(d.properties.amount) : null,
    currency: d.properties?.deal_currency_code || null,
    dealstage: d.properties?.dealstage || null,
    pipeline: d.properties?.pipeline || null,
    closedate: d.properties?.closedate || null,
    createdate: d.properties?.createdate || null,
    hubspot_owner_id: d.properties?.hubspot_owner_id || null,
  }));
  console.log(`  ${deals.length} deals`);

  console.log("Fetching HubSpot tickets...");
  const rawTickets = await hubspotListAll("/crm/v3/objects/tickets", [
    "subject", "content", "hs_pipeline", "hs_pipeline_stage",
    "hs_ticket_priority", "createdate", "hs_lastmodifieddate",
  ]);
  const tickets = rawTickets.map((t) => ({
    ticket_id: t.id,
    subject: t.properties?.subject || null,
    content: t.properties?.content || null,
    hs_pipeline: t.properties?.hs_pipeline || null,
    hs_pipeline_stage: t.properties?.hs_pipeline_stage || null,
    hs_ticket_priority: t.properties?.hs_ticket_priority || null,
    createdate: t.properties?.createdate || null,
    hs_lastmodifieddate: t.properties?.hs_lastmodifieddate || null,
  }));
  console.log(`  ${tickets.length} tickets`);

  await writeParquet(contactSchema, contacts, "/tmp/hubspot-contacts.parquet", "lake/hubspot-contacts/contacts.parquet");
  await writeParquet(dealSchema, deals, "/tmp/hubspot-deals.parquet", "lake/hubspot-deals/deals.parquet");
  await writeParquet(ticketSchema, tickets, "/tmp/hubspot-tickets.parquet", "lake/hubspot-tickets/tickets.parquet");

  console.log(`✅ Uploaded ${contacts.length} contacts + ${deals.length} deals + ${tickets.length} tickets to s3://${BUCKET}/lake/hubspot-*/`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
