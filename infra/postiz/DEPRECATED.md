# DEPRECATED — moved

The Postiz Helm chart now lives at **`infrastructure/postiz/helm/postiz/`** to
sit next to the existing `infrastructure/postiz/k8s/postiz.yaml` manifest and
`cloudflare-tunnel.yaml` (the canonical Postiz infra location).

Files in **this** directory (`infra/postiz/`) were a first-pass that wrongly
modelled the upstream Postiz Helm chart — including a Temporal stack that the
omv-main Pi cluster intentionally skips by pinning Postiz to **v2.11.2** (the
last release before Temporal became mandatory). They should not be applied.

Use:

```bash
helm upgrade --install postiz infrastructure/postiz/helm/postiz \
  -n postiz \
  -f infrastructure/postiz/helm/postiz/values-prod.yaml
```

Delete this whole `infra/postiz/` directory on the next branch cleanup pass.
