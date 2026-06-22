# Google Photos / Drive → omv NAS migration

**Goal:** move bulk media (photos + videos + large attachments) out of
Google's 200 GB quota and onto the omv-main NAS (`sdb1`, 916 GB
Samsung 1TB), then delete from the cloud so Google quota drops back
under threshold.

**Why this works:** per memory `project_pi_disk_layout`, `sdb1` is
already designated **"user data only: Windows backups, photos, media.
K3s does NOT live here."** It's exactly the right home.

**Today's starting point:** Google = 140.82 GB / 200 GB = 70%
(operator-reported 2026-06-22). Need to clear ~80 GB to comfortably
return to <30%.

## Step 0 — REMOVE the old Windows backup FIRST (per operator instruction)

This is a precondition for the photo migration: the operator wants
the old Windows backup gone before any new media lands on `sdb1`.
The 2026-06-13 incident showed the backup at ~624 GB; even if it's
been pruned since, anything still there should go.

```bash
# From your workstation:
ssh tbaltzakis@omv

# On omv-main:
BACKUP_ROOT="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/Backups/WindowsImageBackup"

# 1. See what's there + how much it weighs
sudo du -sh "$BACKUP_ROOT"
sudo ls -lh "$BACKUP_ROOT"

# 2. Check current free space on sdb1 (the target disk)
df -h "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"

# 3. Confirm dates of backups — the most recent dated dir is the
#    one Windows would restore from. Decide if you want to keep
#    the latest or wipe everything.
sudo ls -lt "$BACKUP_ROOT"

# 4a. Wipe ALL backups (frees the most space; loses restore point):
sudo rm -rf "$BACKUP_ROOT"/*

# 4b. OR keep only the most recent backup, delete older dated dirs:
sudo ls -1t "$BACKUP_ROOT" | tail -n +2 | xargs -I{} sudo rm -rf "$BACKUP_ROOT/{}"

# 5. Verify space freed
df -h "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"

# 6. Also disable / pause Windows backup destination from `Office`
#    workstation so it doesn't immediately refill — Settings →
#    Update & Security → Backup → More options → Stop using drive.
#    Or change the destination to a separate external USB drive.
```

**Don't disable the OMV SMB share for that directory** — leave the
share definition alone in OMV's web UI; just empty the directory.
Windows backup tooling on `Office` may continue pointing at it; if
you don't want any future writes, change the SMB ACL to read-only
OR change the destination from Windows side.

## Step 1 — verify target disk has the headroom

After Step 0:

```bash
ssh tbaltzakis@omv
df -h "/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7"
```

Want to see **at least 200 GB free** to comfortably accept ~140 GB of
media + working room. If you wiped the WS backup and have ≥800 GB
free, you're set.

## Step 2 — prepare the destination folder + SMB share

```bash
ssh tbaltzakis@omv

TARGET="/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive"
sudo mkdir -p "$TARGET"/{photos,drive,gmail-attachments}
sudo chown -R tbaltzakis:users "$TARGET"
```

If an SMB share for this path doesn't already exist, add one in OMV
web UI:

- OMV → Services → SMB/CIFS → Shares → Add
- Shared folder: pick (or create new) on the `sdb1` filesystem
  pointing at `google-archive`
- Public: No. Browseable: Yes. Inherit permissions: Yes.

Then from any client (Windows / Mac / Linux):

```
\\omv\google-archive   (Windows)
smb://omv/google-archive   (Mac, then ⌘K Finder → Connect to Server)
```

## Step 3 — export from Google via Takeout

