#!/usr/bin/env bash
#
# setup-cloudflare-lb.sh — provision / reconcile the cloudless.gr HA failover
# at the layer that actually owns the domain's DNS: Cloudflare.
#
# WHY: cloudless.gr is delegated to Cloudflare (ns fay/jihoon.ns.cloudflare.com),
# NOT Route 53. The old Route 53 PRIMARY/SECONDARY records never served real
# traffic and their hosted zone was deleted on 2026-06-02. This script builds a
# Cloudflare Load Balancer that health-checks /api/health and steers each
# hostname AWS(primary) -> Pi(secondary) automatically.
#
# Topology built (per hostname: cloudless.gr, www.cloudless.gr):
#   monitor  cloudless-health-<host>   GET https://.../api/health, expect 200
#   pool     cl-aws-<host>             origin = CloudFront distro  (Host: <host>)
#   pool     cl-pi-<host>              origin = github-omv.tail4ecae1.ts.net (Host: <host>)
#   lb       <host>                    default_pools [aws, pi], fallback pi
#
#   steering_policy "off" => Cloudflare serves the first HEALTHY pool in
#   default_pools (aws), and flips to pi the moment the aws monitor goes
#   unhealthy. Steady state is identical to today (all traffic -> AWS).
#
# SAFE BY DEFAULT: MODE=report (the default) writes NOTHING — it validates the
# token + LB entitlement, prints the live account/zone/DNS/LB state and the
# exact plan. MODE=apply (CONFIRM=1) creates/updates the resources and performs
# the apex/www DNS cutover (replacing the existing proxied record with the LB).
#
# Auth: CLOUDFLARE_API_TOKEN env, else SSM /cloudless/production/CLOUDFLARE_API_TOKEN.
#   Token scopes required: Zone:Read, Load Balancing\Monitors and Pools\Edit,
#   Load Balancing\Load Balancers\Edit, DNS\Edit (for the cutover).
#
set -uo pipefail

DOMAIN="${DOMAIN:-cloudless.gr}"
MODE="${MODE:-report}"                 # report | apply
CONFIRM="${CONFIRM:-0}"                 # apply requires CONFIRM=1
HOSTS=("cloudless.gr" "www.cloudless.gr")

# Origins for Cloudflare-only deployment (no CloudFront)
# Worker endpoints - the Worker itself handles all routing
WORKER_ORIGIN="cloudless-gr.baltzakis-themis.workers.dev"  # Cloudflare Worker endpoint
PI_ORIGIN="github-omv.tail4ecae1.ts.net"   # Pi/k3s via Tailscale Funnel (443)
# For pure Cloudflare mode, we use the Worker directly (no AWS CloudFront)
# The LB will have: AWS primary -> Pi standby (both served by Worker/Pi respectively)
HEALTH_PATH="/api/health"

log() { printf '%s\n' "$*"; }
die() { log "ERROR: $*"; exit 1; }
# A precondition that's waiting on a human (no token / no LB add-on). In report
# mode this is informational and exits GREEN; in apply mode it's fatal.
block() {
  log "BLOCKED: $*"
  if [ "${APPLY:-0}" = "1" ]; then exit 1; fi
  log "(report mode — exiting 0; resolve the above, then re-run / dispatch apply)"
  exit 0
}

command -v jq   >/dev/null 2>&1 || die "jq required"
command -v curl >/dev/null 2>&1 || die "curl required"

APPLY=0
if [ "$MODE" = "apply" ]; then
  [ "$CONFIRM" = "1" ] || die "MODE=apply requires CONFIRM=1 (refusing to mutate without explicit confirm)"
  APPLY=1
fi
log "== Cloudflare LB setup for ${DOMAIN} — mode=${MODE} =="

# ---- token -----------------------------------------------------------------
CF_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
if [ -z "$CF_TOKEN" ] && command -v aws >/dev/null 2>&1; then
  CF_TOKEN="$(aws ssm get-parameter --name /cloudless/production/CLOUDFLARE_API_TOKEN \
              --with-decryption --query Parameter.Value --output text 2>/dev/null || true)"
fi
[ -n "$CF_TOKEN" ] || block "no CLOUDFLARE_API_TOKEN — add a repo secret (or SSM /cloudless/production/CLOUDFLARE_API_TOKEN) with scopes: Zone:Read, Load Balancing Monitors/Pools:Edit, Load Balancing Load Balancers:Edit, DNS:Edit (zone cloudless.gr)."

API="https://api.cloudflare.com/client/v4"
# cf METHOD URL [json-body] -> prints raw response; sets CF_OK / CF_ERR
cf() {
  local method="$1" url="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" -H "Authorization: Bearer $CF_TOKEN" \
         -H "Content-Type: application/json" --data "$body" "$url"
  else
    curl -sS -X "$method" -H "Authorization: Bearer $CF_TOKEN" \
         -H "Content-Type: application/json" "$url"
  fi
}
ok() { printf '%s' "$1" | jq -e '.success == true' >/dev/null 2>&1; }
errs() { printf '%s' "$1" | jq -r '.errors[]? | "  [\(.code)] \(.message)"' 2>/dev/null; }

