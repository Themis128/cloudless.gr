#!/usr/bin/env node
/**
 * Notion CMS Bootstrap — seed all 4 CMS databases from static fallback content.
 *
 * Idempotent: skips entries whose title/name already exists in the database.
 * Safe to run multiple times — duplicates are never created.
 *
 * Run locally (with .env.local containing NOTION_API_KEY):
 *   node scripts/populate-cms.mjs
 *
 * Run via GitHub Actions:
 *   .github/workflows/populate-cms.yml (workflow_dispatch)
 */

import { resolve } from "path";

// Load .env.local
try {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
} catch {
  // dotenv optional
}

const NOTION_API_KEY = process.env.NOTION_API_KEY;
if (!NOTION_API_KEY) {
  console.error("ERROR: NOTION_API_KEY is not set. Add it to .env.local or as an env var.");
  process.exit(1);
}

// DB IDs — non-secret, from sst.config.ts
const DB_IDS = {
  testimonials: process.env.NOTION_TESTIMONIALS_DB_ID ?? "157ceb35d0b44661a6c67798f6d87e7b",
  caseStudies:  process.env.NOTION_CASE_STUDIES_DB_ID  ?? "7c50dc2403054f4a81f85b0a251ac4d7",
  services:     process.env.NOTION_SERVICES_DB_ID       ?? "98a4087c86704818a1dde515104c2331",
  faqs:         process.env.NOTION_FAQS_DB_ID            ?? "316acfca94f444d38c857aa765c259a2",
};

const NOTION_API  = "https://api.notion.com/v1";
const NOTION_VER  = "2022-06-28";

function notionHeaders() {
  return {
    Authorization: `Bearer ${NOTION_API_KEY}`,
    "Notion-Version": NOTION_VER,
    "Content-Type": "application/json",
  };
}

