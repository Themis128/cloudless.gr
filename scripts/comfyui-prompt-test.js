#!/usr/bin/env node
/**
 * ComfyUI Integration Script — n8n Social Media Factory
 *
 * Sends a hardcoded cloud-inference prompt payload loop to ComfyUI's
 * /prompt endpoint (http://localhost:8000/prompt) to verify programmatic
 * generation stability.
 *
 * Usage:
 *   node scripts/comfyui-prompt-test.js
 *
 * Configuration (env vars):
 *   COMFYUI_HOST        — ComfyUI host (default: localhost)
 *   COMFYUI_PORT        — ComfyUI port (default: 8000)
 *   COMFYUI_TIMEOUT     — Request timeout in ms (default: 30000)
 *   COMFYUI_POLL        — Poll for results after submission (default: true)
 *   COMFYUI_MAX_POLL    — Max poll attempts (default: 30)
 *   COMFYUI_INTERVAL    — Poll interval in ms (default: 2000)
 *   COMFYUI_LOOP_COUNT  — Number of times to loop the prompt (default: 5)
 *
 * Exit codes:
 *   0 — Prompt submitted and (optionally) completed successfully
 *   2 — Workflow file missing or invalid
 *   3 — Could not connect to ComfyUI
 *   4 — ComfyUI returned an error
 */

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

/* ── ANSI colour helpers ────────────────────────────────────────────── */

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
  const tag = {
    ok: `${C.green}[OK]${C.reset}`,
    info: `${C.cyan}[INFO]${C.reset}`,
    warn: `${C.yellow}[WARN]${C.reset}`,
    error: `${C.red}[ERROR]${C.reset}`,
  }[level];
  process.stderr.write(`${C.dim}${ts}${C.reset} ${tag} ${msg}\n`);
  if (meta)
    process.stderr.write(`${C.dim}${JSON.stringify(meta, null, 2)}\n${C.reset}`);
}

/* ── Configuration ──────────────────────────────────────────────────── */

const CONFIG = {
  host: process.env.COMFYUI_HOST || "localhost",
  port: parseInt(process.env.COMFYUI_PORT || "8000", 10),
  clientID:
    process.env.COMFYUI_CLIENT_ID ||
    `n8n_social_media_factory-${Date.now()}`,
  timeout: parseInt(process.env.COMFYUI_TIMEOUT || "30000", 10),
  poll: process.env.COMFYUI_POLL !== "false",
  maxPoll: parseInt(process.env.COMFYUI_MAX_POLL || "30", 10),
  interval: parseInt(process.env.COMFYUI_INTERVAL || "2000", 10),
  loopCount: parseInt(process.env.COMFYUI_LOOP_COUNT || "5", 10),
};

/* ── Hardcoded Cloud-Inference Prompt Payload ───────────────────────── */

/**
 * Hardcoded cloud-inference prompt payload.
 * Represents a basic cloud inference workflow with:
 * - PrimitiveNode for text input (the cloud inference prompt)
 * - SaveImage node to capture output
 */
const CLOUD_INFERENCE_PROMPT = {
  "last_node_id": 3,
  "last_link_id": 2,
  "version": "0.1.0",
  "nodes": [
    {
      "id": 1,
      "type": "PrimitiveNode",
      "pos": [0, 0],
      "size": [180, 27],
      "flags": {},
      "order": 0,
      "mode": 0,
      "inputs": [],
      "outputs": [
        {
          "name": "value",
          "type": "STRING",
          "links": [0],
          "slot_index": 0
        }
      ],
      "properties": {
        "Node name for S&R": "PrimitiveNode"
      },
      "widgets_values": [
        "A beautiful landscape of a futuristic city with flying cars, cyberpunk style, highly detailed, 8k resolution"
      ]
    },
    {
      "id": 2,
      "type": "SaveImage",
      "pos": [300, 0],
      "size": [180, 27],
      "flags": {},
      "order": 0,
      "mode": 0,
      "inputs": [
        {
          "name": "images",
          "type": "IMAGE",
          "link": 0
        }
      ],
      "outputs": [],
      "properties": {
        "Node name for S&R": "SaveImage"
      },
      "widgets_values": [
        "cloud_inference_output"
      ]
    }
  ],
  "links": [
    [0, 1, 0, 2, 0]
  ],
  "groups": [],
  "configs": [],
  "extra": {}
};

