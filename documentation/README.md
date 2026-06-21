# documentation/

Top-level operator-facing documentation. Mirrors selected high-value pages
from `docs/` so they're discoverable from the repo root without having to
hunt through the full `docs/` catalogue (75+ files as of 2026-06-21).

The canonical source for every page here is the matching file in `docs/`.
This folder exists for **discoverability**, not as a fork — if a page here
disagrees with the one in `docs/`, the `docs/` version wins. Updates land
in `docs/` first and are mirrored here.

## Contents

| File | Source | Topic |
| ---- | ------ | ----- |
| [`architecture-purchase-flow.md`](./architecture-purchase-flow.md) | `docs/architecture-purchase-flow.md` | How the 8 self-hosted apps connect end-to-end when a customer buys a service or store item, and how the operator gets notified. Includes a live sequence diagram (mermaid) + a static system-map diagram. |

## See also

- **Full docs catalogue:** `docs/` — 75+ markdown files covering deploy,
  security, integrations, runbooks, audits.
- **Operator skills:** `skills/` — 25 SKILL.md files (the canonical
  "first stop" per memory `feedback_use_in_repo_skills`).
- **Project memory:** `CLAUDE.md` (root) — long-lived project memory +
  pending-setup table.
- **Per-stack runbooks:** `infrastructure/*/README.md` — espocrm, postiz,
  smtp, ses-to-espocrm, n8n workflows, grafana dashboards, pi-alert-api,
  esp32-watchdog.

## Viewing the mermaid diagrams

The `.md` files use [Mermaid](https://mermaid.js.org/) for diagrams.
They render natively in:

- VS Code (with the built-in markdown preview)
- GitHub (renders mermaid blocks inline)
- Any modern markdown viewer with Mermaid support

Inside AppFlowy (which doesn't render mermaid yet) the diagrams appear as
code blocks. The same content is mirrored to AppFlowy via
`scripts/appflowy-upload-md.mjs` per memory `reference_appflowy_upload_script`.
