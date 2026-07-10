# Cloudflare Access — R15: Admin tunnel hosts
#
# Protects self-hosted admin interfaces (grafana, kuma, appflowy, n8n) behind
# Cloudflare Access with Service Tokens for zero-trust authentication.
#
# Prerequisites:
#   - Cloudflare API token with Zone.Zone (read) + Account.Access: Apps (edit) scopes
#   - CLOUDFLARE_API_TOKEN in SSM
#
# Architecture:
#   Each admin app gets a dedicated Access Application with:
#   - Service Token authentication (for programmatic access from cloudless.gr)
#   - Allowed identity: tbaltzakis@cloudless.gr (the unified admin)
#   - Cookie session timeout: 1 hour (auto-refresh)
#
# DNS routing stays the same — Access policies are enforced at the tunnel level.
# See: infrastructure/cloudflare-tunnels/logs-cloudless-gr.yaml for existing tunnel pattern.

# Access Applications to create (via Terraform or Cloudflare API)
# Hostname → Service Token name

applications:
  - hostname: grafana.cloudless.gr
    service_token_name: cloudless-grafana-access
    session_duration: 1h
    auto_redirect: true
    app_domain: cloudless.gr
    policies:
      - name: "Admin access"
        decision: "allow"
        precedence: 1
        include:
          - email:
            - "tbaltzakis@cloudless.gr"

  - hostname: kuma.cloudless.gr
    service_token_name: cloudless-kuma-access
    session_duration: 1h
    auto_redirect: true
    app_domain: cloudless.gr
    policies:
      - name: "Admin access"
        decision: "allow"
        precedence: 1
        include:
          - email:
            - "tbaltzakis@cloudless.gr"

  - hostname: appflowy.cloudless.gr
    service_token_name: cloudless-appflowy-access
    session_duration: 1h
    auto_redirect: true
    app_domain: cloudless.gr
    policies:
      - name: "Admin access"
        decision: "allow"
        precedence: 1
        include:
          - email:
            - "tbaltzakis@cloudless.gr"

  - hostname: n8n.cloudless.gr
    service_token_name: cloudless-n8n-access
    session_duration: 1h
    auto_redirect: true
    app_domain: cloudless.gr
    policies:
      - name: "Admin access"
        decision: "allow"
        precedence: 1
        include:
          - email:
            - "tbaltzakis@cloudless.gr"

# Session duration: 1h means users stay logged in for 1 hour
# auto_redirect: true means unauthenticated requests are redirected to Access login
# Service tokens allow programmatic access without interactive login

# Secret storage (post-deployment)
# After creating Service Tokens via Cloudflare dashboard, store in SSM:
#   aws ssm put-parameter --name /cloudless/production/CLOUDFLARE_ACCESS_CLIENT_ID_<APP> --value <token_id>
#   aws ssm put-parameter --name /cloudless/production/CLOUDFLARE_ACCESS_CLIENT_SECRET_<APP> --value <token_secret>

# Tunnel configuration update
# The existing tunnel (ID: e977a490-58c5-4fdb-9155-86832e3e636a) already routes to these hosts.
# Access policies are enforced at the application level, not tunnel level.
# No changes needed to /etc/cloudflared/config.yml on omv nodes for Access.