---
name: evidence-doc-publish
description: Turn HTML evidence documents into PDFs and publish them to the tokenized evidence server (evidence.cloudless.gr) on omv. Use for "generate pdf", "upload pdf", "new version", "κοινοποίηση εγγράφου", police-report/έγκληση/αίτηση document revisions in mpaltzakis-house-2026-11 or similar case dossiers.
---

# evidence-doc-publish — HTML → PDF → tokenized HTTPS

Publishes case documents (έγκληση, αστυνομική αναφορά, αίτηση ασφαλιστικών μέτρων, indexes) as PDFs to the token-gated evidence host.

## Facts

- **Case dir on omv:** `/home/tbaltzakis/evidence/mpaltzakis-house-2026-11/`
- **Base token URL:** `https://evidence.cloudless.gr/t/8827d83d8c003907a5818f4c142987d52630e94a38d4fd7a/mpaltzakis-house-2026-11/`
- **Local source dir:** `C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence\`
- **Token server behavior:** no directory listing — only **full file paths** resolve; base URL alone 404s (by design). PDFs serve `application/octet-stream` (download, not inline).
- **Filenames:** underscore-separated, no dashes (user preference 2026-11-11): `EGKLISI_mpaltzakis_house_2026_11.pdf`, `REPORT_mpaltzakis_house_2026_11.pdf`, `AITISI_ASFALISTIKA_METRA_2026_11.pdf`, `VIDEO_INDEX.pdf`.

## The tool

`scripts/publish-doc.py` — one command per document:

```
python publish-doc.py EGKLISI-mpaltzakis-house-2026-11.html \
    --out EGKLISI_mpaltzakis_house_2026_11.pdf [--case mpaltzakis-house-2026-11] [--no-upload]
```

Pipeline: headless Chrome `--print-to-pdf` → scp to omv case dir → `curl` the full token URL → prints `200`/size + final link. Exit non-zero if any stage fails.

## Workflow conventions (learned 2026-11-11)

1. **Edit the `.html` source**, never the PDF. Sources live next to the PDFs in the correspondence dir.
2. **Verify content before publishing** — extract text with `pypdf` and grep for the new phrases; a 200 alone doesn't prove the edit rendered.
3. **Dash-free text**: user asked to remove all `—`/`–` separator dashes from PDFs. Rule used: numeric ranges `9–10` → `9 έως 10`; other separator dashes → space/comma. Keep intra-word hyphens (`e-mail`, `SHA-256`, `βίντεο-κλιπ`) and literal filenames inside `<code>`.
4. **File-lock gotcha**: if the user has the PDF open in a viewer, Chrome can't overwrite it — write to a `-new.pdf` temp name, upload that under the canonical remote name via `scp` + `ssh mv`.
5. **Versioning**: keep old versions on the server unless the user asks to clean up; always link the newest canonical underscore name.
6. After publishing, give the **complete URL** (never abbreviate with `…` — it 404s).

## Related

- `evidence-pipeline` — builds the dossier itself (clips, hashes, manifests).
- `evidence-dossier-index` — VIDEO_INDEX.pdf generator.
- `gmail-send-ops` — sending the published PDFs by email (`--attach` supported).
- Case state: `POLICE-CONTACTS.md`, `POLICE-REPORT-2026-11-10.md` in the correspondence dir.

## R2 offsite sync (added 2026-11-11)

Every successful publish auto-syncs the file to the R2 bucket
`evidence-mpaltzakis` under `t/<token>/<case>/<name>` via `ssh omv rclone copyto`
(remote `r2ev`, creds `~/r2-s3-creds` → `~/.config/rclone/rclone.conf`).
Public base: `https://pub-6db4c5dc5fee4d5ba450ae560cf8340c.r2.dev/t/<token>/<case>/`
— same token path as evidence.cloudless.gr. Opt out with `--no-r2`.
Daily backstop: omv `evidence-backup-sync.sh` (04:30) rsyncs all cases to
omv-ha AND rclone-syncs mpaltzakis-house-2026-11 to R2.

## Stale-object guards (added 2026-11-11)

- `publish-doc.py` R2 step now does a **read-back verify**: HEAD on the
  evidence.cloudless.gr URL (Worker→R2) and compares Content-Length + ETag
  (MD5 for single-part uploads) against the local PDF — exits non-zero on
  mismatch, so a failed sync can never pass silently.
- omv `evidence-backup-sync.sh` (04:30) ends with `rclone check --one-way`
  hash-comparing all 616 files omv→R2 and sends a Telegram alert on any
  drift (verified: "0 differences found / 616 matching files").
- Worker `evidence-r2` gotcha (fixed): only pass `{range: request.headers}`
  to `BUCKET.get` when a Range header exists — unconditional passing made
  plain GETs return 206. Always gate the 206 branch on the request's Range.
