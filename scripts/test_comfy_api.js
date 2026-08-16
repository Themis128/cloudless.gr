#!/usr/bin/env node
/**
 * /home/tbaltzakis/cloudless.gr/scripts/test_comfy_api.js
 *
 * ComfyUI API Integration Test — deterministic smoke test and payload validator.
 *
 * Usage:
 *   COMFY_CLIENT_ID="cloudless-test-123" node test_comfy_api.js
 *
 * This script:
 *  - Checks ComfyUI /prompt health
 *  - Builds a deterministic, validated payload using buildPayload()
 *  - Submits the payload to http://localhost:8000/prompt
 *  - Prints a concise readiness report
 *
 * The buildPayload implementation below intentionally:
 *  - Uses engine keys (e.g., "Primitive") not UI labels (e.g., "PrimitiveNode")
 *  - Enforces connection references as arrays like ["1", 0]
 *  - Rejects raw integer link values that cause server TypeError
 */

const { env, exit } = process;
const FETCH_TIMEOUT_MS = 10_000;
const COMFY_HOST = env.COMFY_HOST || "http://localhost:8000";
const PROMPT_ENDPOINT = `${COMFY_HOST.replace(/\/$/, "")}/prompt`;

// Stable client id (override with env var if desired)
const CLIENT_ID = env.COMFY_CLIENT_ID || "cloudless-test-override";

// -----------------------------
// Normalizer + Validator
// -----------------------------
function normalizeAndValidatePrompt(promptObj) {
  const nameMap = {
    PrimitiveNode: "Primitive",
    Primitive: "Primitive",
    "String Constant": "String Constant",
  };

  if (typeof promptObj !== "object" || promptObj === null) {
    throw new Error("Prompt must be an object mapping node ids to node definitions");
  }

  for (const [nodeId, nodeStruct] of Object.entries(promptObj)) {
    if (typeof nodeStruct !== "object" || nodeStruct === null) {
      throw new Error(
        `Invalid node structure for node ${nodeId}: expected object, got ${typeof nodeStruct}`
      );
    }

    if (!("class_type" in nodeStruct)) {
      throw new Error(`Missing class_type for node ${nodeId}`);
    }
    const rawType = nodeStruct.class_type;
    nodeStruct.class_type = nameMap[rawType] ?? rawType;

    if (
      !("inputs" in nodeStruct) ||
      typeof nodeStruct.inputs !== "object" ||
      nodeStruct.inputs === null
    ) {
      throw new Error(`Missing or invalid inputs for node ${nodeId}`);
    }

    for (const [inputKey, inputVal] of Object.entries(nodeStruct.inputs)) {
      // Accept primitive values (string, boolean) as-is
      if (Array.isArray(inputVal)) {
        // Single connection ["nodeId", index]
        if (
          inputVal.length === 2 &&
          typeof inputVal[0] === "string" &&
          Number.isInteger(inputVal[1])
        ) {
          continue;
        }
        // Array of connections: [ ["nodeId", index], ... ]
        if (
          inputVal.every(
            (v) =>
              Array.isArray(v) &&
              v.length === 2 &&
              typeof v[0] === "string" &&
              Number.isInteger(v[1])
          )
        ) {
          continue;
        }
        throw new Error(`Invalid connection array for node ${nodeId} input ${inputKey}`);
      } else if (typeof inputVal === "number") {
        // Allow numeric values for parameters like num_outputs, seed, etc.
        continue;
      } else {
        // string/boolean/null allowed
        continue;
      }
    }
  }
  return promptObj;
}

// -----------------------------
// Deterministic payload builder
// -----------------------------
function buildPayload(workflow, includeMetadata, format) {
  // This payload is intentionally simple and uses engine keys and correct link shapes
  const payload = {
    client_id: CLIENT_ID,
    prompt: {
      1: {
        class_type: "Replicate black-forest-labs/flux-schnell",
        inputs: {
          prompt: "A clean, modern flat minimalist infographic layout background, high contrast corporate accent waves, optimized for corporate carousel slide backgrounds --ar 1:1",
          aspect_ratio: "1:1",
          num_outputs: 1,
          seed: 1331,
          output_format: "webp",
          output_quality: 80,
          disable_safety_checker: false,
          go_fast: true,
          megapixels: "1",
        },
      },
      2: {
        class_type: "SaveImage",
        inputs: {
          images: ["1", 0],
          filename_prefix: "flux-schnell-social",
        },
      },
    },
  };

  // Validate and normalize before returning
  return { client_id: payload.client_id, prompt: normalizeAndValidatePrompt(payload.prompt) };
}

