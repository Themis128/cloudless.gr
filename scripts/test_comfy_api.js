#!/usr/bin/env node
/**
 * ComfyUI API Integration Test Script
 * cloudless.gr — ops/comfyui integration
 *
 * Fires a POST request to ComfyUI's internal REST API endpoint
 * (/prompt) with the programmatic payload tokens that an n8n
 * workflow passes (e.g. `n8n_social_media_factory`) and confirms
 * endpoint readiness.
 *
 * Usage:
 *   node scripts/test_comfy_api.js
 *   COMFYUI_BASE_URL=http://localhost:8000 node scripts/test_comfy_api.js
 *
 * Exit codes:
 *   0 — Endpoint is reachable and accepted the prompt
 *   1 — Endpoint is unreachable / not running
 *   2 — Endpoint reachable but rejected the prompt (non-fatal)
 */

"use strict";

const COMFYUI_BASE_URL = process.env.COMFYUI_BASE_URL || "http://localhost:8000";
const PROMPT_ENDPOINT = `${COMFYUI_BASE_URL}/prompt`;
const CLIENT_ID =
  process.env.COMFYUI_CLIENT_ID || `cloudless-test-${Date.now()}`;

/* ──────────────────────────────────────────────
 * API request payload tokens (programmatic).
 *
 * These are the exact tokens that an n8n workflow
 * passes inside the ComfyUI /prompt JSON body.
 * `n8n_social_media_factory` is the entry-class
 * identifier the workflow expects ComfyUI to
 * resolve.
 * ────────────────────────────────────────────── */
const API_PAYLOAD_TOKENS = {
  SOCIAL_MEDIA_FACTORY: "n8n_social_media_factory",
  WORKFLOW_NAME: "default",
  TRIGGER_SOURCE: "n8n",
};

/* ──────────────────────────────────────────────
 * ComfyUI /prompt endpoint payload structure.
 *
 * The `prompt` field is a directed-acyclic graph
 * keyed by node-id (string).  Each node carries a
 * `class_type` and `inputs`.  Node IDs are
 * arbitrary string integers in ComfyUI's protocol.
 * ────────────────────────────────────────────── */
function buildPromptPayload() {
  return {
    client_id: CLIENT_ID,
    prompt: {
      "1": {
        class_type: API_PAYLOAD_TOKENS.SOCIAL_MEDIA_FACTORY,
        inputs: {
          workflow_name: API_PAYLOAD_TOKENS.WORKFLOW_NAME,
          trigger_source: API_PAYLOAD_TOKENS.TRIGGER_SOURCE,
          batch_size: 1,
          steps: 20,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          seed: Math.floor(Math.random() * 9007199254740992),
        },
      },
      "2": {
        class_type: "CHECKPOINT",
        inputs: {
          model_name: "cyanic-turbo-v1",
        },
      },
      "3": {
        class_type: "POSITIVE",
        inputs: {
          text: "A surreal cyberpunk cityscape at twilight, cinematic lighting, 8k",
        },
      },
      "4": {
        class_type: "NEGATIVE",
        inputs: {
          text: "lowres, blurry, deformed hands, watermark",
        },
      },
      "5": {
        class_type: "LATENT_UNET",
        inputs: {
          model: ["2", 0],
          positive: ["3", 0],
          negative: ["4", 0],
          width: 1024,
          height: 1024,
          batch_size: 1,
        },
      },
      "6": {
        class_type: "SAMPLER",
        inputs: {
          model: ["2", 0],
          latent: ["5", 0],
        },
      },
      "7": {
        class_type: "SAVE_IMAGE",
        inputs: {
          images: ["6", 0],
          filename_prefix: API_PAYLOAD_TOKENS.SOCIAL_MEDIA_FACTORY,
        },
      },
    },
  };
}

/* ──────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────── */

/** Coloured console output (falls back to plain when not a TTY). */
const style = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  dim: "\x1b[2m",
};
const useColor = process.stdout.isTTY;
const c = (color, msg) => (useColor ? `${style[color]}${msg}${style.reset}` : msg);

