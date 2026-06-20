/**
 * ETL: EspoCRM → S3 Data Lake (Parquet)
 *
 * Mirrors hubspot-to-lake.mjs but pulls from the self-hosted EspoCRM
 * instance via the v1 REST API. Five entities → five parquet files:
 *
 *   lake/espocrm-contacts/contacts.parquet
 *   lake/espocrm-accounts/accounts.parquet           (HubSpot's companies)
 *   lake/espocrm-opportunities/opportunities.parquet (HubSpot's deals)
 *   lake/espocrm-cases/cases.parquet                 (HubSpot's tickets)
 *   lake/espocrm-campaigns/campaigns.parquet
 *
 * Auth: X-Api-Key (the same SSM-stored ESPOCRM_API_KEY the app uses).
 * Auth user has the `Cloudless App Full Access` role; see
 * infrastructure/espocrm/README.md.
 *
 * Runs hourly via .github/workflows/etl-espocrm-to-lake.yml. Full refresh —
 * cheap because counts are well under 100k records on cloudless.gr.
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ParquetWriter, ParquetSchema } from "@dsnp/parquetjs";
import { readFileSync, unlinkSync } from "fs";

const PAGE_SIZE = 100;
const REGION = process.env.AWS_REGION || "us-east-1";
const BUCKET = process.env.ANALYTICS_BUCKET || "cloudless-analytics-data";
const BASE = (process.env.ESPOCRM_BASE_URL || "").replace(/\/$/, "");
const KEY = process.env.ESPOCRM_API_KEY;

if (!BASE || !KEY) {
  console.error("ESPOCRM_BASE_URL and ESPOCRM_API_KEY are required");
  process.exit(1);
}

const s3 = new S3Client({ region: REGION });

// ---------------------------------------------------------------------------
// Schemas — flat + typed, aligned with Glue/Athena column types.
// ---------------------------------------------------------------------------

const contactSchema = new ParquetSchema({
  contact_id: { type: "UTF8" },
  email: { type: "UTF8", optional: true },
  first_name: { type: "UTF8", optional: true },
  last_name: { type: "UTF8", optional: true },
  account_id: { type: "UTF8", optional: true },
  account_name: { type: "UTF8", optional: true },
  phone: { type: "UTF8", optional: true },
  title: { type: "UTF8", optional: true },
  lead_source: { type: "UTF8", optional: true },
  assigned_user_name: { type: "UTF8", optional: true },
  do_not_call: { type: "BOOLEAN", optional: true },
  created_at: { type: "UTF8", optional: true },
  modified_at: { type: "UTF8", optional: true },
});

const accountSchema = new ParquetSchema({
  account_id: { type: "UTF8" },
  name: { type: "UTF8", optional: true },
  website: { type: "UTF8", optional: true },
  email: { type: "UTF8", optional: true },
  phone: { type: "UTF8", optional: true },
  industry: { type: "UTF8", optional: true },
  type: { type: "UTF8", optional: true },
  billing_country: { type: "UTF8", optional: true },
  billing_city: { type: "UTF8", optional: true },
  assigned_user_name: { type: "UTF8", optional: true },
  created_at: { type: "UTF8", optional: true },
});

const opportunitySchema = new ParquetSchema({
  opportunity_id: { type: "UTF8" },
  name: { type: "UTF8", optional: true },
  account_id: { type: "UTF8", optional: true },
  account_name: { type: "UTF8", optional: true },
  amount: { type: "DOUBLE", optional: true },
  amount_currency: { type: "UTF8", optional: true },
  stage: { type: "UTF8", optional: true },
  probability: { type: "INT32", optional: true },
  close_date: { type: "UTF8", optional: true },
  lead_source: { type: "UTF8", optional: true },
  assigned_user_name: { type: "UTF8", optional: true },
  created_at: { type: "UTF8", optional: true },
  modified_at: { type: "UTF8", optional: true },
});

const caseSchema = new ParquetSchema({
  case_id: { type: "UTF8" },
  number: { type: "INT32", optional: true },
  name: { type: "UTF8", optional: true },
  status: { type: "UTF8", optional: true },
  priority: { type: "UTF8", optional: true },
  type: { type: "UTF8", optional: true },
  account_id: { type: "UTF8", optional: true },
  contact_id: { type: "UTF8", optional: true },
  assigned_user_name: { type: "UTF8", optional: true },
  created_at: { type: "UTF8", optional: true },
  modified_at: { type: "UTF8", optional: true },
});

const campaignSchema = new ParquetSchema({
  campaign_id: { type: "UTF8" },
  name: { type: "UTF8", optional: true },
  status: { type: "UTF8", optional: true },
  type: { type: "UTF8", optional: true },
  start_date: { type: "UTF8", optional: true },
  end_date: { type: "UTF8", optional: true },
  budget: { type: "DOUBLE", optional: true },
  budget_currency: { type: "UTF8", optional: true },
  sent_count: { type: "INT32", optional: true },
  opened_count: { type: "INT32", optional: true },
  clicked_count: { type: "INT32", optional: true },
  assigned_user_name: { type: "UTF8", optional: true },
  created_at: { type: "UTF8", optional: true },
});

// ---------------------------------------------------------------------------
// EspoCRM client — offset+maxSize pagination per v1 spec.
// ---------------------------------------------------------------------------

async function espoListAll(entity, select) {
  const all = [];
  let offset = 0;
  // Bound the loop generously (≤ 1M records) so a misbehaving server can't
  // keep the run alive forever. At PAGE_SIZE=100 that's 10k iterations.
  for (let i = 0; i < 10_000; i++) {
    const url = new URL(`${BASE}/api/v1/${entity}`);
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("maxSize", String(PAGE_SIZE));
    if (select) url.searchParams.set("select", select.join(","));
    const res = await fetch(url, { headers: { "X-Api-Key": KEY } });
    if (!res.ok) {
      throw new Error(`EspoCRM ${entity} list failed ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    all.push(...(data.list ?? []));
    if ((data.list ?? []).length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Parquet write helper — small files, one per entity. Single-row-group is
// fine at our volume; if any entity ever exceeds ~50k rows, switch to
// streaming chunked appends.
// ---------------------------------------------------------------------------

async function writeParquetAndUpload(filename, schema, rows, s3Key) {
  const writer = await ParquetWriter.openFile(schema, `/tmp/${filename}`);
  for (const r of rows) await writer.appendRow(r);
  await writer.close();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: readFileSync(`/tmp/${filename}`),
      ContentType: "application/octet-stream",
    })
  );
  unlinkSync(`/tmp/${filename}`);
  console.log(`✓ ${rows.length} rows → s3://${BUCKET}/${s3Key}`);
}

// ---------------------------------------------------------------------------
// Row mappers — EspoCRM JSON → flat parquet shape.
// ---------------------------------------------------------------------------

const toStr = (v) => (v == null ? undefined : String(v));
const toBool = (v) => (v == null ? undefined : Boolean(v));
const toNum = (v) => (v == null ? undefined : Number(v));

function mapContact(c) {
  return {
    contact_id: c.id,
    email: toStr(c.emailAddress),
    first_name: toStr(c.firstName),
    last_name: toStr(c.lastName),
    account_id: toStr(c.accountId),
    account_name: toStr(c.accountName),
    phone: toStr(c.phoneNumber),
    title: toStr(c.title),
    lead_source: toStr(c.leadSource),
    assigned_user_name: toStr(c.assignedUserName),
    do_not_call: toBool(c.doNotCall),
    created_at: toStr(c.createdAt),
    modified_at: toStr(c.modifiedAt),
  };
}
function mapAccount(a) {
  return {
    account_id: a.id,
    name: toStr(a.name),
    website: toStr(a.website),
    email: toStr(a.emailAddress),
    phone: toStr(a.phoneNumber),
    industry: toStr(a.industry),
    type: toStr(a.type),
    billing_country: toStr(a.billingAddressCountry),
    billing_city: toStr(a.billingAddressCity),
    assigned_user_name: toStr(a.assignedUserName),
    created_at: toStr(a.createdAt),
  };
}
function mapOpportunity(o) {
  return {
    opportunity_id: o.id,
    name: toStr(o.name),
    account_id: toStr(o.accountId),
    account_name: toStr(o.accountName),
    amount: toNum(o.amount),
    amount_currency: toStr(o.amountCurrency),
    stage: toStr(o.stage),
    probability: toNum(o.probability),
    close_date: toStr(o.closeDate),
    lead_source: toStr(o.leadSource),
    assigned_user_name: toStr(o.assignedUserName),
    created_at: toStr(o.createdAt),
    modified_at: toStr(o.modifiedAt),
  };
}
function mapCase(c) {
  return {
    case_id: c.id,
    number: toNum(c.number),
    name: toStr(c.name),
    status: toStr(c.status),
    priority: toStr(c.priority),
    type: toStr(c.type),
    account_id: toStr(c.accountId),
    contact_id: toStr(c.contactId),
    assigned_user_name: toStr(c.assignedUserName),
    created_at: toStr(c.createdAt),
    modified_at: toStr(c.modifiedAt),
  };
}
function mapCampaign(c) {
  return {
    campaign_id: c.id,
    name: toStr(c.name),
    status: toStr(c.status),
    type: toStr(c.type),
    start_date: toStr(c.startDate),
    end_date: toStr(c.endDate),
    budget: toNum(c.budget),
    budget_currency: toStr(c.budgetCurrency),
    sent_count: toNum(c.sentCount),
    opened_count: toNum(c.openedCount),
    clicked_count: toNum(c.clickedCount),
    assigned_user_name: toStr(c.assignedUserName),
    created_at: toStr(c.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Main — sequential pulls, each entity independent. If one entity 503s the
// rest still complete (Athena views just see yesterday's partition for that
// entity until next run).
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const tasks = [
    {
      entity: "Contact",
      select: [
        "id",
        "emailAddress",
        "firstName",
        "lastName",
        "accountId",
        "accountName",
        "phoneNumber",
        "title",
        "leadSource",
        "assignedUserName",
        "doNotCall",
        "createdAt",
        "modifiedAt",
      ],
      map: mapContact,
      schema: contactSchema,
      file: "contacts.parquet",
      s3: "lake/espocrm-contacts/contacts.parquet",
    },
    {
      entity: "Account",
      select: [
        "id",
        "name",
        "website",
        "emailAddress",
        "phoneNumber",
        "industry",
        "type",
        "billingAddressCountry",
        "billingAddressCity",
        "assignedUserName",
        "createdAt",
      ],
      map: mapAccount,
      schema: accountSchema,
      file: "accounts.parquet",
      s3: "lake/espocrm-accounts/accounts.parquet",
    },
    {
      entity: "Opportunity",
      select: [
        "id",
        "name",
        "accountId",
        "accountName",
        "amount",
        "amountCurrency",
        "stage",
        "probability",
        "closeDate",
        "leadSource",
        "assignedUserName",
        "createdAt",
        "modifiedAt",
      ],
      map: mapOpportunity,
      schema: opportunitySchema,
      file: "opportunities.parquet",
      s3: "lake/espocrm-opportunities/opportunities.parquet",
    },
    {
      entity: "Case",
      select: [
        "id",
        "number",
        "name",
        "status",
        "priority",
        "type",
        "accountId",
        "contactId",
        "assignedUserName",
        "createdAt",
        "modifiedAt",
      ],
      map: mapCase,
      schema: caseSchema,
      file: "cases.parquet",
      s3: "lake/espocrm-cases/cases.parquet",
    },
    {
      entity: "Campaign",
      select: [
        "id",
        "name",
        "status",
        "type",
        "startDate",
        "endDate",
        "budget",
        "budgetCurrency",
        "sentCount",
        "openedCount",
        "clickedCount",
        "assignedUserName",
        "createdAt",
      ],
      map: mapCampaign,
      schema: campaignSchema,
      file: "campaigns.parquet",
      s3: "lake/espocrm-campaigns/campaigns.parquet",
    },
  ];

  let okCount = 0;
  for (const t of tasks) {
    try {
      const raw = await espoListAll(t.entity, t.select);
      const rows = raw.map(t.map);
      // Parquet writers don't tolerate empty row sets — emit a placeholder
      // row so the table still exists for Athena. Athena views just see 0
      // user rows; placeholder rows are flagged with id="__placeholder__".
      if (rows.length === 0) {
        const placeholder = Object.fromEntries(
          Object.keys(t.schema.schema).map((k, i) => [k, i === 0 ? "__placeholder__" : undefined])
        );
        rows.push(placeholder);
      }
      await writeParquetAndUpload(t.file, t.schema, rows, t.s3);
      okCount++;
    } catch (err) {
      console.error(`✗ ${t.entity} failed:`, err.message);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nESPOCRM ETL done — ${okCount}/${tasks.length} entities succeeded in ${elapsed}s`);
  if (okCount === 0) process.exit(1);
}

main().catch((err) => {
  console.error("ETL crashed:", err);
  process.exit(1);
});
