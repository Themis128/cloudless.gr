#!/usr/bin/env node
/**
 * scripts/test_comfy_api.js
 *
 * ComfyUI API Integration Test — cloudless.gr
 *
 * Deterministic smoke payload built from src/lib/comfyui.buildPayloadForSmokeTest
 * and robust timeout/error handling.
 */

const { buildPayloadForSmokeTest } = require('../dist/lib/comfyui');

const DEFAULT_ENDPOINT = process.env.COMFYUI_ENDPOINT || 'http://localhost:8000/prompt';
const CLIENT_ID = process.env.COMFY_CLIENT_ID || `cloudless-test-override`;
const ENTRY_TOKEN = process.env.ENTRY_TOKEN || 'n8n_social_media_factory';
const TIMEOUT_MS = Number(process.env.COMFY_TIMEOUT_MS || 10000);

function logBanner(title) {
  const w = 52;
  console.log('╔' + '═'.repeat(w) + '╗');
  console.log('║  ' + title.padEnd(w - 2) + '║');
  console.log('╚' + '═'.repeat(w) + '╝\n');
}

async function checkHealth(endpoint) {
  try {
    const url = new URL(endpoint);
    const root = `${url.protocol}//${url.host}/`;
    const res = await fetch(root, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function buildPayload() {
  const payload = buildPayloadForSmokeTest(CLIENT_ID);
  payload.entry_token = ENTRY_TOKEN;
  return payload;
}

async function submitPrompt(endpoint, payload, timeoutMs = TIMEOUT_MS) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(id);

    const text = await res.text().catch(() => '');
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    if (!res.ok) {
      console.error('ComfyUI rejected prompt:', res.status, parsed);
      return { ok: false, status: res.status, body: parsed };
    }

    return { ok: true, status: res.status, body: parsed };
  } catch (err) {
    const isAbort = err && err.name === 'AbortError';
    return { ok: false, error: isAbort ? `timeout after ${timeoutMs}ms` : String(err) };
  }
}

async function main() {
  logBanner('ComfyUI API Integration Test — cloudless.gr');

  console.log('→ Stage 1: Checking ComfyUI endpoint health …');
  const health = await checkHealth(DEFAULT_ENDPOINT);
  if (!health.ok) {
    console.log('  ✗ Endpoint not reachable:', health.error ?? `HTTP ${health.status}`);
    process.exitCode = 2;
    return;
  }
  console.log('  ✓ HTTP 200 — OK\n');

  const payload = buildPayload();

  console.log('→ Stage 2: Submitting prompt to /prompt …');
  console.log('  Endpoint:', DEFAULT_ENDPOINT);
  console.log('  Client ID:', CLIENT_ID);
  console.log('  Entry token:', JSON.stringify(ENTRY_TOKEN));
  console.log('  Payload preview:');
  console.log(JSON.stringify(payload, null, 2), '\n');

  const result = await submitPrompt(DEFAULT_ENDPOINT, payload, TIMEOUT_MS);

  if (result.ok) {
    console.log('  ✓ Prompt accepted');
    if (result.body && typeof result.body === 'object' && result.body.prompt_id) {
      console.log('  prompt_id:', result.body.prompt_id);
    } else {
      console.log('  response:', JSON.stringify(result.body, null, 2));
    }
  } else {
    console.log('  ~ Prompt rejected (HTTP ' + (result.status || 'ERR') + ')');
    console.log(JSON.stringify({ error: result.body ?? result.error }, null, 2));
    process.exitCode = 3;
    return;
  }

  console.log('\n→ Stage 3: Readiness report\n');
  console.log('  ✅ ENDPOINT READY');
  console.log('  ComfyUI is running and accepted the prompt.');
  console.log('  n8n workflows can now POST to', DEFAULT_ENDPOINT);
}

if (require.main === module) {
  if (typeof fetch !== 'function') {
    console.error('This script requires Node 18+ (global fetch).');
    process.exit(1);
  }

  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 99;
  });
}

module.exports = {
  buildPayload,
  submitPrompt,
};