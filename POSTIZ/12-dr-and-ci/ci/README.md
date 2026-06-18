# CI — GitHub Actions + pre-commit

The active workflow files live at the **repo root** (GitHub requires `.github/workflows/`). This folder documents them.

## Workflows

| File | Runs on | What it does |
|---|---|---|
| `.github/workflows/lint.yml` | every PR + push to main | `yamllint`, `shellcheck` on all `*.sh`, `detect-secrets` to block accidental key commits |
| `.github/workflows/validate.yml` | every PR + push to main | `kubeconform` validates every YAML against k8s API + CRDs (CNPG, MinIO Tenant, cert-manager, Prometheus operator) |
| `.github/workflows/helm-render.yml` | when values files change | `helm template` each chart + re-validate the rendered YAML with kubeconform — catches chart upgrades that rename our values keys |

## pre-commit

`.pre-commit-config.yaml` (repo root) runs the same checks locally on every `git commit`. Setup:

```bash
pip install pre-commit
pre-commit install
# Optional: run against the whole repo right now
pre-commit run --all-files
```

`kubeconform` is invoked from `pre-commit` if you have it on `PATH`; install with:

```bash
# macOS
brew install kubeconform
# Linux
curl -fsSL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
sudo mv kubeconform /usr/local/bin/
```

## Why these specific tools

- **kubeconform > kubeval**: faster, supports custom schema locations (needed for CNPG/MinIO/ArgoCD CRDs), maintained.
- **detect-secrets > truffleHog**: lower false-positive rate, easy to tune via `.secrets.baseline`.
- **yamllint relaxed**: strict mode rejects valid Helm template syntax and overly long lines that exist in real-world generated manifests.

## What CI does NOT catch (and shouldn't)

- **Live ArgoCD diff** — would require GitHub Actions to reach `argocd.cloudless.gr`, which means either exposing it or a self-hosted runner inside your cluster. Add later if you want PR comments showing the cluster delta; for now, ArgoCD's web UI is the source of truth.
- **End-to-end smoke tests** — too slow + brittle for PR checks. The DR drill (see `../dr-drill/`) is the better signal.
- **Image vulnerability scans** — out of scope here; bolt on Trivy or Grype as a separate workflow if you start pinning images.

## Extending

Common next additions:

```yaml
# .github/workflows/security-scan.yml — Trivy on all images referenced in YAML
- uses: aquasecurity/trivy-action@master
  with: { scan-type: 'config', scan-ref: '.' }

# .github/workflows/conftest.yml — OPA/Rego policies (e.g. no :latest tags)
- uses: instrumenta/conftest-action@master
  with: { files: ., policy: ./policies }
```