[takeout.google.com](https://takeout.google.com) — Google's official
export tool. Settings to use for this migration:

1. **Deselect all** at the top
2. Re-select only: **Google Photos**, **Drive**, **Gmail**
   (deselect Gmail if you only want to clear Photos + Drive)
3. Click **Next step**
4. Delivery method: **Send download link via email** (default)
5. Frequency: **Export once**
6. File type: **.zip** (or **.tgz** if your client prefers)
7. File size: **50 GB** (the max — fewer files to wrangle).
   Takeout will split into multiple 50 GB chunks if total >50 GB.
8. Click **Create export**

Google emails a download link when the export is ready
(usually 1-24 hours for 140 GB; can take longer if Photos is large).

**While waiting, you can also use `gphotos-sync` for incremental
photo backups** — but Takeout is simpler for a one-shot migration.

## Step 4 — download Takeout chunks straight onto omv

When the email arrives with download URLs:

```bash
ssh tbaltzakis@omv
cd /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive

# Copy the download URL from the Takeout email and paste here.
# Google's URLs expire — download within 7 days of issue.
for url in \
  "https://takeout.google.com/transfer/zip/...?id=..." \
  "https://takeout.google.com/transfer/zip/...?id=..."
do
  wget -c "$url"
done
```

Or do it from your workstation and then `rsync` to omv:

```bash
# On workstation
rsync -avhP ~/Downloads/takeout-*.zip \
  tbaltzakis@omv:/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive/
```

`-c` (wget) and `-P` (rsync) both resume interrupted transfers, which
matters for 50 GB chunks.

## Step 5 — extract + organize

```bash
ssh tbaltzakis@omv
cd /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive
for z in takeout-*.zip; do
  unzip -q "$z" && rm "$z"   # remove ZIP after successful extract
done
```

The `Takeout/` directory tree will be:

```
Takeout/
  Google Photos/
    Album Name/
      IMG_20250101.jpg
      IMG_20250101.jpg.json   # Takeout metadata sidecar
  Drive/
    My Drive/
      ...
```

Optionally flatten the photos out of the album dirs (preserves no
album metadata but is easier to browse):

```bash
find Takeout/Google\ Photos -type f \( -iname '*.jpg' -o -iname '*.heic' -o -iname '*.mp4' -o -iname '*.mov' \) \
  -exec mv -n {} photos/ \;
```

## Step 6 — VERIFY before deleting from cloud

**Critical:** never delete from Google until you've confirmed locally.

```bash
ssh tbaltzakis@omv
cd /srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7/google-archive
du -sh .              # total downloaded
find . -type f | wc -l   # file count
```

Cross-check against the Takeout email's reported size + file count.
**They should match within 1%** (Google adds metadata sidecars,
which can inflate the count slightly).

Then spot-check 10 random files:

```bash
find . -type f | shuf -n 10 | xargs -I{} ls -la "{}"
```

Open a few in an image viewer to confirm they're not corrupt.

## Step 7 — delete from cloud

Once verified:

1. **Google Photos:** photos.google.com → ☰ → Bin → "Empty bin" only after
   bulk-selecting albums to delete. Or use the Trash auto-empty
   (30 days) if you can wait.
2. **Drive:** drive.google.com → individual files / folders → Move to
   Trash → "Empty trash" at the bottom-left.
3. **Gmail attachments:** see `docs/google-drive-cleanup.md` Step 2 —
   `larger:25M` search → delete forever (Shift+Delete or use the
   "Delete forever" option in Trash).

## Step 8 — confirm Google quota dropped

[one.google.com/storage/management](https://one.google.com/storage/management)
should show the freed space within ~1 hour (Google's quota
recalculation isn't instant).

If quota didn't drop:
- Empty Trash in **all three** products (Drive / Gmail / Photos) —
  Trash holds for 30 days otherwise
- Check `is:unorganized` in Drive for orphaned files

## Step 9 — set up ongoing backup (optional)

Once the migration works, prevent the problem from recurring:

- **Google Photos:** turn OFF "Back up & sync" on the phone, OR set
  it to "Storage saver" instead of "Original quality"
- **Drive:** delete or archive any new bulk uploads
- **Gmail:** set up a filter that auto-deletes mail with
  `larger:25M older_than:90d` (Settings → Filters → Create)

For ongoing Photos sync to omv, [`gphotos-sync`](https://github.com/gilesknap/gphotos-sync)
runs as a CronJob (similar pattern to `infrastructure/backup/cronjob-*.yaml`).
Not in scope here — add as an R-row if you want it.

## See also

- `docs/google-drive-cleanup.md` — broader Drive/Gmail/Photos cleanup runbook
- Memory `project_pi_disk_layout` — why sdb1 is the right target
- CLAUDE.md "omv-main Storage Layout" — full sdb1 + sda1 breakdown
- [Google Takeout](https://takeout.google.com)
- [Google One Storage Manager](https://one.google.com/storage/management)
