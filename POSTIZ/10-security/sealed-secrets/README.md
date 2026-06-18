# Sealed Secrets workflow

## Why
Without this, secret YAMLs can't go into git, so ArgoCD can't fully reconcile the stack — you always have to apply secrets manually before sync. Sealed Secrets fixes that:

```
plain Secret  --(kubeseal)-->  SealedSecret CR  --(commit, ArgoCD syncs)-->  controller unseals  -->  Secret
                                  ↑ safe in git                                  ↑ in-cluster only
```

The controller holds a private key; only it can decrypt. The public key (used by `kubeseal`) is fetched from the controller automatically.

## One-time setup

1. Install the controller (handled by `install-security.sh`).
2. Install the `kubeseal` CLI on your machine — `brew install kubeseal` or download from [releases](https://github.com/bitnami-labs/sealed-secrets/releases).
3. **Back up the controller's master key** — if the cluster dies and you reinstall, the new controller's key won't decrypt your old SealedSecrets.
   ```bash
   kubectl -n kube-system get secret \
     -l sealedsecrets.bitnami.com/sealed-secrets-key \
     -o yaml > sealed-secrets-master-key.yaml
   ```
   Store `sealed-secrets-master-key.yaml` in 1Password / Bitwarden / Vault. Never commit it.

## Sealing workflow

After you fill any secret file (e.g. `02-cnpg/postiz-db-secret.yaml`):

```bash
./10-security/sealed-secrets/seal-all-secrets.sh
git add **/*.sealed.yaml
git commit -m "rotate db password"
git push
# ArgoCD syncs; the controller unseals; in-cluster Secret is updated within ~1 min.
```

## Update existing manifests to point at sealed files

For each layer that previously expected a plain Secret to be pre-applied, change:
- `apps/postiz-pg-cluster.yaml` (ArgoCD app) — drop the "secrets must pre-exist" comment, include `*.sealed.yaml`.
- Same for `postiz-minio-tenant`, `postiz-automation`, `postiz-backups`, `cert-manager`.

After sealing, you can flip auto-sync back on for those apps without manual intervention.

## What about the Postiz Helm `secrets:` block?

`05-postiz/secrets-overrides.yaml` is a Helm values file, not a K8s Secret — `kubeseal` doesn't handle it. Two options:
1. **`sops` + `helm-secrets`** — encrypt the YAML with age/PGP, decrypt at chart-render time. ArgoCD has [a plugin](https://github.com/argoproj/argo-cd/blob/master/docs/operator-manual/config-management-plugins.md) for this.
2. **Split into a plain Secret** — change `05-postiz/values.yaml` to use `extraEnvFrom` against a Secret you seal here.

Option 1 is more idiomatic but adds a dependency; option 2 is simpler. We currently document option 2 in the main README and leave option 1 as a follow-up.
