# AWS WAF — cloudless.gr

A CLOUDFRONT-scoped WebACL fronts the cloudless.gr distribution. Both rules
run in **COUNT mode** today — they inspect every request and emit CloudWatch
metrics + sampled requests, but do not block. Promotion to BLOCK is a manual
follow-up after a few days of monitoring so we can see false-positive rates
before they hit real users.

## Layout

| Field | Value |
|---|---|
| WebACL name | `cloudless-waf` |
| Scope | `CLOUDFRONT` (us-east-1 control plane, global edge) |
| ARN | `arn:aws:wafv2:us-east-1:278585680617:global/webacl/cloudless-waf/d212efa8-0389-4daf-b97b-0ecd2df73939` |
| Default action | `Allow` |
| Attached to | CloudFront distribution `ELGQBR8109MTM` (`d3k7muo3c6lw6s.cloudfront.net`, i.e. cloudless.gr) |
| Created | 2026-06-20 via `aws wafv2 create-web-acl` |

## Rules

| Priority | Name | Type | Action | Purpose |
|---:|---|---|---|---|
| 10 | `AWS-CommonRuleSet` | AWS-managed (`AWSManagedRulesCommonRuleSet`) | **Count** (overridden) | OWASP Top-10 baseline: SQLi, XSS, LFI, RFI, Log4Shell, request smuggling, oversize body/URL/headers, etc. |
| 20 | `RateLimit-2000-per-5min` | Rate-based, key=IP | **Count** | One IP doing > 2 000 requests in any rolling 5-minute window. |

CloudWatch metric namespace `AWS/WAFV2`, metric names
`cloudless-waf-CommonRuleSet` and `cloudless-waf-RateLimit`. Sampled
requests are visible in the WAF console.

## Promotion to BLOCK (the operator action)

After a few days of monitoring:

```bash
# 1. Inspect the sampled requests in the WAF console to see what's
#    being matched. Anything obviously legitimate that's matching means
#    that managed-rule sub-rule needs an exclusion (not a flip to BLOCK).
# 2. Flip CommonRuleSet override from Count → None (so its sub-rule
#    actions apply, which is mostly Block).
aws wafv2 update-web-acl \
  --scope CLOUDFRONT --region us-east-1 \
  --name cloudless-waf \
  --id d212efa8-0389-4daf-b97b-0ecd2df73939 \
  --lock-token <fresh-token-from-list-web-acls> \
  --default-action Allow={} \
  --visibility-config 'SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName=cloudless-waf' \
  --rules file://docs/waf-rules-block.json
```

A `docs/waf-rules-block.json` template can be created off the live spec
via `aws wafv2 get-web-acl ... > docs/waf-rules-current.json` then a
sed of `"Count": {}` → `"None": {}` on the CommonRuleSet override and
`"Action": { "Count": {} }` → `"Action": { "Block": {} }` on the
rate-based rule. Always keep one rule in COUNT during the flip so you
can compare counts before/after.

## Cost

| Item | Monthly |
|---|---|
| 1 WebACL | $5.00 |
| 1 AWS-managed rule group | $1.00 |
| 1 rate-based rule | $1.00 |
| Request inspection | $0.60 / 1 M |
| Sampled-request storage | free (3 hrs sliding window) |

Estimated total at current traffic: ~$7.50/mo. This is a **security
investment**, not a cost cut — it adds spend to the bill from
`docs/aws-cost-reduction.md`. Reversible by detaching from the
CloudFront distribution (`WebACLId = ""`) and `delete-web-acl`.

## Reversal

```bash
# Detach from CloudFront
aws cloudfront get-distribution-config --id ELGQBR8109MTM > /tmp/cf.json
# zero out WebACLId, save as /tmp/cf-new.json
aws cloudfront update-distribution --id ELGQBR8109MTM \
  --if-match <ETag-from-cf.json> \
  --distribution-config file:///tmp/cf-new.json

# Delete WebACL (must be detached first)
aws wafv2 delete-web-acl \
  --scope CLOUDFRONT --region us-east-1 \
  --name cloudless-waf \
  --id d212efa8-0389-4daf-b97b-0ecd2df73939 \
  --lock-token <token>
```

## Why not the portfolio distribution

The second CloudFront distribution (`E134SCTR0QGQKJ`,
`d1947b4i8egesz.cloudfront.net`) serves `baltzakisthemis.com` (a static
portfolio site). It has no Lambda origin, no API surface, and no
attack surface worth WAF spend. Leave it un-WAFed.
