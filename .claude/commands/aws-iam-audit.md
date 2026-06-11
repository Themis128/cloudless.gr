# /aws-iam-audit — Audit AWS IAM roles and ACM certificates for cloudless.gr

Reviews IAM roles, inline/managed policies, and ACM certificate status for the cloudless.gr infrastructure.

## Steps

1. **List IAM users** — call `mcp__cloudless-infra__aws_list_iam_users` to enumerate all IAM users. Flag any user that is not in the expected list:
   - `cloudless-ops` (CI/CD operations)
   - `pi-cloudless-app` (k3s runtime)

2. **Check IAM role permissions** — call `mcp__cloudless-infra__aws_check_iam_permissions` for the role `cloudless-ops-role`. Report:
   - Attached managed policies
   - Any inline policies (should be empty — inline policies are temporary and should be cleaned up after use)

3. **ACM certificates** — call `mcp__cloudless-infra__aws_list_acm_certs` to list all certs in `us-east-1`. For each cert:
   - Status: ISSUED / PENDING_VALIDATION / EXPIRED
   - Domain names (SANs)
   - Expiry date
   - In-use by (distributions, load balancers)

   Flag any cert that:
   - Expires within 30 days
   - Has status other than ISSUED
   - Is not in use by any resource (orphaned)

4. **IAM permission escalation cleanup check** — verify no temporary inline policies remain on `cloudless-ops-role`:

   ```
   aws iam list-role-policies --role-name cloudless-ops-role
   ```

   If any inline policy exists, report it as a security concern and ask the user whether to revoke it.

5. Print a summary:

   ```
   IAM Users:     N found, N expected
   IAM Roles:     cloudless-ops-role — OK / inline policies present
   ACM Certs:     N active, N expiring soon, N orphaned
   ```

## Key Resources

| Resource | Value |
|---|---|
| IAM role | `cloudless-ops-role` |
| ACM cert (cloudless.gr) | `arn:aws:acm:us-east-1:278585680617:certificate/f505905a-...` |
| ACM cert (.online, not ours) | In Cloudflare's account — do not attempt to delete |
| AWS account | `278585680617` |
| Region | `us-east-1` |

## Notes

- The cloudless.online ACM cert (`172fc7be-...`) is owned by Cloudflare's infrastructure account (`250044486744`). It appears in our `list-certificates` output but **cannot be deleted** — it is not our cert.
- Inline policies on `cloudless-ops-role` are used for temporary privilege escalation (e.g., one-time Route 53 health check deletion). They must be revoked within the same session. If found lingering, revoke immediately via `mcp__cloudless-infra__aws_revoke_route53_delete_health_check`.
- All AWS commands run via SSH to `omv-main` using the `omv-main-cli` AWS profile.
