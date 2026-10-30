# cwv-triage — decode core-web-vitals-audit failures in one shot

When `core-web-vitals-audit.yml` fails, this replaces 15 minutes of
artifact archaeology: downloads the run's `lhr-*.json`, prints per-route
category medians vs gates (perf 0.55 · a11y/bp/seo 0.90) and the exact
failing audits — including the per-line messages for robots-txt,
tap-targets, image-alt.

## Usage

    python3 .devin/skills/cwv-triage/scripts/cwv_triage.py          # latest failed run
    python3 cwv_triage.py 40961972128                               # specific run
    python3 cwv_triage.py --local /tmp/cwvrep                       # offline

## Output contract

    FAIL /en/services  performance=0.8 seo=0.82 a11y=1.0 ...
          failing: seo=0.82(gate 0.9)
       - meta-description: Document does not have a meta description
       - robots-txt: robots.txt is not valid
          line 8: Content-Signal: ... — Unknown directive

## Gotchas learned (2026-10-29)

- **Non-standard robots.txt directives fail the audit** — draft
  Content-Signal and ARD Agentmap both score 0 ("Unknown directive").
  Keep robots.txt to standard Allow/Disallow/User-agent/Host/Sitemap.
- The audit targets the Pi NodePort (127.0.0.1:30300) — pages can be
  stale vs production; check prod HTML before assuming a code bug.
- Perf on the ARM self-hosted runner is noisy ±0.2 — a route needs
  repeated sub-threshold medians before it's a real regression.
- `finalDisplayedUrl` stays on the NodePort even when the pod 308s to
  cloudless.gr — treat reported URLs as origin URLs.
