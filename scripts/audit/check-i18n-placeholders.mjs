import { readFileSync } from "node:fs";

const locales = ["en", "el", "fr"];

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v, key));
    else if (typeof v === "string") out[key] = v;
  }
  return out;
}

function placeholders(value) {
  const matches = value.match(/\{[^}]+\}|%[sd]/g);
  return (matches ?? []).sort().join("|");
}

const data = Object.fromEntries(
  locales.map((l) => [l, flatten(JSON.parse(readFileSync(`src/locales/${l}.json`, "utf8")))]),
);

let failed = false;
for (const key of Object.keys(data.en)) {
  const base = placeholders(data.en[key] ?? "");
  for (const locale of locales.slice(1)) {
    const current = placeholders(data[locale][key] ?? "");
    if (base !== current) {
      failed = true;
      console.error(`Placeholder mismatch at ${key}: en=[${base}] ${locale}=[${current}]`);
    }
  }
}

if (failed) process.exit(1);
console.log("Locale placeholder consistency check passed.");
