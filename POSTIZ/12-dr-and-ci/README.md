# DR drills + CI

Two pieces that turn the stack from "well-built" into "actually verified":

| Piece | What it gives you | Where it lives |
|---|---|---|
| **DR drill** | Quarterly CronJob that **proves the R2 backups restore**. Spins up `postiz-pg-restore-test`, asserts row counts, tears down, alerts on failure. | `dr-drill/` |
| **CI** | GitHub Actions on every PR: `yamllint`, `kubeconform`, `helm template` + re-validate, secret scanner. Plus `pre-commit` for the same checks locally. | `ci/` + `.github/workflows/` |

## Why this matters

- **Backups you've never restored are not backups.** The `07-backups/verify-restore.md` doc described the drill; this layer automates it so you can't forget. If a Slack alert lands "DR drill failed", you find out **before** you actually need it.
- **Manifests that never get validated break in production.** A typo'd `metadata.name`, an unsupported API version, a Helm value renaming — CI catches all three before merge.

## Install

```bash
# 1. DR drill (one CronJob + scoped SA)
kubectl apply -f 12-dr-and-ci/dr-drill/rbac.yaml
kubectl apply -f 12-dr-and-ci/dr-drill/cronjob.yaml

# 2. CI — these files live at the repo root
ls .github/workflows/   # lint.yml, validate.yml, helm-render.yml
ls .pre-commit-config.yaml   # local pre-commit hooks

# Bonus: enable pre-commit locally
pip install pre-commit
pre-commit install
```

## Layout

```
12-dr-and-ci/
├── dr-drill/
│   ├── README.md
│   ├── rbac.yaml                       # scoped SA (CNPG Cluster + Job CRUD in postiz ns)
│   ├── cronjob.yaml                    # quarterly restore drill
│   └── restore-cluster-template.yaml   # the Cluster spec the script applies
└── ci/
    └── README.md                       # what each workflow does + how to extend

.github/workflows/                       # at repo root
├── lint.yml
├── validate.yml
└── helm-render.yml

.pre-commit-config.yaml                  # at repo root
```