async function notionFetch(path, body, method = "POST") {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: notionHeaders(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Query existing entries (to skip duplicates)
// ---------------------------------------------------------------------------

async function queryExistingNames(dbId, titleProp) {
  const data = await notionFetch(`/databases/${dbId}/query`, {});
  return new Set(
    (data.results ?? []).map((p) => {
      const prop = p.properties?.[titleProp];
      const arr = prop?.title ?? prop?.rich_text ?? [];
      return arr.map((t) => t.plain_text ?? "").join("").trim();
    })
  );
}

// ---------------------------------------------------------------------------
// Rich text helper
// ---------------------------------------------------------------------------

function rt(text) {
  return [{ type: "text", text: { content: String(text ?? "") } }];
}

// ---------------------------------------------------------------------------
// TESTIMONIALS
// ---------------------------------------------------------------------------

const staticTestimonials = [
  {
    name: "Alexandros Papadopoulos",
    company: "TechFlow Athens",
    role: "CTO",
    quote: "Cloudless cut our AWS bill by 55% in the first month. Themis understood our architecture immediately and had a plan within 24 hours.",
    service: "Cloud Audit",
    rating: 5,
    featured: true,
    order: 1,
  },
  {
    name: "Maria Stavridou",
    company: "Retail Plus",
    role: "Head of Engineering",
    quote: "We migrated a monolith to serverless in 6 weeks with zero downtime. The result is 10× faster deployments and half the infrastructure cost.",
    service: "Architecture Migration",
    rating: 5,
    featured: true,
    order: 2,
  },
  {
    name: "Nikos Theodorakis",
    company: "FinStart GR",
    role: "Founder & CEO",
    quote: "The monthly retainer gives us a senior cloud architect on call without the full-time hire cost. Invaluable for a startup.",
    service: "Monthly Retainer",
    rating: 5,
    featured: false,
    order: 3,
  },
];

async function populateTestimonials() {
  console.log("\n--- Testimonials ---");
  const existing = await queryExistingNames(DB_IDS.testimonials, "Name");
  console.log("Existing entries:", [...existing]);

  for (const item of staticTestimonials) {
    if (existing.has(item.name)) {
      console.log(`  SKIP (exists): ${item.name}`);
      continue;
    }
    await sleep(350);
    await notionFetch("/pages", {
      parent: { database_id: DB_IDS.testimonials },
      properties: {
        Name:      { title: rt(item.name) },
        Company:   { rich_text: rt(item.company) },
        Role:      { rich_text: rt(item.role) },
        Quote:     { rich_text: rt(item.quote) },
        Service:   { select: { name: item.service } },
        Rating:    { number: item.rating },
        Featured:  { checkbox: item.featured },
        Published: { checkbox: true },
        Order:     { number: item.order },
      },
    });
    console.log(`  CREATED: ${item.name}`);
  }
}

// ---------------------------------------------------------------------------
// CASE STUDIES
// ---------------------------------------------------------------------------

const staticCaseStudies = [
  {
    title: "55% AWS Cost Reduction for a SaaS Startup",
    slug: "techflow-aws-cost-reduction",
    client: "TechFlow Athens",
    industry: "SaaS",
    services: ["Cloud Audit", "Cost Optimization"],
    summary: "Cloudless identified over-provisioned resources and redesigned the data pipeline architecture, cutting AWS spend by 55% in 30 days.",
    challenge: "TechFlow was spending €8,000/month on AWS with no clear understanding of where the money was going. Engineers had accumulated EC2 instances, over-sized RDS databases, and unused Elastic IPs over two years.",
    solution: "A full infrastructure audit mapped every resource to its cost. Right-sizing EC2 instances, migrating batch jobs to Lambda, and switching to Aurora Serverless v2 eliminated idle spend immediately.",
    results: "Monthly AWS bill dropped from €8,000 to €3,600 within 30 days. The team now has a cost dashboard and automated alerts for anomalies.",
    metrics: [
      { label: "Cost reduction", value: "55%" },
      { label: "Time to results", value: "30 days" },
      { label: "Monthly savings", value: "€4,400" },
    ],
    tags: ["AWS", "Cost optimization", "SaaS"],
    featured: true,
    date: "2026-03-01",
  },
  {
    title: "Monolith to Serverless in 6 Weeks",
    slug: "retail-plus-serverless-migration",
    client: "Retail Plus",
    industry: "E-commerce",
    services: ["Architecture Migration", "DevOps"],
    summary: "A 4-year-old Django monolith was decomposed into serverless microservices with zero downtime, enabling 10× faster deployments.",
    challenge: "Retail Plus had outgrown their monolithic application. Each deployment took 45 minutes, required manual database migrations, and caused brief downtime during peak trading hours.",
    solution: "Critical business domains (orders, inventory, notifications) were extracted into Lambda functions behind API Gateway. A strangler-fig migration allowed the old and new systems to run in parallel during the transition.",
    results: "Deployment time fell from 45 minutes to under 4 minutes. Infrastructure cost dropped 40% due to pay-per-use Lambda pricing. Zero downtime migrations are now standard.",
    metrics: [
      { label: "Deploy time", value: "−90%" },
      { label: "Infrastructure cost", value: "−40%" },
      { label: "Migration duration", value: "6 weeks" },
    ],
    tags: ["Serverless", "Lambda", "Migration", "E-commerce"],
    featured: true,
    date: "2026-01-15",
  },
];

async function populateCaseStudies() {
  console.log("\n--- Case Studies ---");
  const existing = await queryExistingNames(DB_IDS.caseStudies, "Title");
  console.log("Existing entries:", [...existing]);

  for (const item of staticCaseStudies) {
    if (existing.has(item.title)) {
      console.log(`  SKIP (exists): ${item.title}`);
      continue;
    }
    await sleep(350);
    const props = {
      Title:        { title: rt(item.title) },
      Slug:         { rich_text: rt(item.slug) },
      Client:       { rich_text: rt(item.client) },
      Industry:     { select: { name: item.industry } },
      Services:     { multi_select: item.services.map((s) => ({ name: s })) },
      Summary:      { rich_text: rt(item.summary) },
      Challenge:    { rich_text: rt(item.challenge) },
      Solution:     { rich_text: rt(item.solution) },
      Results:      { rich_text: rt(item.results) },
      Tags:         { multi_select: item.tags.map((t) => ({ name: t })) },
      Featured:     { checkbox: item.featured },
      Published:    { checkbox: true },
      Date:         { date: { start: item.date } },
    };
    // Add up to 3 metrics
    for (let i = 0; i < Math.min(3, item.metrics.length); i++) {
      props[`Metric${i + 1}Label`] = { rich_text: rt(item.metrics[i].label) };
      props[`Metric${i + 1}Value`] = { rich_text: rt(item.metrics[i].value) };
    }
    await notionFetch("/pages", {
      parent: { database_id: DB_IDS.caseStudies },
      properties: props,
    });
    console.log(`  CREATED: ${item.title}`);
  }
}

// ---------------------------------------------------------------------------
// SERVICES
// ---------------------------------------------------------------------------

const staticServices = [
  {
    name: "Cloud Audit",
    slug: "cloud-audit",
    description: "A deep-dive into your AWS infrastructure to uncover hidden costs, security gaps, and performance bottlenecks. Delivered within 5 business days.",
    price: "From €1,500",
    category: "audit",
    icon: "🔍",
    features: [
      "Full cost breakdown by service and team",
      "Security misconfiguration report",
      "Performance & latency analysis",
      "Prioritised remediation roadmap",
      "90-day follow-up check",
    ],
    cta: "Book an audit",
    order: 1,
  },
  {
    name: "Architecture Review",
    slug: "architecture-review",
    description: "Expert evaluation of your system design against AWS Well-Architected Framework pillars: reliability, security, performance, and cost.",
    price: "From €2,000",
    category: "consulting",
    icon: "🏗️",
    features: [
      "Well-Architected Framework assessment",
      "Scalability & reliability analysis",
      "Disaster recovery evaluation",
      "Written recommendations report",
      "60-min debrief call",
    ],
    cta: "Request a review",
    order: 2,
  },
  {
    name: "Serverless Migration",
    slug: "serverless-migration",
    description: "End-to-end migration from VMs or containers to serverless architecture, with zero-downtime cutover and full monitoring from day one.",
    price: "From €5,000",
    category: "devops",
    icon: "⚡",
    features: [
      "Strangler-fig or big-bang migration strategy",
      "Lambda + API Gateway + EventBridge wiring",
      "CI/CD pipeline setup (GitHub Actions / CodePipeline)",
      "Observability from day one (CloudWatch / Sentry)",
      "Knowledge transfer & runbook",
    ],
    cta: "Start a migration",
    order: 3,
  },
  {
    name: "Monthly Retainer",
    slug: "monthly-retainer",
    description: "A senior AWS-certified cloud architect on your team — available for design reviews, incident response, and ongoing cost optimisation.",
    price: "€1,500/mo",
    category: "consulting",
    icon: "🤝",
    features: [
      "Up to 20 hours/month cloud architecture support",
      "Unlimited async questions (email / Slack)",
      "Monthly infrastructure review",
      "On-call incident support",
      "Cancel any time",
    ],
    cta: "Start a retainer",
    order: 4,
  },
];

async function populateServices() {
  console.log("\n--- Services ---");
  const existing = await queryExistingNames(DB_IDS.services, "Name");
  console.log("Existing entries:", [...existing]);

  for (const item of staticServices) {
    if (existing.has(item.name)) {
      console.log(`  SKIP (exists): ${item.name}`);
      continue;
    }
    await sleep(350);
    await notionFetch("/pages", {
      parent: { database_id: DB_IDS.services },
      properties: {
        Name:        { title: rt(item.name) },
        Slug:        { rich_text: rt(item.slug) },
        Description: { rich_text: rt(item.description) },
        Price:       { rich_text: rt(item.price) },
        Category:    { select: { name: item.category } },
        Features:    { rich_text: rt(item.features.join("\n")) },
        CTA:         { rich_text: rt(item.cta) },
        Icon:        { rich_text: rt(item.icon) },
        Published:   { checkbox: true },
        Order:       { number: item.order },
      },
    });
    console.log(`  CREATED: ${item.name}`);
  }
}

// ---------------------------------------------------------------------------
// FAQs
// ---------------------------------------------------------------------------

const staticFaqs = [
  {
    question: "How long does a cloud audit take?",
    answer: "A standard cloud audit is delivered within 5 business days. Complex multi-account organisations may require 7–10 days. You'll receive a full written report plus a 60-minute debrief call.",
    category: "process",
    locales: [],
    order: 1,
  },
  {
    question: "Do you work with other cloud providers besides AWS?",
    answer: "Our core expertise is AWS, but we can advise on GCP and Azure architectures. Most engagements involve AWS as the primary cloud, often alongside Cloudflare for edge and CDN.",
    category: "technical",
    locales: [],
    order: 2,
  },
  {
    question: "What is the minimum engagement size?",
    answer: "The smallest engagement is the Cloud Audit at €1,500. There's no minimum contract length for the monthly retainer — you can cancel at any time.",
    category: "pricing",
    locales: [],
    order: 3,
  },
  {
    question: "Can you help us pass a SOC 2 or ISO 27001 audit?",
    answer: "Yes. Cloud Audits cover security misconfigurations and produce evidence artefacts. We can work alongside your compliance team to close gaps before a formal certification audit.",
    category: "technical",
    locales: [],
    order: 4,
  },
  {
    question: "Do you sign NDAs?",
    answer: "Yes, we sign mutual NDAs before any engagement. Your architecture diagrams, cost data, and business context stay strictly confidential.",
    category: "general",
    locales: [],
    order: 5,
  },
  {
    question: "How does the monthly retainer work?",
    answer: "You get up to 20 hours of senior cloud architecture support per month, a monthly infrastructure review call, unlimited async questions via email or Slack, and on-call incident support. Unused hours do not roll over.",
    category: "pricing",
    locales: [],
    order: 6,
  },
];

async function populateFaqs() {
  console.log("\n--- FAQs ---");
  const existing = await queryExistingNames(DB_IDS.faqs, "Question");
  console.log("Existing entries:", [...existing]);

  for (const item of staticFaqs) {
    if (existing.has(item.question)) {
      console.log(`  SKIP (exists): ${item.question}`);
      continue;
    }
    await sleep(350);
    await notionFetch("/pages", {
      parent: { database_id: DB_IDS.faqs },
      properties: {
        Question:  { title: rt(item.question) },
        Answer:    { rich_text: rt(item.answer) },
        Category:  { select: { name: item.category } },
        Locale:    { multi_select: item.locales.map((l) => ({ name: l })) },
        Published: { checkbox: true },
        Order:     { number: item.order },
      },
    });
    console.log(`  CREATED: ${item.question}`);
  }
}

// ---------------------------------------------------------------------------
// Verify counts after population
// ---------------------------------------------------------------------------

async function verifyCount(dbId, label) {
  const data = await notionFetch(`/databases/${dbId}/query`, {});
  const count = data.results?.length ?? 0;
  console.log(`  ${label}: ${count} total page(s) in DB`);
  return count;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log("Notion CMS Bootstrap");
console.log("====================");
console.log("DB IDs:");
for (const [k, v] of Object.entries(DB_IDS)) {
  console.log(`  ${k}: ${v}`);
}

try {
  await populateTestimonials();
  await populateCaseStudies();
  await populateServices();
  await populateFaqs();

  console.log("\n--- Verification ---");
  await verifyCount(DB_IDS.testimonials, "Testimonials");
  await verifyCount(DB_IDS.caseStudies,  "Case Studies");
  await verifyCount(DB_IDS.services,     "Services");
  await verifyCount(DB_IDS.faqs,         "FAQs");

  console.log("\nDone. All 4 databases seeded.");
} catch (err) {
  console.error("\nFATAL:", err.message);
  process.exit(1);
}