// -----------------------------
// HTTP helpers
// -----------------------------
async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function prettyPreview(obj, maxLines = 30) {
  const json = JSON.stringify(obj, null, 2);
  const lines = json.split("\n");
  if (lines.length <= maxLines) return json;
  return (
    lines.slice(0, maxLines).join("\n") + `\n… (${lines.length - maxLines} more lines truncated)`
  );
}

// -----------------------------
// Main flow
// -----------------------------
async function checkHealth() {
  const healthUrl = `${COMFY_HOST.replace(/\/$/, "")}/`;
  try {
    const res = await fetchWithTimeout(healthUrl, { method: "GET" }, 3000);
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function submitPrompt(payload) {
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  try {
    const res = await fetchWithTimeout(
      PROMPT_ENDPOINT,
      { method: "POST", headers, body },
      FETCH_TIMEOUT_MS
    );
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: res.status, ok: res.ok, body: json };
  } catch (err) {
    throw err;
  }
}

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  ComfyUI API Integration Test — cloudless.gr     ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  console.log("→ Stage 1: Checking ComfyUI endpoint health …");
  const healthy = await checkHealth();
  if (!healthy) {
    console.log("  ✗ HTTP 200 — NOT REACHABLE");
    console.log(`  Endpoint: ${COMFY_HOST}`);
    console.log("\n→ Stage 3: Readiness report\n");
    console.log("  ✖ ENDPOINT UNREACHABLE — cannot continue");
    exit(2);
  }
  console.log("  ✓ HTTP 200 — OK\n");

  console.log("→ Stage 2: Submitting prompt to /prompt …");
  console.log(`  Endpoint: ${PROMPT_ENDPOINT}`);
  console.log(`  Client ID: ${CLIENT_ID}`);
  console.log(`  Entry token: "n8n_social_media_factory"`);

  // Build payload and show preview
  let payload;
  try {
    payload = buildPayload(null, null, null);
  } catch (err) {
    console.error("\n  ✗ Failed to build payload:");
    console.error(`  ${err.message}`);
    console.log("\n→ Stage 3: Readiness report\n");
    console.log("  ⚠ ENDPOINT REACHABLE — PAYLOAD INVALID");
    exit(3);
  }

  console.log("  Payload preview:");
  console.log(prettyPreview(payload, 30));
  console.log("");

  // Submit
  try {
    const res = await submitPrompt(payload);
    if (res.ok) {
      console.log("  ✓ Prompt accepted");
      if (res.body && typeof res.body === "object") {
        if (res.body.prompt_id) {
          console.log(`  prompt_id: ${res.body.prompt_id}`);
        }
        if (res.body.status) {
          console.log(`  status:    ${res.body.status}`);
        }
        if (res.body.node_errors && Object.keys(res.body.node_errors).length > 0) {
          console.log("  node_errors:", JSON.stringify(res.body.node_errors));
        }
      } else {
        console.log("  response:", JSON.stringify(res.body));
      }
      console.log("\n→ Stage 3: Readiness report\n");
      console.log("  ✅ ENDPOINT READY");
      console.log("  ComfyUI is running and accepted the prompt.");
      console.log("  n8n workflows can now POST to " + PROMPT_ENDPOINT);
      exit(0);
    } else {
      console.log("  ~ Prompt rejected (HTTP " + res.status + ")");
      console.log(JSON.stringify(res.body, null, 2));
      console.log("\n→ Stage 3: Readiness report\n");
      console.log("  ⚠ ENDPOINT REACHABLE — PAYLOAD REJECTED");
      console.log("  ComfyUI is running but the prompt token structure was not accepted.");
      exit(4);
    }
  } catch (err) {
    console.error("  ✗ Error submitting prompt:");
    console.error("  " + (err && err.message ? err.message : String(err)));
    console.log("\n→ Stage 3: Readiness report\n");
    console.log("  ⚠ ENDPOINT REACHABLE — SUBMISSION FAILED");
    exit(5);
  }
}

// If run directly, execute main
if (require.main === module) {
  // Ensure global fetch exists (Node 18+). If not, instruct user.
  if (typeof fetch !== "function") {
    console.error(
      "Node global fetch is not available. Run on Node 18+ or install a fetch polyfill."
    );
    exit(10);
  }

  main().catch((err) => {
    console.error("Unhandled error:", err);
    exit(99);
  });
}

// Export functions for unit tests or external callers
module.exports = {
  buildPayload,
  normalizeAndValidatePrompt,
  CLIENT_ID,
  submitPrompt,
};