/* ── Step 1 — Construct the API payload ─────────────────────────────── */

/**
 * Build the ComfyUI /prompt request body from the hardcoded cloud-inference prompt.
 */
function buildCloudInferencePayload(format) {
  let prompt;
  
  if (format === "api") {
    // Convert to API format (node-ID keyed)
    prompt = convertToApiFormat(CLOUD_INFERENCE_PROMPT);
    log("info", "Converted cloud-inference prompt to ComfyUI API format (node-ID keyed)");
  } else {
    // Use graph format directly
    prompt = CLOUD_INFERENCE_PROMPT;
  }

  const payload = {
    prompt,
    client_id: CONFIG.clientID,
  };

  return payload;
}

/**
 * Convert the graph format (nodes + links arrays) into ComfyUI's API
 * format (node IDs as string keys with class_type + inputs).
 */
function convertToApiFormat(workflow) {
  const api = {};

  // Index nodes by id for quick lookup
  const nodeMap = {};
  workflow.nodes.forEach((n) => {
    nodeMap[n.id] = n;
  });

  // Build a map: dest_node_id → { input_name → [origin_id, slot] }
  const linkMap = {};
  workflow.links.forEach((link) => {
    const [, originNode, originSlot, destNode, destSlot, ] = link;
    if (!linkMap[destNode]) linkMap[destNode] = {};
    // Find the input definition to get the name
    const destNodeDef = nodeMap[destNode];
    const inputDef = destNodeDef?.inputs?.find(
      (inp) => inp.slot_index === destSlot || inp.link === link[0]
    );
    if (inputDef) {
      linkMap[destNode][inputDef.name] = [String(originNode), originSlot];
    }
  });

  // Convert each node
  workflow.nodes.forEach((node) => {
    const inputs = {};

    // Merge link-based inputs
    if (linkMap[node.id]) {
      Object.assign(inputs, linkMap[node.id]);
    }

    // Handle widget values — store under _widgets_values for nodes
    // that use them.  ComfyUI's API format maps widget values to
    // specific input names, but since we don't have the node schema
    // definition here, we pass them as-is.
    if (node.widgets_values && node.widgets_values.length > 0) {
      // For PrimitiveNode, the first widget is "value" (the string prompt)
      if (node.type.includes("PrimitiveNode")) {
        inputs.value = node.widgets_values[0];
      } else if (node.type.includes("SaveImage")) {
        inputs.filename_prefix = node.widgets_values[0];
      } else {
        // Generic fallback: keep widgets_values for ComfyUI to resolve
        inputs._widgets_values = node.widgets_values;
      }
    }

    api[String(node.id)] = {
      class_type: node.type,
      inputs,
    };

    // Preserve _meta if present
    if (node.properties) {
      api[String(node.id)]._meta = {
        title: node.type,
      };
    }
  });

  return api;
}

/* ── Step 2 — Send the POST request ─────────────────────────────────── */

