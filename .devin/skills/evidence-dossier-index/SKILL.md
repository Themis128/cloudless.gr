---
name: evidence-dossier-index
description: Build a court-ready video-evidence index (PDF + Markdown) for a local case dossier folder — scans *.mp4 clips, embeds contact-strip thumbnails, SHA-256 hashes, durations, and full paths. Use for "video index pdf", "links of the videos", dossier packaging, or evidence index for police/prosecutor handover.
---

# evidence-dossier-index

Generates `VIDEO-INDEX.pdf` (+ `VIDEO-INDEX.md`) inside a case dossier folder.
Pairs each video clip with its contact-strip image, hashes it, and lays it
out for printing or screen review.

## Tool

`scripts/build_video_index.py` — stdlib + `reportlab` (ffprobe optional for
durations).

```bash
python scripts/build_video_index.py <case_dir> [--out VIDEO-INDEX.pdf]
                                    [--title "..."] [--per-page 4]
```

- `<case_dir>` — dossier folder, e.g.
  `C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence`
- Auto-detects clips recursively (`.mp4/.mov/.mkv/.avi`), pairs
  `<clip>_strip.jpg|png` as thumbnail, SHA-256 (first 16 hex), size, mtime.
- Writes `VIDEO-INDEX.pdf` and `VIDEO-INDEX.md` into the case dir.
- `--per-page` controls clips per PDF page (default 4; lower if strips are tall).

## mpaltzakis-house-2026-11 dossier

Local folder: `C:\Users\tbaltzakis\Documents\mpaltzakis-correspondence\`

- `video-20261109-dlink/`, `video-20261110-dlink/`,
  `video-20261109-incident-1610-1700/` — camera clips with `_strip.jpg` sheets
- `audio-evidence/` — WAVs + whisper transcripts
- `frames-20261109-dlink/`, `nc220-snapshots-20261109/` — stills
- `DOSSIER-mpaltzakis-house-2026-11-docs.zip` — docs bundle (emails/report)
- `pdf-link-paths.txt` — flat list of clip paths used when embedding links
  into the report PDF
- `EGKLISI-mpaltzakis-house-2026-11.pdf` — operative police report
- `POLICE-CONTACTS.md` — ΑΤ Κορωπίου + Εισαγγελία Πρωτοδικών Αθηνών contacts

Server-side pipeline (ingest/analyze/transcribe/manifest/dossier stages,
SHA-256 manifest, DMR analysis, Telegram alerts): see `evidence-pipeline`
skill — `github-omv:~/evidence/mpaltzakis-house-2026-11/`.

## Notes

- Clips are referenced by path, not embedded — keep the video dirs next to
  the PDF when handing to police/prosecutor.
- If ffprobe is absent, duration shows `-`; install or ignore.
- For full SHA-256 (64 hex) verification use the pipeline `manifest.txt`
  on github-omv — this index truncates to 16 hex for readability.

## Linked full-catalog index (added 2026-11-11)

`scripts/video_index_publish.py` — rebuilds `VIDEO_INDEX.pdf` as a COMPLETE
clickable catalog: pulls every mp4 under omv `video-src/` (ffprobe duration,
size, fresh SHA-256-16), generates `VIDEO-INDEX.html` with R2 links per clip,
then runs publish-doc.py (which now also R2-syncs). Verifies PDF annot count
== inventory count.

- Scheduled task `EvidenceVideoIndexDaily` runs it 05:45 daily (after the
  04:30 omv backup) — keeps the index fresh as the pipeline adds clips.
- Manual: `python video_index_publish.py [--case CASE] [--no-upload]`
- R2 link base is baked in; evidence.cloudless.gr remains the failover host.
