#!/usr/bin/env node
/**
 * Sync workflow JSON files from infrastructure/n8n/workflows/ into the
 * live n8n pod via kubectl exec (no API key required).
 *
 * Strategy:
 *   1. Export all existing workflows from the pod to get name → id mapping.
 *   2. For each local JSON: if a workflow with the same name exists, set its
 *      id in the payload so n8n updates it. Otherwise omit id so n8n creates.
 *   3. Copy the prepared JSON into the pod and run `n8n import:workflow`.
 *
 * Required env vars:
 *   N8N_NAMESPACE   (default: n8n)
 *   KUBECONFIG      (default: /etc/rancher/k3s/k3s.yaml on Pi runner)
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dir = dirname(fileURLToPath(import.meta.url));
const WORKFLOWS_DIR = join(__dir, "..", "infrastructure", "n8n", "workflows");
const NS = process.env.N8N_NAMESPACE ?? "n8n";
const SUDO = process.env.KUBECTL_SUDO === "false" ? "" : "sudo ";

function kube(cmd) {
  return execSync(`${SUDO}kubectl ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function kubeSilent(cmd) {
  try {
    return kube(cmd);
  } catch {
    return "";
  }
}

function nameFromFilename(file) {
  return basename(file, ".json")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const files = readdirSync(WORKFLOWS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  console.log(`\n📂  ${files.length} workflow file(s) in infrastructure/n8n/workflows/\n`);

  // Get the n8n pod name
  const pod = kube(
    `get pods -n ${NS} -l app=n8n -o jsonpath='{.items[0].metadata.name}'`
  ).replace(/'/g, "");

  if (!pod) {
    console.error("No n8n pod found in namespace", NS);
    process.exit(1);
  }
  console.log(`🔗  Pod: ${pod}\n`);

  // Export all existing workflows from the pod to get name→id mapping
  kubeSilent(
    `exec -n ${NS} ${pod} -- n8n export:workflow --all --output=/tmp/n8n-export.json`
  );
  let existing = [];
  try {
    const raw = kubeSilent(`exec -n ${NS} ${pod} -- cat /tmp/n8n-export.json`);
    if (raw) existing = JSON.parse(raw);
    if (!Array.isArray(existing)) existing = [];
  } catch {
    existing = [];
  }
  const byName = new Map(existing.map((w) => [w.name, w.id]));
  console.log(`   ${existing.length} workflow(s) already in n8n\n`);

  let created = 0,
    updated = 0,
    errors = 0;

  for (const file of files) {
    const filePath = join(WORKFLOWS_DIR, file);
    let wf;
    try {
      wf = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch (e) {
      console.error(`  ✗  ${file}: JSON parse error — ${e.message}`);
      errors++;
      continue;
    }

    if (!wf.name?.trim()) wf.name = nameFromFilename(file);
    const name = wf.name;

    // Set id to the live workflow's id so n8n updates instead of creating
    const existingId = byName.get(name);
    if (existingId !== undefined) {
      wf.id = existingId;
    } else {
      delete wf.id;
    }
    delete wf.tags; // n8n import rejects unknown tag ids

    const tmpLocal = `/tmp/n8n-wf-${Date.now()}.json`;
    const tmpPod = `/tmp/n8n-wf-import.json`;

    try {
      writeFileSync(tmpLocal, JSON.stringify(wf));
      kube(`cp ${tmpLocal} ${NS}/${pod}:${tmpPod}`);
      const out = kube(
        `exec -n ${NS} ${pod} -- n8n import:workflow --input=${tmpPod}`
      );
      const isUpdate = existingId !== undefined;
      console.log(`  ${isUpdate ? "↺" : "+"}  ${isUpdate ? "Updated" : "Created"} : ${name}`);
      if (out && !out.includes("Successfully")) console.log(`     ${out.trim()}`);
      isUpdate ? updated++ : created++;
    } catch (e) {
      console.error(`  ✗  Error   : ${name} — ${e.stderr ?? e.message}`);
      errors++;
    }
  }

  console.log(`\n✅  Done — created: ${created}  updated: ${updated}  errors: ${errors}\n`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
