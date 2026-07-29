#!/usr/bin/env node
/**
 * Reconstruct the ESP32 ESPHome Watchdog Notion page (post-2026-06-02 wipe).
 * Full history restore remains UI-only when retention still has a pre-incident rev.
 *
 * Requires: NOTION_API_KEY in env. Optional: NOTION_ESP32_*_DB_ID overrides.
 */
const NOTION_VERSION = "2022-06-28";
const TARGET_PAGE_ID = "3677d82c-410a-81e4-a6db-e9ae89578fda";
const DEVICES_DB_ID = process.env.NOTION_ESP32_DEVICES_DB_ID || "022b2212-995b-4e29-8c3c-900297b435b9";
const TELEMETRY_DB_ID = process.env.NOTION_ESP32_TELEMETRY_DB_ID || "3214d53d-90ff-4b7a-81c3-f689a92ee167";
const KEY = process.env.NOTION_API_KEY || "";

if (!KEY) {
  console.error("[esp32-restore] NOTION_API_KEY is required");
  process.exit(1);
}

function note(msg) {
  console.log(`[esp32-restore] ${msg}`);
}

async function notion(path, { method = "GET", body } = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Notion ${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

function propText(props, prefer = []) {
  for (const key of prefer) {
    const v = props[key];
    if (!v) continue;
    if (v.type === "title") return (v.title || []).map((t) => t.plain_text || "").join("");
    if (v.type === "rich_text") return (v.rich_text || []).map((t) => t.plain_text || "").join("");
    if (v.type === "select") return (v.select && v.select.name) || "";
    if (v.type === "number") return v.number == null ? "" : String(v.number);
    if (v.type === "url") return v.url || "";
    if (v.type === "checkbox") return String(Boolean(v.checkbox));
    if (v.type === "date") return (v.date && v.date.start) || "";
  }
  for (const [k, v] of Object.entries(props)) {
    if (v.type === "title") {
      const t = (v.title || []).map((x) => x.plain_text || "").join("");
      if (t) return t;
    }
    if (prefer.includes(k)) continue;
  }
  return "";
}

function flattenRow(page) {
  const row = { _created: page.created_time || "" };
  for (const [k, v] of Object.entries(page.properties || {})) {
    if (v.type === "title") row[k] = (v.title || []).map((t) => t.plain_text || "").join("");
    else if (v.type === "rich_text") row[k] = (v.rich_text || []).map((t) => t.plain_text || "").join("");
    else if (v.type === "select") row[k] = (v.select && v.select.name) || "";
    else if (v.type === "number") row[k] = v.number == null ? "" : String(v.number);
    else if (v.type === "url") row[k] = v.url || "";
    else if (v.type === "checkbox") row[k] = String(Boolean(v.checkbox));
    else if (v.type === "date") row[k] = (v.date && v.date.start) || "";
  }
  return row;
}

function p(text) {
  return { object: "block", type: "paragraph", paragraph: { rich_text: [{ text: { content: text.slice(0, 1900) } }] } };
}
function h1(text) {
  return { object: "block", type: "heading_1", heading_1: { rich_text: [{ text: { content: text } }] } };
}
function h2(text) {
  return { object: "block", type: "heading_2", heading_2: { rich_text: [{ text: { content: text } }] } };
}
function bul(text) {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: { rich_text: [{ text: { content: text.slice(0, 1900) } }] },
  };
}
function callout(text, emoji = "⚠️") {
  return {
    object: "block",
    type: "callout",
    callout: {
      rich_text: [{ text: { content: text.slice(0, 1900) } }],
      icon: { type: "emoji", emoji },
    },
  };
}
function divider() {
  return { object: "block", type: "divider", divider: {} };
}

async function main() {
  note(`=== notion-restore-esp32 ${new Date().toISOString()} ===`);
  note(`Target page: ${TARGET_PAGE_ID}`);

  let devices = [];
  let telemetry = [];
  try {
    const d = await notion(`/databases/${DEVICES_DB_ID}/query`, { method: "POST", body: { page_size: 100 } });
    devices = (d.results || []).map(flattenRow);
  } catch (err) {
    note(`Devices DB query failed (${err.status || err.message}) — continuing with empty list`);
  }
  note(`Devices rows: ${devices.length}`);

  try {
    const t = await notion(`/databases/${TELEMETRY_DB_ID}/query`, {
      method: "POST",
      body: { page_size: 10, sorts: [{ timestamp: "created_time", direction: "descending" }] },
    });
    telemetry = (t.results || []).map(flattenRow);
  } catch (err) {
    note(`Telemetry DB query failed (${err.status || err.message}) — continuing with empty list`);
  }
  note(`Telemetry rows: ${telemetry.length}`);

  note("Restoring page title...");
  await notion(`/pages/${TARGET_PAGE_ID}`, {
    method: "PATCH",
    body: {
      properties: {
        title: { title: [{ text: { content: "ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)" } }] },
      },
    },
  });

  note("Clearing overwritten blocks...");
  let cursor;
  do {
    const q = cursor ? `?start_cursor=${encodeURIComponent(cursor)}&page_size=100` : "?page_size=100";
    const existing = await notion(`/blocks/${TARGET_PAGE_ID}/children${q}`);
    for (const b of existing.results || []) {
      try {
        await notion(`/blocks/${b.id}`, { method: "DELETE" });
      } catch (err) {
        note(`  skip delete ${b.id}: ${err.status || err.message}`);
      }
    }
    cursor = existing.has_more ? existing.next_cursor : null;
  } while (cursor);

  note("Rebuilding page content...");
  const blocks = [
    callout(
      "CONTENT PARTIALLY RESTORED — This page was overwritten on 2026-06-02. History retention for Plus is ~30 days; by 2026-07-29 a pre-incident revision may no longer be available. Structured sections below were reconstructed from the ESP32 Devices and Telemetry DBs (historically empty) plus known watchdog facts.",
      "⚠️"
    ),
    divider(),
    h1("ESP32 ESPHome Watchdog — Pi Cluster Monitor (v2)"),
    p(
      "Hardware watchdog for the omv k3s cluster Pi nodes. Runs ESPHome firmware on ESP32 hardware to monitor cluster health and trigger physical resets if the Pi becomes unresponsive."
    ),
    divider(),
    h2("Registered Devices"),
  ];

  if (devices.length) {
    for (const d of devices) {
      const name =
        propText({ Name: { type: "title", title: [{ plain_text: d.Name || d.name || d.Device || d.Title || "" }] } }, [
          "Name",
        ]) ||
        d.Name ||
        d.name ||
        d.Device ||
        d.Title ||
        "device";
      const details = Object.entries(d)
        .filter(([k, v]) => v && !["_created", "Name", "name", "Device", "Title"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      blocks.push(bul(details ? `${name} — ${details}` : name));
    }
  } else {
    blocks.push(bul("(No devices in ESP32 Devices DB — databases were empty historically; seed via ESPHome when hardware is online.)"));
  }

  blocks.push(divider(), h2("Recent Telemetry"));
  if (telemetry.length) {
    for (const t of telemetry.slice(0, 5)) {
      const created = (t._created || "").slice(0, 16).replace("T", " ");
      const name = t.Name || t.name || t.Device || t.Title || "entry";
      const details = Object.entries(t)
        .filter(([k, v]) => v && !["_created", "Name", "name", "Device", "Title"].includes(k))
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      blocks.push(bul(`[${created}] ${name}${details ? ` — ${details}` : ""}`));
    }
  } else {
    blocks.push(bul("(No recent telemetry — Telemetry DB empty historically.)"));
  }

  blocks.push(
    divider(),
    h2("Recovery Note"),
    p("If Notion plan history still retains a pre-2026-06-02 15:19 UTC revision:"),
    bul("Open this page → ••• → Page history → restore that revision"),
    bul("Devices + Telemetry nested DBs are unaffected by page restore"),
    p("Otherwise this reconstructed skeleton is the durable baseline going forward.")
  );

  const append = await notion(`/blocks/${TARGET_PAGE_ID}/children`, {
    method: "PATCH",
    body: { children: blocks.slice(0, 100) },
  });
  note(`Append object: ${append.object || "unknown"} children=${(append.results || []).length}`);

  const pageUrl =
    "https://www.notion.so/ESP32-ESPHome-Watchdog-Pi-Cluster-Monitor-v2-3677d82c410a81e4a6dbe9ae89578fda";
  note("=== DONE ===");
  note(`Restored (partial): ${pageUrl}`);
}

main().catch((err) => {
  console.error("[esp32-restore] FAILED", err.message, err.body ? JSON.stringify(err.body).slice(0, 400) : "");
  process.exit(1);
});
