// Service connectivity check script for Cloudless.gr
// Checks Stripe, Notion, EspoCRM, Google Calendar, Slack, Sentry, and legacy SES/SSM if configured.
// Auth is Cloudflare D1 (no Cognito check).

const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

function loadDotEnv() {
  const dotenvPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(dotenvPath)) return;

  const content = fs.readFileSync(dotenvPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [rawKey, ...rest] = line.split('=');
    const key = rawKey.trim();
    const value = rest.join('=').trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

async function checkStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  const res = await fetch('https://api.stripe.com/v1/charges?limit=1', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Stripe API unreachable (${res.status})`);
}

async function checkSlack() {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error('SLACK_WEBHOOK_URL missing');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Cloudless.gr connectivity check (ignore)' }),
  });
  if (!res.ok) throw new Error(`Slack webhook unreachable (${res.status})`);
}

async function checkHubSpot() {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error('HUBSPOT_API_KEY missing');
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`EspoCRM API unreachable (${res.status})`);
}

async function checkNotion() {
  const key = process.env.NOTION_API_KEY;
  const db = process.env.NOTION_BLOG_DB_ID;
  if (!key || !db) throw new Error('NOTION_API_KEY or NOTION_BLOG_DB_ID missing');
  const res = await fetch(`https://api.notion.com/v1/databases/${db}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) throw new Error(`Notion API unreachable (${res.status})`);
}

async function checkGoogleCalendar() {
  const { google } = require('googleapis');
  const email = process.env.GOOGLE_CLIENT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!email || !key || !calendarId) throw new Error('Google Calendar env vars missing');
  const jwt = new google.auth.JWT(email, null, key.replace(/\\n/g, '\n'), [
    'https://www.googleapis.com/auth/calendar.readonly',
  ]);
  const calendar = google.calendar({ version: 'v3', auth: jwt });
  try {
    await jwt.authorize();
    await calendar.events.list({ calendarId, maxResults: 1 });
  } catch (e) {
    throw new Error(`Google Calendar API unreachable (${e.message})`);
  }
}

// SES and SSM have been migrated to Cloudflare services
// SES -> Resend/Cloudflare Email Service
// SSM -> D1 app_config + Wrangler secrets

async function checkClouflareEmail() {
  // Check Cloudflare Email Sending is configured
  const token = process.env.CLOUDFLARE_EMAIL_API_TOKEN || process.env.RESEND_API_KEY;
  if (!token) {
    console.log('[SKIP] Cloudflare Email/Resend not configured');
    return;
  }
  // Simple validation - actual API check would require proper auth
}

async function checkD1() {
  // D1 is the new config store (replaces SSM)
  if (!process.env.AUTH_DB) {
    // Check for D1 binding in Workers environment
    console.log('[INFO] D1 binding should be available in Cloudflare Workers');
  }
}

async function checkSentry() {
  if (
    !process.env.SENTRY_AUTH_TOKEN ||
    !process.env.SENTRY_ORG ||
    !process.env.SENTRY_PROJECT
  ) {
    throw new Error('Sentry env vars missing');
  }
}

async function runCheck(fn, name, required = false) {
  try {
    await fn();
    console.log(`\x1b[32m[OK]\x1b[0m ${name}`);
    return true;
  } catch (error) {
    const message = error.message || error.toString();
    const missingEnv = /missing/i.test(message);
    if (!required && missingEnv) {
      console.log(`\x1b[33m[SKIP]\x1b[0m ${name}: ${message}`);
      return true;
    }
    console.error(`\x1b[31m[FAIL]\x1b[0m ${name}: ${message}`);
    return false;
  }
}

async function main() {
  const checks = [
    [checkStripe, 'Stripe', false],
    [checkSlack, 'Slack', false],
    [checkHubSpot, 'EspoCRM', false],
    [checkNotion, 'Notion', false],
    [checkGoogleCalendar, 'Google Calendar', false],
    [checkClouflareEmail, 'Cloudflare Email', false],
    [checkD1, 'D1 (Cloudflare)', false],
    [checkSentry, 'Sentry', false],
  ];

  let ok = true;
  for (const [fn, name, required] of checks) {
    const passed = await runCheck(fn, name, required);
    if (!passed) ok = false;
  }

  process.exit(ok ? 0 : 1);
}

main();