# ---- zone + account --------------------------------------------------------
ZRESP="$(cf GET "${API}/zones?name=${DOMAIN}")"
ok "$ZRESP" || { errs "$ZRESP"; die "zone lookup failed (token missing Zone:Read?)"; }
ZONE_ID="$(printf '%s' "$ZRESP" | jq -r '.result[0].id // empty')"
ACCT_ID="$(printf '%s' "$ZRESP" | jq -r '.result[0].account.id // empty')"
[ -n "$ZONE_ID" ] && [ -n "$ACCT_ID" ] || die "could not resolve zone/account for ${DOMAIN}"
log "zone:    ${ZONE_ID}"
log "account: ${ACCT_ID}"

# ---- entitlement check -----------------------------------------------------
PRESP="$(cf GET "${API}/accounts/${ACCT_ID}/load_balancers/pools")"
if ! ok "$PRESP"; then
  log "Load Balancing API not available:"
  errs "$PRESP"
  block "the account likely lacks the Load Balancing add-on, or the token lacks LB scope. Enable LB in the Cloudflare dashboard (Traffic -> Load Balancing) and grant the token 'Load Balancing: Monitors and Pools: Edit' + 'Load Balancing: Load Balancers: Edit'."
fi
log "Load Balancing entitlement: OK"

# upsert_by: list-url  name-jq-filter  name-value  create-url  body  [id-for-put-suffix]
# Generic helper: find existing resource id by a jq match, then POST (create) or
# PUT (update). Echoes the resource id. Honours APPLY (report => no write).
find_id() { # list-json  jq-match
  printf '%s' "$1" | jq -r "$2 // empty" | head -n1
}

MON_IDS=(); POOL_AWS=(); POOL_PI=()

# ===================== MONITORS + POOLS (account scope) =====================
i=0
for host in "${HOSTS[@]}"; do
  aws_origin="$WORKER_ORIGIN"
  pi_origin="$PI_ORIGIN"
  mon_desc="cloudless-health-${host}"
  pool_aws_name="cl-worker-${host//./-}"
  pool_pi_name="cl-pi-${host//./-}"

  log ""
  log "--- ${host} ---"
  log "  primary origin (Worker): ${aws_origin}  (Host: ${host}${HEALTH_PATH})"
  log "  standby origin (Pi):      ${pi_origin}   (Host: ${host}${HEALTH_PATH})"

  # ---- monitor ----
  MLIST="$(cf GET "${API}/accounts/${ACCT_ID}/load_balancers/monitors")"
  mon_id="$(find_id "$MLIST" ".result[] | select(.description==\"${mon_desc}\") | .id")"
  mon_body="$(jq -n --arg desc "$mon_desc" --arg path "$HEALTH_PATH" --arg host "$host" '{
    type:"https", method:"GET", path:$path, description:$desc,
    expected_codes:"200", interval:60, retries:2, timeout:5,
    follow_redirects:false, allow_insecure:false,
    header:[{ "Name":"Host", "Value":$host }]
  }')"
  if [ "$APPLY" = "1" ]; then
    if [ -n "$mon_id" ]; then
      R="$(cf PUT "${API}/accounts/${ACCT_ID}/load_balancers/monitors/${mon_id}" "$mon_body")"
    else
      R="$(cf POST "${API}/accounts/${ACCT_ID}/load_balancers/monitors" "$mon_body")"
      mon_id="$(find_id "$R" '.result.id')"
    fi
    ok "$R" || { errs "$R"; die "monitor upsert failed for ${host}"; }
    log "  monitor:   ${mon_id} (upserted)"
  else
    log "  monitor:   $( [ -n "$mon_id" ] && echo "exists ${mon_id} (would update)" || echo "MISSING (would create '${mon_desc}')" )"
  fi
  MON_IDS+=("$mon_id")

  # ---- pools ----
  PLIST="$(cf GET "${API}/accounts/${ACCT_ID}/load_balancers/pools")"
  for kind in aws pi; do
    if [ "$kind" = aws ]; then pname="$pool_aws_name"; porigin="$aws_origin"; oname="cf-worker"; else pname="$pool_pi_name"; porigin="$pi_origin"; oname="pi-k3s-funnel"; fi
    pool_id="$(find_id "$PLIST" ".result[] | select(.name==\"${pname}\") | .id")"
    pool_body="$(jq -n --arg name "$pname" --arg oname "$oname" --arg addr "$porigin" \
                       --arg host "$host" --arg mon "$mon_id" '{
      name:$name, enabled:true, minimum_origins:1,
      monitor: ($mon | select(length>0)),
      origins:[ { name:$oname, address:$addr, enabled:true, weight:1,
                  header:[{ "Name":"Host", "Value":$host }] } ]
    } | with_entries(select(.value!=null and .value!=""))')"
    if [ "$APPLY" = "1" ]; then
      [ -n "$mon_id" ] || die "no monitor id for ${host}; cannot create pool ${pname}"
      if [ -n "$pool_id" ]; then
        R="$(cf PUT "${API}/accounts/${ACCT_ID}/load_balancers/pools/${pool_id}" "$pool_body")"
      else
        R="$(cf POST "${API}/accounts/${ACCT_ID}/load_balancers/pools" "$pool_body")"
        pool_id="$(find_id "$R" '.result.id')"
      fi
      ok "$R" || { errs "$R"; die "pool upsert failed: ${pname}"; }
      log "  pool ${kind}:  ${pool_id}  (${pname} -> ${porigin})"
    else
      log "  pool ${kind}:  $( [ -n "$pool_id" ] && echo "exists ${pool_id}" || echo "MISSING (would create '${pname}' -> ${porigin})" )"
    fi
    if [ "$kind" = aws ]; then POOL_AWS+=("$pool_id"); else POOL_PI+=("$pool_id"); fi
  done
  i=$((i+1))
