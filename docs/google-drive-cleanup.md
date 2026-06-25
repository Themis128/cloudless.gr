# Google Drive cleanup — operator runbook

**When to use:** Google warns "X% of storage used" (typically 70%+) on the
operator account. This runbook walks through finding what's actually
consuming the storage and clearing it safely.

**Important:** this session's `cloudless.gr/` Drive folder is **NOT
likely the cause**. All session uploads (session summaries, strategy
docs, etc.) total <100 KB. The warning almost always comes from one of:
**Gmail attachments**, **Google Photos**, or **older Drive files** from
other contexts. Check before deleting cloudless.gr content.

## Step 1 — see what's actually full (5 min)

Open [one.google.com/storage/management](https://one.google.com/storage/management).
This page shows a single bar broken down by product (Drive / Gmail /
Photos) and a sortable list of large items.

Sort by **size, descending**. Note the top 10 items and which product
each belongs to.

| If the top items are… | Go to… |
|---|---|
| Gmail attachments | Step 2 |
| Google Photos | Step 3 |
| Drive files | Step 4 |
| A mix | Step 2 → 3 → 4 in order |

## Step 2 — Gmail attachment cleanup

In Gmail search bar:

```
has:attachment larger:10M
```

Returns every email with an attachment ≥10 MB. Common culprits:

- Large image / video sends from family / clients
- Old design exports (PDFs, mockups)
- Backup attachments that someone emailed "just in case"

For each email you no longer need: open → ⋮ → **Delete forever**
(not just "Move to Trash" — trash still counts against quota for 30
days). Or use **Empty Trash now** in Trash.

To search progressively larger: `larger:25M`, `larger:50M`,
`larger:100M`.

## Step 3 — Google Photos cleanup

Open [Google Photos storage settings](https://photos.google.com/quota).

Three actions in order:

1. **"Recover storage"** — converts original-quality photos to
   "Storage saver" (slight quality loss, big saving). One-time bulk
   operation.
2. **"Manage storage"** → review:
   - **Blurry photos** — Google flags suggestions to delete
   - **Screenshots** — usually safe to bulk-delete
   - **Large videos** — biggest single items
3. **Album review** — bulk-select any one-off events you no longer
   need (e.g. duplicate camera-roll syncs).

## Step 4 — Drive cleanup

Open [drive.google.com](https://drive.google.com), click **Storage**
in the left sidebar. Files sort by size, biggest first.

Common cleanup targets:

- **Old exports / backups** — ZIP archives, video exports
- **Trash** — files deleted >30 days ago that the system kept "just in case"
- **Orphan files** — files with no parent folder (search `is:unorganized`)
- **Hidden duplicates** — search `title contains 'copy'` /
  `title contains '(1)'`

## Step 5 — cloudless.gr folder audit (optional)

If you want to see what `cloudless.gr/` specifically is using, run from
this repo:

```bash
node scripts/audit-drive-folder.mjs
```

The script lists the top 20 largest files in the `cloudless.gr/`
Drive folder, sorted descending. See its docstring for required
credentials (`GOOGLE_APPLICATION_CREDENTIALS` pointing at a service
account JSON with read access to the folder).

Today's footprint is ~50 KB across ~20 markdown files — the warning
is upstream of cloudless.gr in the vast majority of cases.

## Step 6 — empty Trash (final pass)

Even after deleting, Trash holds items for 30 days. To reclaim space
immediately:

- Drive → Trash → "Empty trash now"
- Gmail → Bin → "Empty Bin now"
- Photos → "Bin" → "Empty bin"

All three are at the bottom of their respective Trash views.

## Automation status

**Not configured:** there is no scheduled Drive cleanup workflow in
this repo. Adding one (deleting files in `cloudless.gr/exports/`
older than N days) requires:

1. A Google service account with `drive.file` scope
2. The service account email added as Editor on the
   `cloudless.gr/` shared folder
3. Service-account key in SSM (`/cloudless/production/GDRIVE_SA_KEY`)
4. A `.github/workflows/probe-drive-cleanup.yml` workflow using the
   SA key

None of these are set up today. If the cloudless.gr footprint ever
gets big enough to matter (it isn't — <100 KB total), we can wire
this up as an R-row. Until then, follow Step 5 manually if you want
to audit the cloudless.gr folder.

## See also

- `scripts/audit-drive-folder.mjs` — read-only audit script
- [Google One Storage Manager](https://one.google.com/storage/management) — primary tool for the 70% problem
- [Google's "How to free up Drive space"](https://support.google.com/drive/answer/6374270)