/** Pretty-print JSON with truncation for readability. */
function formatJSON(obj, maxLines = 20) {
  const txt = JSON.stringify(obj, null, 2);
  const lines = txt.split("\n");
  if (lines.length <= maxLines) return txt;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n${c("dim", `… (${lines.length - maxLines} more lines truncated)`)}`
  );
}

/** POST a JSON body to the given URL with a configurable timeout. */
async function apiRequest(url, body, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: controller.signal,
  });
  clearTimeout(id);
  return res;
}

/* ──────────────────────────────────────────────
 * Test stages
 * ────────────────────────────────────────────── */

/**
 * Stage 1 — Confirm the ComfyUI HTTP service is alive.
 * The root path on ComfyUI returns a 200 HTML page.
 */
async function checkHealth() {
  console.log(c("blue", "→ Stage 1: Checking ComfyUI endpoint health …"));
  const baseUrl = COMFYUI_BASE_URL.replace(/\/$/, "");
  let ok = false;
  try {
    const res = await apiRequest(baseUrl, null, 5000);
    ok = res.ok || res.status === 404;
    console.log(
      `  ${res.ok ? c("green", "✓") : c("yellow", "~")} HTTP ${res.status} — ${res.statusText}`,
    );
    return ok;
  } catch (err) {
    console.log(c("red", "✗ Cannot reach ComfyUI at " + baseUrl));
    if (err.name === "AbortError") {
      console.log(c("dim", "  (request timed out)"));
    } else {
      console.log(c("dim", "  " + err.message));
    }
    return false;
  }
}

/**
 * Stage 2 — Submit a prompt to /prompt with the
 * n8n_social_media_factory payload token.
 */
async function submitPrompt() {
  console.log(c("blue", "\n→ Stage 2: Submitting prompt to /prompt …"));
  console.log(c("dim", `  Endpoint: ${PROMPT_ENDPOINT}`));
  console.log(c("dim", `  Client ID: ${CLIENT_ID}`));
  console.log(c("dim", `  Entry token: "${API_PAYLOAD_TOKENS.SOCIAL_MEDIA_FACTORY}"`));

  const payload = buildPromptPayload();
  console.log(
    c("dim", "  Payload preview:" + "\n" + formatJSON(payload, 8)),
  );

  try {
    const res = await apiRequest(PROMPT_ENDPOINT, payload, 15000);
    const data = await res.json().catch(() => ({}));

    if (res.ok && data.prompt_id) {
      console.log(
        `\n  ${c("green", "✓ Prompt accepted")}\n` +
          `  prompt_id: ${c("cyan", data.prompt_id)}\n` +
          `  status:    ${c("green", data.status || "queued")}`,
      );
      console.log(c("dim", formatJSON(data, 6)));
      return { accepted: true, data };
    }

    // Endpoint reachable but payload rejected
    console.log(c("yellow", `\n  ~ Prompt rejected (HTTP ${res.status})`));
    console.log(c("dim", formatJSON(data, 8)));
    return { accepted: false, data, status: res.status };
  } catch (err) {
    console.log(c("red", `\n✗ Request failed`));
    if (err.name === "AbortError") {
      console.log(c("dim", "  (request timed out after 15s)"));
    } else {
      console.log(c("dim", "  " + err.message));
    }
    return { accepted: false, error: err.message };
  }
}

/**
 * Stage 3 — Report final readiness verdict.
 */
function report(healthy, result) {
  console.log(c("blue", "\n→ Stage 3: Readiness report"));

  const ready = healthy && result.accepted;

  if (ready) {
    console.log(
      `\n  ${c("green", "✅ ENDPOINT READY")}\n` +
        `  ${c("dim", "ComfyUI is running and accepted the prompt.")}` +
        `\n  ${c("dim", "n8n workflows can now POST to " + PROMPT_ENDPOINT)}`,
    );
  } else if (healthy && !result.accepted) {
    console.log(
      `\n  ${c("yellow", "⚠ ENDPOINT REACHABLE — PAYLOAD REJECTED")}\n` +
        `  ${c("dim", "ComfyUI is running but the prompt token")}` +
        `  ${c("dim", "structure was not accepted.")}`,
    );
  } else {
    console.log(
      `\n  ${c("red", "❌ ENDPOINT NOT READY")}\n` +
        `  ${c("dim", "ComfyUI is not running at " + COMFYUI_BASE_URL)}` +
        `  ${c("dim", "Start it with:  docker compose up    ")}` +
        `  ${c("dim", "           or:  python main.py       ")}`,
    );
  }
  return ready;
}

/* ──────────────────────────────────────────────
 * Main
 * ────────────────────────────────────────────── */
(async function main() {
  console.log(
    c("cyan", "╔══════════════════════════════════════════════════╗") +
      `\n${c("cyan", "║  ComfyUI API Integration Test — cloudless.gr       ║")}` +
      `\n${c("cyan", "╚══════════════════════════════════════════════════╝")}`,
  );

  const healthy = await checkHealth();
  if (!healthy) {
    const ready = report(false, { accepted: false });
    process.exit(1);
  }

  const result = await submitPrompt();
  const ready = report(healthy, result);

  process.exit(ready ? 0 : 2);
})();
