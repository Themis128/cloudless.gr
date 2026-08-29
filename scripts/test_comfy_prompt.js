#!/usr/bin/env node
/**
 * test_comfy_prompt.js — Lightweight ComfyUI /prompt integration smoke test
 *
 * Reads the workflow template at
 *   ops/comfyui/storage/user/default/default_workflow.json
 * converts it to ComfyUI's API prompt format (node-ID-keyed objects with
 * `class_type` + `inputs`), tags the request with an n8n_social_media_factory
 * metadata block (structural payload spec for the n8n workflow layer), and
 * POSTs it to the running ComfyUI instance at http://localhost:8000/prompt.
 *
 * Exit codes:
 *   0 — Prompt accepted by ComfyUI queue (prompt_id returned)
 *   2 — Workflow file missing or invalid JSON
 *   3 — Cannot reach ComfyUI (connection refused / timeout)
 *   4 — ComfyUI returned an error status
 *
 * Env overrides:
 *   COMFYUI_HOST   (default: localhost)
 *   COMFYUI_PORT   (default: 8000)
 *   COMFYUI_TIMEOUT (default: 30000 ms)
 *   COMFYUI_NO_METADATA  (set "true" to strip the n8n_social_media_factory block)
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

/* ── ANSI helpers ────────────────────────────────────────────── */
const C = {
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

function log(level, msg, meta) {
  const ts = new Date().toISOString();
  const tag =
    { ok: `${C.green}[OK]${C.reset}`, info: `${C.cyan}[INFO]${C.reset}`, warn: `${C.yellow}[WARN]${C.reset}`, error: `${C.red}[ERROR]${C.reset}` }[
      level
    ] || `${C.dim}[${level.toUpperCase()}]${C.reset}`;
  process.stderr.write(`${C.dim}${ts}${C.reset} ${tag} ${msg}\n`);
  if (meta !== undefined) {
    process.stderr.write(`${C.dim}${JSON.stringify(meta, null, 2)}\n${C.reset}`);
  }
}

/* ── Configuration ───────────────────────────────────────────── */
const CONFIG = {
  host: process.env.COMFYUI_HOST || "localhost",
  port: parseInt(process.env.COMFYUI_PORT || "8000", 10),
  workflowPath: path.join(__dirname, "..", "ops", "comfyui", "storage", "user", "default", "default_workflow.json"),
  timeout: parseInt(process.env.COMFYUI_TIMEOUT || "30000", 10),
  includeMetadata: process.env.COMFYUI_NO_METADATA !== "true",
};

const BASE_URL = `http://${CONFIG.host}:${CONFIG.port}`;

/* ── Step 1 — Load workflow template ─────────────────────────── */
function loadWorkflow() {
  if (!fs.existsSync(CONFIG.workflowPath)) {
    log("error", `Workflow file not found: ${CONFIG.workflowPath}`);
    process.exit(2);
  }
  const raw = fs.readFileSync(CONFIG.workflowPath, "utf8");
  let workflow;
  try {
    workflow = JSON.parse(raw);
  } catch (err) {
    log("error", `Invalid JSON in workflow file: ${err.message}`);
    process.exit(2);
  }

  const nodeTypes = workflow.nodes?.map((n) => n.type) ?? [];
  log("ok", "Workflow loaded", {
    nodeCount: workflow.nodes.length,
    linkCount: workflow.links.length,
    nodeTypes,
    version: workflow.version,
    lastNodeId: workflow.last_node_id,
  });

  return workflow;
}

/* ── Step 2 — Convert graph format → ComfyUI API prompt format ─ */
/**
 * ComfyUI /prompt accepts a `prompt` object whose keys are string node IDs
 * and whose values are `{ class_type, inputs }`.
 *
 * Link tuples in the graph: [link_id, origin_node, origin_slot, dest_node, dest_slot, type]
 * We map each destination input to [origin_id_string, origin_slot].
 */
function convertToApiFormat(workflow) {
  const nodeMap = Object.fromEntries(workflow.nodes.map((n) => [n.id, n]));
  const linkMap = {};

  for (const link of workflow.links) {
    const [, originNode, originSlot, destNode, destSlot] = link;
    if (!linkMap[destNode]) linkMap[destNode] = {};
    const destNodeDef = nodeMap[destNode];
    const inputDef = destNodeDef?.inputs?.find((inp) => inp.slot_index === destSlot || inp.link === link[0]);
    if (inputDef) {
      linkMap[destNode][inputDef.name] = [String(originNode), originSlot];
    }
  }

  const api = {};
  for (const node of workflow.nodes) {
    const inputs = {};

    if (linkMap[node.id]) {
      Object.assign(inputs, linkMap[node.id]);
    }

    /* Map widget values to semantic input names based on node type */
    if (node.widgets_values?.length) {
      if (node.type.includes("PrimitiveNode")) {
        inputs.value = node.widgets_values[0];
      } else if (node.type.includes("Replicate")) {
        // Flux-Schnell widget order: width, height, seed, steps, scheduler, format, quality, ...
        const widgets = node.widgets_values;
        inputs.width = widgets[0];
        inputs.height = widgets[1];
        inputs.seed = widgets[2];
        inputs.steps = widgets[3];
        inputs.scheduler = widgets[4];
        inputs.format = widgets[5];
        inputs.quality = widgets[6];
        inputs.force_sequential = widgets[7];
        // prompt input is wired via link from PrimitiveNode — keep inputs.prompt if present
      } else if (node.type.includes("SaveImage")) {
        inputs.filename_prefix = node.widgets_values[0];
      } else {
        inputs._widgets_values = node.widgets_values;
      }
    }

    api[String(node.id)] = {
      class_type: node.type,
      inputs,
    };

    if (node.properties) {
      api[String(node.id)]._meta = { title: node.type, ...node.properties };
    }
  }

  return api;
}

/* ── Step 3 — Assemble the full request body ──────────────────── */
function buildRequestBody(workflow) {
  const prompt = convertToApiFormat(workflow);

  const body = {
    prompt,
    client_id: `n8n_social_media_factory-${Date.now()}`,
  };

  if (CONFIG.includeMetadata) {
    /**
     * Structural metadata payload specification for the n8n_social_media_factory
     * workflow pattern.  ComfyUI ignores unknown top-level keys, so this acts as
     * a pass-through descriptor that downstream n8n nodes can inspect.
     *
     * The api_elements block enumerates the three API payload nodes that form
     * the generation chain:
     *   1. PrimitiveNode  — the text prompt source
     *   2. Replicate      — the model inference node (flux-schnell)
     *   3. SaveImage      — the output sink
     */
    const nodes = workflow.nodes;
    body.n8n_social_media_factory = {
      source: "n8n_workflow",
      factory: "n8n_social_media_factory",
      api_elements: {
        primitive_node: {
          present: !!nodes.find((n) => n.type.includes("PrimitiveNode")),
          node_id: 1,
          value: nodes[0]?.widgets_values?.[0] ?? null,
        },
        replicate_node: {
          present: !!nodes.find((n) => n.type.startsWith("Replicate")),
          node_id: 2,
          model: nodes[1]?.type ?? null,
        },
        save_image_node: {
          present: !!nodes.find((n) => n.type.includes("SaveImage")),
          node_id: 3,
          filename_prefix: nodes[2]?.widgets_values?.[0] ?? null,
        },
      },
    };
  }

  return body;
}

/* ── Step 4 — POST to /prompt ────────────────────────────────── */
async function postPrompt(body) {
  const serialized = JSON.stringify(body, null, 2);
  log("info", `POST ${BASE_URL}/prompt`, {
    bodySizeBytes: Buffer.byteLength(serialized),
    hasMetadata: !!body.n8n_social_media_factory,
    nodeCount: Object.keys(body.prompt).length,
  });

  let response;
  try {
    response = await fetch(`${BASE_URL}/prompt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serialized,
      signal: AbortSignal.timeout(CONFIG.timeout),
    });
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.name === "FetchError") {
      log("error", `Cannot reach ComfyUI at ${BASE_URL}`);
      console.error(
        `${C.yellow}Hint: Is the ComfyUI container running?\n` +
          `  cd ops/comfyui && docker compose up -d${C.reset}\n`
      );
      process.exit(3);
    }
    log("error", `Request failed: ${err.message}`);
    process.exit(3);
  }

  const resBody = await response.json().catch(() => null);

  if (!response.ok) {
    log("error", `ComfyUI returned HTTP ${response.status}`, resBody);
    process.exit(4);
  }

  if (resBody?.error) {
    log("error", `ComfyUI API error`, resBody.error);
    process.exit(4);
  }

  log("ok", "Prompt submitted to ComfyUI queue", {
    promptID: resBody?.prompt_id,
    queueRemaining: resBody?.queue_remaining,
    clientID: body.client_id,
  });

  if (resBody?.prompt_id) {
    console.log(
      `\n${C.green}${C.bold}✅ ComfyUI /prompt integration verified — prompt queued (id: ${resBody.prompt_id})${C.reset}\n`
    );
  } else {
    log("warn", "Response did not include prompt_id — ComfyUI may have accepted but not queued");
  }

  return resBody;
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  console.log(
    `\n${C.bold}${C.cyan}ComfyUI n8n_social_media_factory — /prompt Integration Test${C.reset}\n`
  );

  const workflow = loadWorkflow();
  const requestBody = buildRequestBody(workflow);

  console.log(`${C.dim}Sending to ComfyUI at ${BASE_URL}${C.reset}\n`);

  await postPrompt(requestBody);
  process.exit(0);
}

main().catch((err) => {
  log("error", `Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
