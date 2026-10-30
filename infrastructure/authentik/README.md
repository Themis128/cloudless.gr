# Authentik — self-hosted IdP (replaces CF Access for internal GUIs)

Deployed on omv k3s, namespace `authentik`. Admin portal: https://auth.cloudless.gr/if/admin/

## Architecture

```
browser → <host>.cloudless.gr → tunnel → authentik outpost → backend service
                                          (SSO gate: akadmin users + MFA)
```

- **Embedded outpost** (inside `authentik-server` pod, NodePort :30910) gates
  omv-side services: `omv`, `files`
- **Remote outpost** (`authentik-outpost` container on cu130, network
  `cu130-backend`) gates cu130 docker services: metabase, portainer, env,
  grafanadev, flower, jupyter, n8n-sandbox, prometheus, alertmanager,
  cadvisor, novnc, engage, comfy
- Tunnel ingress for gated hosts points at the outpost, never the service
- The outpost token lives in cu130 `.env` as `AUTHENTIK_OUTPOST_TOKEN`

## Deploy

`kubectl apply -f k3s-authentik.yaml` — creates ns, secret, postgres(4Gi PVC),
redis, server+worker, NodePort :30910. Rotate the secret values first.

## Adding a gated host

1. authentik admin → Applications → Providers → new Proxy provider
   (external_host = https://x.cloudless.gr, internal_host = http://target:port)
2. Create Application bound to it; assign provider to the right outpost
   (embedded = omv services, cu130 = docker services)
3. Tunnel: hostname → `http://192.168.1.128:30910` (omv) or
   `http://authentik-outpost:9000` (cu130)
4. DNS CNAME → the tunnel's cfargotunnel record

Bootstrap password lives in the `authentik-secret` k8s secret
(`bootstrap-password` key); ops API token identifier `ops-api`.
