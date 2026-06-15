---
name: postiz-apply
description: |
  Ship Postiz-touching work from a Cowork session into the WSL canonical
  clone, then commit / push / PR / squash-merge. Wraps cowork-bundle.sh
  with the Postiz path set baked in — chart, skills, admin routes,
  lib/postiz.ts, neutralised infra/postiz/. Use whenever the user has
  edited Postiz-related files in a Cowork session and asks to "ship",
  "commit", "PR", "merge", or "apply" the work.
---

# Postiz apply

The exact Cowork → WSL handoff for Postiz work. Built on top of
`skills/cowork-wsl-handoff/SKILL.md` and `scripts/cowork-bundle.sh`.

## When to invoke this skill

- The user just made Postiz-touching edits in a Cowork session
  (Helm chart, skills, `src/lib/postiz.ts`, `/admin/postiz` page, the
  `/api/admin/postiz/*` proxies) and asks to ship them.
- A Cowork session has uncommitted Postiz work and you're wrapping it up.

## Run it

```bash
SESSION_ID="$(echo "$HOSTNAME" | cut -d. -f1)"
OUTPUTS="/sessions/${SESSION_ID}/mnt/outputs"
NAME="postiz-helm-and-console"

cat > /tmp/postiz-pr-body.md <<'PRBODY'
## What

- **Helm chart** at `infrastructure/postiz/helm/postiz/` — replaces the
  broken upstream chart, mirrors the live raw manifest 1:1 (v2.11.2,
  NodePort 30500, Cloudflare tunnel routing).
- **Admin console** at `/[locale]/admin/postiz` with Compose / Schedule /
  Channels tabs + proxy routes under `/api/admin/postiz/*`.
- **Skills** `skills/postiz/` + `skills/postiz-doctor/` for repeatable
  ops and staged troubleshooting.

## Verification

- `helm lint` → 0 failures, info-only "icon is recommended".
- `helm template` → exactly 9 objects (3 PVCs + 3 Deployments + 3
  Services), matching the raw manifest byte-for-byte.
- `shellcheck install.sh uninstall.sh` → clean.

## Deferred

- MCP wrappers `mcp__cloudless-infra__postiz_*` — captured under
  "Future work" in `skills/postiz/SKILL.md`; existing `k3s_*` and
  `cluster_run_command` tools already cover the doctor playbook.
- Real deletion of `infra/postiz/` — files are neutralised but Cowork
  perms blocked unlink. Next branch cleanup pass.
PRBODY

scripts/cowork-bundle.sh \
  --name      "${NAME}" \
  --branch    "claude/${NAME}" \
  --title     "feat(postiz): proper Helm chart + admin console + ops skills" \
  --body-file /tmp/postiz-pr-body.md \
  --outputs   "${OUTPUTS}" \
  -- \
  infrastructure/postiz/helm/ \
  skills/postiz/ \
  skills/postiz-doctor/ \
  src/lib/postiz.ts \
  "src/app/[locale]/admin/postiz/page.tsx" \
  src/app/api/admin/postiz/integrations/ \
  src/app/api/admin/postiz/posts/ \
  src/app/api/admin/postiz/upload/ \
  src/app/api/admin/postiz/slot/ \
  infra/postiz/
```

Then surface both artefacts to the user:

```python
mcp__cowork__present_files([
    f"{OUTPUTS}/{NAME}.tar.gz",
    f"{OUTPUTS}/APPLY-{NAME}.md",
])
```

## Path set rationale

| Path | What it contains | Why ship it |
|---|---|---|
| `infrastructure/postiz/helm/` | Custom Helm chart | The replacement for the broken upstream chart |
| `skills/postiz/` | Ops runbook | New |
| `skills/postiz-doctor/` | Staged debug playbook | New |
| `src/lib/postiz.ts` | Extended with throwing variants | Powers the admin-console proxies |
| `src/app/[locale]/admin/postiz/page.tsx` | Tabbed admin UI | New |
| `src/app/api/admin/postiz/integrations/` | GET proxy | New |
| `src/app/api/admin/postiz/posts/` | GET/POST/DELETE proxies | New |
| `src/app/api/admin/postiz/upload/` | POST upload-from-url proxy | New |
| `src/app/api/admin/postiz/slot/` | GET find-slot proxy | New |
| `infra/postiz/` | Deprecated chart (neutralised) | Markers fail loudly if someone tries the old path |

**Explicitly NOT in the bundle:**

- `infrastructure/postiz/k8s/postiz.yaml` — the raw manifest. An earlier
  attempt to add a `SUPPLANTED` banner truncated it; restored from `HEAD`,
  unchanged. The chart's README cross-references it as the source of truth.
- `docs/POSTIZ.md` — already covers the app-side architecture; no diff in
  this work.
- Any non-Postiz files (`.github/workflows/*`, `CLAUDE.md`,
  `client-portals.ts`, etc.) — those are unrelated dirty edits in the
  Cowork tree.

## What lands on `main`

A single squash-merge commit with subject:

> feat(postiz): proper Helm chart + admin console + ops skills

…and the markdown body from `/tmp/postiz-pr-body.md`. The feature branch
is deleted on merge.

## After it lands

1. The Notion doc is **already updated** (2026-06-15 section appended to
   the "One-Stop-Shop Platform" page) — no follow-up needed.
2. To switch the live cluster from the raw manifest to the chart, run
   `infrastructure/postiz/helm/postiz/install.sh` on omv-main with
   `KUBECONFIG` set. It's idempotent — won't overwrite existing secrets.
3. The deprecated `infra/postiz/` directory still exists in-tree but is
   neutralised; queue a follow-up branch to actually `git rm` it.

## See also

- `skills/cowork-wsl-handoff/SKILL.md` — the generic skill this builds on.
- `skills/postiz/SKILL.md` — what to do once the chart is live.
- `skills/postiz-doctor/SKILL.md` — when things break.
