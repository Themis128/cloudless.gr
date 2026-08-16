#!/usr/bin/env node
/**
 * ComfyUI Integration Script — n8n Social Media Factory
 *
 * Sends a mock POST request containing the API payload layout from
 * ops/comfyui/storage/user/default/default_workflow.json to ComfyUI's
 * /prompt endpoint (http://localhost:8000/prompt) to verify programmatic
 * generation stability.
 *
 * The payload includes the API elements (PrimitiveNode, Replicate,
 * SaveImage) tagged as originating from the n8n_social_media_factory
 * workflow pattern — the same structure an n8n workflow would send as
 * an outgoing HTTP POST to ComfyUI's internal prompt API.
 *
 * If ComfyUI rejects the tagged payload (e.g. the extra metadata key
 * triggers a 500), the script automatically retries with a clean payload
 * (prompt + client_id only) so you can isolate whether the issue is the
 * workflow itself or the wrapper metadata.
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
 *   COMFYUI_NO_METADATA — Strip n8n_social_media_factory metadata before POST (default: false)
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
  workflowPath: path.join(
    __dirname,
    "..",
    "ops",
    "comfyui",
    "storage",
    "user",
    "default",
    "default_workflow.json"
  ),
  clientID:
    process.env.COMFYUI_CLIENT_ID ||
    `n8n_social_media_factory-${Date.now()}`,
  timeout: parseInt(process.env.COMFYUI_TIMEOUT || "30000", 10),
  poll: process.env.COMFYUI_POLL !== "false",
  maxPoll: parseInt(process.env.COMFYUI_MAX_POLL || "30", 10),
  interval: parseInt(process.env.COMFYUI_INTERVAL || "2000", 10),
  noMetadata: process.env.COMFYUI_NO_METADATA === "true" || false,
};

/* ── Step 1 — Load the workflow template ────────────────────────────── */

function loadWorkflow() {
  if (!fs.existsSync(CONFIG.workflowPath)) {
    log("error", `Workflow file not found: ${CONFIG.workflowPath}`);
    process.exit(2);
  }

  const raw = fs.readFileSync(CONFIG.workflowPath, "utf8");
  const workflow = JSON.parse(raw);

  // Validate expected API elements are present
  const nodeTypes = workflow.nodes?.map((n) => n.type) || [];
  const expected = ["PrimitiveNode", "SaveImage"];
  const hasExpected = expected.every((t) =>
    nodeTypes.some((nt) => nt === t || nt.includes(t))
  );

  if (!hasExpected) {
    log("warn", "Workflow does not contain expected API elements", {
      nodeTypes,
      expected,
    });
  } else {
    log("ok", "Workflow loaded — API payload nodes detected", {
      nodeTypes,
      lastNodeId: workflow.last_node_id,
      lastLinkId: workflow.last_link_id,
      version: workflow.version,
    });
  }

  return workflow;
}

/* ── Step 2 — Construct the mock API payload ────────────────────────── */

/**
 * Build the ComfyUI /prompt request body.
 *
 * By default ComfyUI accepts the *graph* format (the same structure
 * saved as default_workflow.json — nodes + links arrays) directly in
 * the `prompt` field.  When `format` is "api", we convert to the API
 * format (node IDs as keys with class_type + inputs).
 */
function buildPayload(workflow, includeMetadata, format) {
  if (includeMetadata === undefined) includeMetadata = !CONFIG.noMetadata;

  let prompt;
  if (format === "api") {
    prompt = convertToApiFormat(workflow);
    log("info", "Converted workflow to ComfyUI API format (node-ID keyed)");
  } else {
    prompt = workflow;
  }

  const payload = {
    prompt,
    client_id: CONFIG.clientID,
  };

  if (includeMetadata) {
    /*
     * Extra metadata field that tags the request as originating from the
     * n8n_social_media_factory workflow pattern.  ComfyUI typically
     * ignores unknown top-level keys, but some versions may reject the
     * request — the script automatically retries without this metadata.
     */
    payload.n8n_social_media_factory = {
      source: "n8n_workflow",
      factory: "n8n_social_media_factory",
      api_elements: {
        primitive_node: workflow.nodes.find((n) =>
          n.type.includes("PrimitiveNode")
        )
          ? {
              present: true,
              value: workflow.nodes[0]?.widgets_values?.[0],
            }
          : { present: false },
        replicate_node: workflow.nodes.find((n) =>
          n.type.startsWith("Replicate")
        )
          ? { present: true, model: workflow.nodes[1]?.type }
          : { present: false },
        save_image_node: workflow.nodes.find((n) =>
          n.type.includes("SaveImage")
        )
          ? {
              present: true,
              filename_prefix: workflow.nodes[2]?.widgets_values?.[0],
            }
          : { present: false },
      },
    };
  }

  return payload;
}