done

# ===================== LOAD BALANCERS (zone scope) =========================
i=0
for host in "${HOSTS[@]}"; do
  aws_pool="${POOL_AWS[$i]}"; pi_pool="${POOL_PI[$i]}"
  LLIST="$(cf GET "${API}/zones/${ZONE_ID}/load_balancers")"
  lb_id="$(find_id "$LLIST" ".result[] | select(.name==\"${host}\") | .id")"

  log ""
  log "--- LB ${host} ---"
  if [ "$APPLY" != "1" ]; then
    # show what proxied DNS record currently sits at this name (will be replaced)
    DREC="$(cf GET "${API}/zones/${ZONE_ID}/dns_records?name=${host}")"
    printf '%s' "$DREC" | jq -r '.result[]? | "  current DNS: \(.type) \(.name) -> \(.content) (proxied=\(.proxied))"'
    if [ -n "$lb_id" ]; then
      log "  LB: exists ${lb_id} (would update default_pools=[aws,pi], fallback=pi)"
    else
      log "  LB: MISSING (would create; replaces the proxied DNS record above)"
    fi
    i=$((i+1)); continue
  fi

  [ -n "$aws_pool" ] && [ -n "$pi_pool" ] || die "missing pool ids for ${host}"
  lb_body="$(jq -n --arg name "$host" --arg aws "$aws_pool" --arg pi "$pi_pool" '{
    name:$name, proxied:true, enabled:true, steering_policy:"off",
    default_pools:[$aws,$pi], fallback_pool:$pi,
    description:"cloudless HA: AWS primary -> Pi standby (auto-failover on /api/health)"
  }')"

  if [ -n "$lb_id" ]; then
    R="$(cf PUT "${API}/zones/${ZONE_ID}/load_balancers/${lb_id}" "$lb_body")"
    ok "$R" || { errs "$R"; die "LB update failed: ${host}"; }
    log "  LB: ${lb_id} (updated)"
  else
    # apex/www cutover: an LB cannot coexist with a plain proxied record of the
    # same name. Capture + delete the conflicting record, then create the LB.
    DREC="$(cf GET "${API}/zones/${ZONE_ID}/dns_records?name=${host}")"
    printf '%s' "$DREC" | jq -r '.result[]? | "  replacing DNS: \(.type) \(.name) -> \(.content) (proxied=\(.proxied))"'
    for rid in $(printf '%s' "$DREC" | jq -r '.result[]? | select(.type=="A" or .type=="AAAA" or .type=="CNAME") | .id'); do
      RD="$(cf DELETE "${API}/zones/${ZONE_ID}/dns_records/${rid}")"
      ok "$RD" || { errs "$RD"; die "could not delete DNS record ${rid} before LB cutover (${host})"; }
    done
    R="$(cf POST "${API}/zones/${ZONE_ID}/load_balancers" "$lb_body")"
    ok "$R" || { errs "$R"; die "LB create failed: ${host}"; }
    lb_id="$(find_id "$R" '.result.id')"
    log "  LB: ${lb_id} (created — ${host} now served by the load balancer)"
  fi
  i=$((i+1))
done

log ""
if [ "$APPLY" = "1" ]; then
  log "== DONE — Cloudflare LB failover is live. Steady state: AWS primary."
  log "   Verify: curl -sI https://${DOMAIN}/api/health  (200), then watch a"
  log "   forced-AWS-5xx flip to the Pi standby in the LB Analytics tab."
else
  log "== REPORT ONLY — nothing changed."
  log "   To apply the plan above (creates the LB + cuts apex/www DNS over):"
  log "   GitHub -> Actions -> 'Cloudflare HA load balancer' -> Run workflow"
  log "   -> set apply = true. Result + verification are posted back to #382."
fi