function postPrompt(payload, label) {
  if (label) log("info", label);

  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const requestOptions = {
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: "/prompt",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: CONFIG.timeout,
    };

    log("info", `POST ${CONFIG.host}:${CONFIG.port}/prompt`);

    const req = http.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${CONFIG.timeout}ms`));
    });

    req.write(body);
    req.end();
  });
}

/* ── Step 3 — Poll for completion via /history ──────────────────────── */

function pollHistory(promptID) {
  return new Promise((resolve) => {
    let attempts = 0;

    const check = () => {
      attempts++;
      const options = {
        hostname: CONFIG.host,
        port: CONFIG.port,
        path: `/history?p=${encodeURIComponent(promptID)}`,
        method: "GET",
      };

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = {};
          }

          const entry = parsed[promptID];
          if (entry && entry.status && entry.status === "completed") {
            log("ok", "Generation completed", {
              promptID,
              status: entry.status,
              outputs: entry.outputs,
            });
            return resolve(true);
          }

          if (entry && entry.status && entry.status === "error") {
            log("error", `Generation errored`, {
              promptID,
              error: entry,
            });
            return resolve(false);
          }

          if (attempts >= CONFIG.maxPoll) {
            log(
              "warn",
              `Max poll attempts (${CONFIG.maxPoll}) reached — last status: ${entry?.status?.status || "pending"}`,
            );
            return resolve(false);
          }

          log(
            "info",
            `Poll ${attempts}/${CONFIG.maxPoll} — status: ${entry?.status?.status || "pending"}`
          );
          setTimeout(check, CONFIG.interval);
        });
      });

      req.on("error", () => {
        if (attempts >= CONFIG.maxPoll) {
          log("warn", "Polling errors — giving up");
          return resolve(false);
        }
        setTimeout(check, CONFIG.interval);
      });

      req.end();
    };

    check();
  });
}

/* ── Health check ───────────────────────────────────────────────────── */

function checkHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: "/system_stats",
      method: "GET",
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch {
            resolve({ raw: data });
          }
        } else {
          resolve(null);
        }
      });
    });

    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.end();
  });
}

/* ── Main ───────────────────────────────────────────────────────────── */

async function main() {
  console.log(
    `\n${C.bold}${C.cyan}ComfyUI Cloud-Inference Prompt Loop Test${C.reset}\n`
  );

  /* 1. Check ComfyUI health */
  console.log(
    `${C.dim}Checking ComfyUI at ${CONFIG.host}:${CONFIG.port}…${C.reset}`
  );
  const stats = await checkHealth();
  if (!stats) {
    log("error", `ComfyUI is not reachable at ${CONFIG.host}:${CONFIG.port}`);
    console.error(
      `${C.yellow}Hint: Is the container running?\n` +
        `  cd ops/comfyui && docker compose up -d${C.reset}\n`
    );
    process.exit(3);
  }
  log("ok", "ComfyUI is online", {
    cpu: stats?.system?.cpu
      ? `${stats.system.cpu.used}% used`
      : "n/a",
    ram: stats?.system?.ram
      ? `${stats.system.ram.used} / ${stats.system.ram.total}`
      : "n/a",
  });

  /* 2. Execute the cloud-inference prompt payload loop */
  log("info", `Starting cloud-inference prompt loop (${CONFIG.loopCount} iterations)`);
  
  for (let i = 0; i < CONFIG.loopCount; i++) {
    log("info", `Iteration ${i + 1}/${CONFIG.loopCount}`);
    
    /* Build payload (try API format first, fallback to graph format) */
    let payload = buildCloudInferencePayload("api");
    let label = `Attempt 1: API-format payload (iteration ${i + 1})`;
    
    let response;
    try {
      response = await postPrompt(payload, label);
    } catch (err) {
      log("error", `Request failed: ${err.message}`);
      process.exit(4);
    }

    let { status, body } = response;

    /* Retry strategy:
     *   Attempt 2 — strip metadata and use graph format
     */
    if (status !== 200) {
      log("warn", `ComfyUI returned HTTP ${status} — retrying with graph-format payload`);
      payload = buildCloudInferencePayload("graph");
      label = `Attempt 2: graph-format payload (iteration ${i + 1})`;
      
      try {
        response = await postPrompt(payload, label);
        status = response.status;
        body = response.body;
      } catch (err) {
        log("error", `Retry request failed: ${err.message}`);
        process.exit(4);
      }
    }

    if (status !== 200) {
      log("error", `ComfyUI returned HTTP ${status}`, body);
      process.exit(4);
    }

    if (body.error) {
      log("error", `ComfyUI API error: ${body.error}`);
      process.exit(4);
    }

    log("ok", "Prompt submitted to ComfyUI queue", {
      promptID: body.prompt_id,
      queueRemaining: body.queue_remaining,
      clientID: CONFIG.clientID,
      iteration: i + 1
    });

    /* 3. Optionally poll for completion */
    if (CONFIG.poll && body.prompt_id) {
      log(
        "info",
        `Polling for completion (max ${CONFIG.maxPoll} × ${CONFIG.interval}ms)…`,
      );
      const completed = await pollHistory(body.prompt_id);
      if (completed) {
        log("ok", `Generation verified for iteration ${i + 1}`);
      } else {
        log("warn", `Generation did not complete within timeout for iteration ${i + 1}`);
      }
    } else {
      log("ok", `Prompt submitted successfully for iteration ${i + 1}`);
    }
    
    // Small delay between iterations
    if (i < CONFIG.loopCount - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(
    `\n${C.green}${C.bold}✅ Cloud-inference prompt loop completed successfully (${CONFIG.loopCount} iterations)${C.reset}\n`
  );
  process.exit(0);
}

main().catch((err) => {
  log("error", `Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