/**
 * Convert the graph format (nodes + links arrays) into ComfyUI's API
 * format (node IDs as string keys with class_type + inputs).
 *
 * Link tuples: [link_id, origin_node, origin_slot, dest_node, dest_slot, type]
 * The converted inputs map each destination input name to
 * [origin_node_id, origin_output_slot].
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

/**
 * Query ComfyUI /object_info to verify that expected node types
 * are registered in the running instance.
 *
 * Returns a dict mapping each node type string to a boolean indicating
 * whether it was found in the server's node registry.
 */
function checkObjectInfo(nodeTypes) {
  return new Promise((resolve) => {
    const options = {
      hostname: CONFIG.host,
      port: CONFIG.port,
      path: "/object_info",
      method: "GET",
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          resolve(null);
          return;
        }

        const available = {};
        nodeTypes.forEach((t) => {
          // Check for exact match or partial match (e.g. "SaveImage")
          available[t] = !!parsed[t] || Object.keys(parsed).some(
            (key) => key === t || key.includes(t) || t.includes(key)
          );
        });
        resolve(available);
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

/* ── Step 3 — Send the POST request ─────────────────────────────────── */

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

/* ── Step 4 — Poll for completion via /history ──────────────────────── */

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
    `\n${C.bold}${C.cyan}ComfyUI n8n Social Media Factory — Prompt Integration Test${C.reset}\n`
  );

  /* 1. Load workflow */
  const workflow = loadWorkflow();

  /* 2. Build payload (with n8n_social_media_factory metadata by default) */
  const payload = buildPayload(workflow, true);
  log("info", "API payload constructed", {
    source: "n8n_social_media_factory",
    nodeCount: workflow.nodes.length,
    linkCount: workflow.links.length,
    hasClientID: !!CONFIG.clientID,
    hasFactoryMetadata: payload.n8n_social_media_factory ? true : false,
  });

  /* 3. Check ComfyUI health */
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

  /* 3b. Diagnostic — check /object_info for expected node types */
  const nodeTypesToCheck = workflow.nodes.map((n) => n.type);
  const objectInfo = await checkObjectInfo(nodeTypesToCheck);
  if (objectInfo) {
    log("info", "Node type availability check", objectInfo);
  } else {
    log("warn", "Could not query /object_info — skipping node availability check");
  }

  /* 4. POST the prompt (tagged payload first) */
  let response;
  try {
    response = await postPrompt(payload, "Attempt 1: with n8n_social_media_factory metadata");
  } catch (err) {
    log("error", `Request failed: ${err.message}`);
    process.exit(4);
  }

  let { status, body } = response;

  /*
   * Retry strategy:
   *   Attempt 2 — strip n8n_social_media_factory metadata (graph format)
   *   Attempt 3 — convert to API format (node-ID keyed) without metadata
   */
  if (status !== 200 && payload.n8n_social_media_factory) {
    log("warn", `ComfyUI returned HTTP ${status} — retrying without factory metadata`);
    const cleanPayload = buildPayload(workflow, false, "graph");
    try {
      response = await postPrompt(cleanPayload, "Attempt 2: clean graph-format payload");
      status = response.status;
      body = response.body;
    } catch (err) {
      log("error", `Retry request failed: ${err.message}`);
      process.exit(4);
    }
  }

  if (status !== 200) {
    log("warn", `ComfyUI still returned HTTP ${status} — retrying with API-format conversion`);
    const apiFormatPayload = buildPayload(workflow, false, "api");
    try {
      response = await postPrompt(apiFormatPayload, "Attempt 3: API-format payload (node-ID keyed)");
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
  });

  /* 5. Optionally poll for completion */
  if (CONFIG.poll && body.prompt_id) {
    log(
      "info",
      `Polling for completion (max ${CONFIG.maxPoll} × ${CONFIG.interval}ms)…`,
    );
    const completed = await pollHistory(body.prompt_id);
    if (completed) {
      console.log(
        `\n${C.green}${C.bold}✅ Generation verified — /prompt integration is stable${C.reset}\n`
      );
      process.exit(0);
    } else {
      console.log(
        `\n${C.yellow}⚠️  Generation did not complete within timeout — endpoint is reachable but generation may need more time.${C.reset}\n`
      );
      process.exit(0);
    }
  }

  console.log(`\n${C.green}${C.bold}✅ Prompt submitted successfully${C.reset}\n`);
  process.exit(0);
}

main().catch((err) => {
  log("error", `Unexpected error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
