#!/usr/bin/env bash
#
# domain-decommission.sh — safely retire a domain's AWS Route 53 health checks
# and Cloudflare DNS records, scoped strictly to that domain.
#
# Built to retire cloudless.online (migrated to cloudless.gr) without the recurring
# DNS-monitor alerts, but generalised: pass DOMAIN=<zone> for any domain.
#
# SAFETY (read this before changing anything):
#   - DISCOVERY-FIRST. Default MODE=report only lists what *would* be removed;
#     nothing is deleted unless MODE=apply AND CONFIRM=1.
#   - SCOPED BY NAME. Route 53 health checks are matched by their
#     FullyQualifiedDomainName ending in the target DOMAIN; Cloudflare records are
#     matched by the DOMAIN's own zone. We never delete by a hardcoded id.
#   - PROTECTED IDS. The cloudless.gr HA *secondary* health check
#     30a69f1c-8d48-49bd-9067-cabec979478b (SECONDARY=Pi/APIGW failover, see
#     sst.config.ts / docs/cluster-overload-runbook.md) is NEVER deletable here —
#     it belongs to the ACTIVE cloudless.gr failover, not cloudless.online.
#
# Credentials (supplied by domain-decommission.yml in CI):
#   - AWS: OIDC deploy role (route53:ListHealthChecks + DeleteHealthCheck for apply).
#   - Cloudflare: CLOUDFLARE_API_TOKEN, read from SSM /cloudless/production/* or env.
set -uo pipefail

DOMAIN="${DOMAIN:-cloudless.online}"
MODE="${MODE:-report}"           # report | apply
CONFIRM="${CONFIRM:-0}"          # apply requires CONFIRM=1
AWS_REGION="${AWS_REGION:-us-east-1}"

# Health-check ids that must never be deleted by this tool, with reason.
PROTECTED_HEALTH_CHECKS="30a69f1c-8d48-49bd-9067-cabec979478b"  # cloudless.gr HA secondary

is_apply() { [ "$MODE" = "apply" ] && [ "$CONFIRM" = "1" ]; }
log() { echo "[decommission:${DOMAIN}] $*"; }

log "mode=$MODE confirm=$CONFIRM (apply deletes only when MODE=apply + CONFIRM=1)"
command -v aws >/dev/null 2>&1 || { log "WARN: aws CLI not found — skipping Route 53"; }
command -v jq  >/dev/null 2>&1 || { log "ERROR: jq required"; exit 1; }

# ---------------------------------------------------------------------------
# 1) Route 53 health checks scoped to this domain
# ---------------------------------------------------------------------------
r53_deleted=0; r53_found=0
if command -v aws >/dev/null 2>&1; then
  HC_JSON="$(aws route53 list-health-checks --output json 2>/tmp/r53.err || true)"
  if [ -z "$HC_JSON" ]; then
    log "Route 53: list-health-checks returned nothing — $(tr '\n' ' ' </tmp/r53.err)"
  else
    # Match health checks whose FQDN is the domain or a subdomain of it.
    mapfile -t HCS < <(printf '%s' "$HC_JSON" | jq -r --arg d "$DOMAIN" '
      .HealthChecks[]
      | select((.HealthCheckConfig.FullyQualifiedDomainName // "")
               | ascii_downcase | (. == $d or endswith("." + $d)))
      | "\(.Id)\t\(.HealthCheckConfig.FullyQualifiedDomainName)\t\(.HealthCheckConfig.Type)"')
    for row in "${HCS[@]:-}"; do
      [ -z "$row" ] && continue
      id="${row%%	*}"; rest="${row#*	}"; fqdn="${rest%%	*}"
      r53_found=$((r53_found+1))
      if printf '%s' "$PROTECTED_HEALTH_CHECKS" | grep -qw "$id"; then
        log "Route 53: PROTECTED health check $id ($fqdn) — skipping (cloudless.gr failover)"
        continue
      fi
      if is_apply; then
        if aws route53 delete-health-check --health-check-id "$id" 2>/tmp/del.err; then
          log "Route 53: DELETED health check $id ($fqdn)"; r53_deleted=$((r53_deleted+1))
        else
          log "Route 53: delete $id FAILED — $(tr '\n' ' ' </tmp/del.err)"
        fi
      else
        log "Route 53: would delete health check $id ($fqdn) [report-only]"
      fi
    done
    [ "$r53_found" -eq 0 ] && log "Route 53: no health checks scoped to $DOMAIN"
  fi
fi

# ---------------------------------------------------------------------------
# 2) Cloudflare DNS records in this domain's zone
# ---------------------------------------------------------------------------
cf_deleted=0; cf_found=0
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ] && command -v aws >/dev/null 2>&1; then
  CF_TOKEN="$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN \
              --with-decryption --query 'Parameter.Value' --output text 2>/dev/null || true)"
fi
if [ -z "$CF_TOKEN" ]; then
  log "Cloudflare: no CLOUDFLARE_API_TOKEN (env or SSM) — skipping DNS-record cleanup."
  log "Cloudflare: set /cloudless/production/CLOUDFLARE_API_TOKEN (Zone:DNS:Edit, Zone:Read) to enable."
else
  cf() { curl -fsS -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" "$@"; }
  ZONE_ID="$(cf "https://api.cloudflare.com/client/v4/zones?name=${DOMAIN}" 2>/dev/null \
             | jq -r '.result[0].id // empty')"
  if [ -z "$ZONE_ID" ]; then
    log "Cloudflare: no zone found for $DOMAIN (already removed, or token lacks Zone:Read)."
  else
    log "Cloudflare: zone $DOMAIN = $ZONE_ID"
    mapfile -t RECS < <(cf "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?per_page=100" 2>/dev/null \
                        | jq -r '.result[] | "\(.id)\t\(.type)\t\(.name)"')
    for row in "${RECS[@]:-}"; do
      [ -z "$row" ] && continue
      rid="${row%%	*}"; rest="${row#*	}"; rtype="${rest%%	*}"; rname="${rest##*	}"
      cf_found=$((cf_found+1))
      if is_apply; then
        if cf -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${rid}" >/dev/null 2>&1; then
          log "Cloudflare: DELETED $rtype $rname ($rid)"; cf_deleted=$((cf_deleted+1))
        else
          log "Cloudflare: delete $rtype $rname FAILED"
        fi
      else
        log "Cloudflare: would delete $rtype $rname ($rid) [report-only]"
      fi
    done
    [ "$cf_found" -eq 0 ] && log "Cloudflare: zone $DOMAIN has no DNS records"
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "──────── summary for $DOMAIN ────────"
log "Route 53 health checks: found=$r53_found deleted=$r53_deleted"
log "Cloudflare DNS records: found=$cf_found deleted=$cf_deleted"
if ! is_apply; then
  log "REPORT-ONLY. Re-run with MODE=apply CONFIRM=1 (or the workflow's apply=true input) to delete."
fi
log "NOTE: in-cluster monitors that probe $DOMAIN (omv-ha k8s/health-monitor.yaml, OMV"
log "      uptime-kuma) live in other repos — clean them there; this tool only handles R53 + Cloudflare."
