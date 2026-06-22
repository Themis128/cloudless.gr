#!/usr/bin/env node
/**
 * audit-drive-folder.mjs — list the top-N largest files in the
 * cloudless.gr Google Drive folder, sorted by size descending.
 *
 * Read-only. Does not delete, move, or modify anything.
 *
 * Companion to docs/google-drive-cleanup.md.
 *
 * Usage:
 *   GDRIVE_FOLDER_ID=1k6VAptaVgLCD0W9TWLsVhzjrcP1J_r6a \
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
 *     node scripts/audit-drive-folder.mjs [--top N]
 *
 * Defaults:
 *   --top 20
 *   GDRIVE_FOLDER_ID = the cloudless.gr folder id (above)
 *
 * Required IAM:
 *   The service account in GOOGLE_APPLICATION_CREDENTIALS must be
 *   added as at least Viewer on the target folder. The folder ID
 *   can be copied from drive.google.com → folder → right-click →
 *   "Get link" → the ID is the trailing path segment.
 *
 * Why not in CI:
 *   No service account is provisioned today. The cloudless.gr Drive
 *   footprint is ~50 KB total across ~20 files (verified 2026-06-22),
 *   so a scheduled cleanup is not justified. This script exists for
 *   the operator to run locally when curious.
 */

const TOP = (() => {
  const idx = process.argv.indexOf("--top");
  if (idx === -1) return 20;
  return Number.parseInt(process.argv[idx + 1] ?? "20", 10);
})();
const FOLDER_ID =
  process.env.GDRIVE_FOLDER_ID || "1k6VAptaVgLCD0W9TWLsVhzjrcP1J_r6a";

async function main() {
  let google;
  try {
    ({ google } = await import("googleapis"));
  } catch (err) {
    console.error(
      'Missing dep: install once with "npm install googleapis" in this dir, then re-run.'
    );
    console.error("Original error:", err.message);
    process.exit(2);
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error(
      "GOOGLE_APPLICATION_CREDENTIALS env var is not set. Point it at a service-account JSON with Viewer on the folder."
    );
    process.exit(2);
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  });
  const drive = google.drive({ version: "v3", auth });

  // Walk the folder recursively. Drive does not return cumulative
  // folder size, so we collect all descendant files then sort.
  const all = [];
  const folderQueue = [FOLDER_ID];

  while (folderQueue.length > 0) {
    const folderId = folderQueue.shift();
    let pageToken;
    do {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, size, modifiedTime, parents)",
        pageSize: 100,
        pageToken,
      });
      for (const f of res.data.files ?? []) {
        if (f.mimeType === "application/vnd.google-apps.folder") {
          folderQueue.push(f.id);
        } else if (f.size) {
          all.push({
            id: f.id,
            name: f.name,
            mime: f.mimeType,
            sizeBytes: Number(f.size),
            modifiedTime: f.modifiedTime,
          });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  if (all.length === 0) {
    console.log(`No files with reported size under folder ${FOLDER_ID}.`);
    console.log(
      "Note: Google Docs/Sheets/Slides have no `size` field; they don't count against the 15 GB quota the same way."
    );
    return;
  }

  all.sort((a, b) => b.sizeBytes - a.sizeBytes);
  const totalBytes = all.reduce((sum, f) => sum + f.sizeBytes, 0);

  console.log(`Folder ID:  ${FOLDER_ID}`);
  console.log(`Files counted (with size field): ${all.length}`);
  console.log(`Total bytes:  ${fmt(totalBytes)}`);
  console.log(`Top ${Math.min(TOP, all.length)} largest:`);
  console.log("");
  console.log("  size       modified            name");
  console.log("  ---------- ------------------- ----");
  for (const f of all.slice(0, TOP)) {
    console.log(
      `  ${fmt(f.sizeBytes).padStart(10)} ${(f.modifiedTime ?? "").slice(0, 19)} ${f.name}`
    );
  }
}

function fmt(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
