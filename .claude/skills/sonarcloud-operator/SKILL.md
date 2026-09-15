---
name: sonarcloud-operator
description: >
  Operate SonarQube Cloud for cloudless.gr — login/region, SONAR_TOKEN setup,
  main vs PR quality gates, Free-tier LOC caps, doctor script, and when to use
  sonarcloud-triage for code fixes. Use when Sonar shows “project does not
  exist”, main analysis cancelled/failed, Quality Gate failed on main/PR,
  Security Rating C, hotspots blocking the gate, or the agent needs authenticated
  Sonar API access.
---

# SonarQube Cloud Operator (cloudless.gr)

## Identity

| Field | Value |
|-------|--------|
| Region | **EU** → `https://sonarcloud.io` (US is `https://sonarqube.us` — wrong region = “project doesn't exist”) |
| Org | `Themis128` |
| Project key | `Themis128_cloudless.gr` |
| Analysis | Automatic Analysis (GitHub App) + `.sonarcloud.properties` |
| Free LOC | ~**50k ncloc** private; full `src/` ≈ 95k |

Unauthenticated / wrong-account / wrong-region UI and public API both look like
“Project doesn't exist”. That is **not** deletion.

## Setup once (human)

1. Open `https://sonarcloud.io` → region **EU** → **Log in with GitHub** as `Themis128`.
2. Confirm dashboard: `https://sonarcloud.io/dashboard?id=Themis128_cloudless.gr`
3. **My Account → Security → Generate Tokens** → name `cloudless-agent` → copy once.
4. Store as GitHub Actions secret **and** session secret (never commit, never `.env.local` via agent):

```bash
echo -n "$SONAR_TOKEN" | gh secret set SONAR_TOKEN --repo Themis128/cloudless.gr --body -
```

5. Local/agent: export `SONAR_TOKEN` for the doctor script only.

## Doctor script (agent tool)

```bash
SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --branch main --hotspots --ncloc
SONAR_TOKEN=... node scripts/sonarcloud-doctor.mjs --pr 1826 --hotspots
```

Prints Quality Gate conditions, new-code issues, and TO_REVIEW hotspots with keys.
Exit 2 if `SONAR_TOKEN` missing; exit 1 if project invisible.

## Main vs PR

| Signal | Meaning | Action |
|--------|---------|--------|
| PR Sonar **pass**, main **cancelled** / “last analysis has failed” | Often LOC OOM / Free cap / Automatic Analysis kill | Check `.sonarcloud.properties` `sonar.sources` under ~50k |
| Main QG fail: Security Rating **C** | Usually **S2245** `Math.random` in new/changed `src/` | Replace with `globalThis.crypto.getRandomValues` / `randomUUID` (see `sonarcloud-triage`) |
| Main QG fail: **Security Hotspots** | This project's gate **does** fail on open hotspots | Human marks Reviewed in UI, or remove/replace the pattern |
| Main QG fail: Duplication / Reliability | New-code metrics after scope change | Dedupe (e.g. shared cache hash), fix bugs listed by doctor |

After changing `sonar.sources`, the first successful main analysis may treat a large
surface as “new code” — expect a noisy gate until issues are cleared or the leak period ages.

## Scope policy (Free tier)

Current intent in `.sonarcloud.properties`:

```
sonar.sources=src/lib,src/app/api,src/context,src/proxy.ts
```

Keep admin UI / marketing pages out of analysis so Automatic Analysis can finish.
Do **not** expand to full `src/` without a paid LOC plan.

## Agent workflow

1. Read GH check summary (`gh api .../check-runs` Sonar output).
2. If token available → run `sonarcloud-doctor.mjs`.
3. Code fixes → follow `.claude/skills/sonarcloud-triage/SKILL.md` (S2245, S3699, S3776, S1192).
4. Hotspots → stop and ask operator to review in UI (or use doctor keys).
5. Never invent Sonar findings from an unauthenticated browser session.

## Related

- Triage (per-rule code fixes): `sonarcloud-triage`
- Properties: `.sonarcloud.properties`
- Script: `scripts/sonarcloud-doctor.mjs`
