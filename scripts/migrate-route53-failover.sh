#!/usr/bin/env bash
# migrate-route53-failover.sh
#
# One-shot, idempotent-ish migration: convert the simple alias records on
# cloudless.gr / www.cloudless.gr (apex+www, A+AAAA, currently managed by SST
# via sst.aws.dns()) into Route 53 failover records (PRIMARY=CloudFront,
# SECONDARY=Pi WAN). Performed as a SINGLE atomic
# `change-resource-record-sets` call so there is zero DNS gap.
#
# Run this ONCE, manually, BEFORE merging PR #90 + running `sst deploy`.
# After this script succeeds, SST's `aws.route53.Record` resources in
# sst.config.ts (with `import:` directives) will adopt the records on first
# deploy and reconcile them thereafter. No drift.
#
# Pi has no IPv6, so AAAA SECONDARY is intentionally omitted. While the
# primary is healthy, AAAA resolves normally; if the primary fails, IPv6
# clients get NXDOMAIN/SERVFAIL on AAAA but A still flips to the Pi v4 IP,
# and most dual-stack clients fall back to v4.
#
# Records before (4):
#   cloudless.gr        A    -> alias d3k7muo3c6lw6s.cloudfront.net (simple)
#   cloudless.gr        AAAA -> alias d3k7muo3c6lw6s.cloudfront.net (simple)
#   www.cloudless.gr    A    -> alias dgrxxatzrgxfi.cloudfront.net (simple)
#   www.cloudless.gr    AAAA -> alias dgrxxatzrgxfi.cloudfront.net (simple)
#
# Records after (6):
#   cloudless.gr        A    primary   alias d3k7muo3c6lw6s.cloudfront.net  + healthcheck
#   cloudless.gr        A    secondary 150.228.63.192 (TTL 60)
#   cloudless.gr        AAAA primary   alias d3k7muo3c6lw6s.cloudfront.net  + healthcheck
#   www.cloudless.gr    A    primary   alias dgrxxatzrgxfi.cloudfront.net   + healthcheck
#   www.cloudless.gr    A    secondary 150.228.63.192 (TTL 60)
#   www.cloudless.gr    AAAA primary   alias dgrxxatzrgxfi.cloudfront.net   + healthcheck
#
# Cost impact: $0 (Route 53 records are billed per query, not per record).

set -euo pipefail

ZONE_ID="Z079608614L53CC4EAZM3"
HEALTH_CHECK_ID="e239ad5c-dd17-40d7-8045-a153715168cf"
CF_ZONE_ID="Z2FDTNDATAQYW2"
APEX_CF="d3k7muo3c6lw6s.cloudfront.net"
WWW_CF="dgrxxatzrgxfi.cloudfront.net"
PI_WAN_IP="150.228.63.192"
PROFILE="${AWS_PROFILE:-cloudless}"

echo "==> Verifying current zone state on $ZONE_ID..."
aws --profile "$PROFILE" route53 list-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?(Name=='cloudless.gr.'||Name=='www.cloudless.gr.') && (Type=='A'||Type=='AAAA')]" \
  > /tmp/r53-pre-migration.json
echo "    Pre-migration state saved to /tmp/r53-pre-migration.json"
cat /tmp/r53-pre-migration.json

# Sanity-check: refuse to run if records are already failover-style
if grep -q '"SetIdentifier"' /tmp/r53-pre-migration.json; then
  echo "ERROR: At least one record already has a SetIdentifier (failover-style)."
  echo "       Migration appears to have been run already. Aborting to be safe."
  exit 1
fi

CHANGE_BATCH=$(cat <<JSON
{
  "Comment": "Migrate cloudless.gr apex+www A/AAAA from simple alias to failover (PRIMARY=CloudFront, SECONDARY=Pi). Atomic.",
  "Changes": [
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "cloudless.gr.",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$APEX_CF.",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "cloudless.gr.",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$APEX_CF.",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "www.cloudless.gr.",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$WWW_CF.",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "DELETE",
      "ResourceRecordSet": {
        "Name": "www.cloudless.gr.",
        "Type": "AAAA",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$WWW_CF.",
          "EvaluateTargetHealth": true
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cloudless.gr.",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "HealthCheckId": "$HEALTH_CHECK_ID",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$APEX_CF.",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cloudless.gr.",
        "Type": "A",
        "SetIdentifier": "secondary",
        "Failover": "SECONDARY",
        "TTL": 60,
        "ResourceRecords": [{"Value": "$PI_WAN_IP"}]
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "cloudless.gr.",
        "Type": "AAAA",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "HealthCheckId": "$HEALTH_CHECK_ID",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$APEX_CF.",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.cloudless.gr.",
        "Type": "A",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "HealthCheckId": "$HEALTH_CHECK_ID",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$WWW_CF.",
          "EvaluateTargetHealth": false
        }
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.cloudless.gr.",
        "Type": "A",
        "SetIdentifier": "secondary",
        "Failover": "SECONDARY",
        "TTL": 60,
        "ResourceRecords": [{"Value": "$PI_WAN_IP"}]
      }
    },
    {
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "www.cloudless.gr.",
        "Type": "AAAA",
        "SetIdentifier": "primary",
        "Failover": "PRIMARY",
        "HealthCheckId": "$HEALTH_CHECK_ID",
        "AliasTarget": {
          "HostedZoneId": "$CF_ZONE_ID",
          "DNSName": "$WWW_CF.",
          "EvaluateTargetHealth": false
        }
      }
    }
  ]
}
JSON
)

echo "$CHANGE_BATCH" > /tmp/r53-failover-change-batch.json
echo "==> Change batch written to /tmp/r53-failover-change-batch.json"

echo "==> Submitting atomic change..."
CHANGE_ID=$(aws --profile "$PROFILE" route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "file:///tmp/r53-failover-change-batch.json" \
  --query 'ChangeInfo.Id' --output text)
echo "    Change submitted: $CHANGE_ID"

echo "==> Waiting for INSYNC..."
aws --profile "$PROFILE" route53 wait resource-record-sets-changed --id "$CHANGE_ID"
echo "    INSYNC."

echo "==> Verifying post-migration state..."
aws --profile "$PROFILE" route53 list-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --query "ResourceRecordSets[?(Name=='cloudless.gr.'||Name=='www.cloudless.gr.') && (Type=='A'||Type=='AAAA')]" \
  --output json

echo
echo "==> Migration complete."
echo "    Next: merge PR #90, then run 'pnpm sst deploy --stage production'."
echo "    SST will adopt the records via the 'import:' directives in sst.config.ts."
