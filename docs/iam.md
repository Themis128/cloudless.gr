# IAM in the cloudless.gr AWS account

A map of the IAM principals that touch CI/CD for this project, what each is for,
and how to grant SST a new permission without generating root access keys.

Account: `278585680617` · Region: `us-east-1`

## Principals at a glance

| Principal | Type | Used by | Trust / auth |
|---|---|---|---|
| `GitHubActionsOIDC` | Role | Deploy workflow ([deploy.yml](../.github/workflows/deploy.yml)) | OIDC, trust restricted to `Themis128/cloudless.gr` |
| `cloudless-github-actions` | Role | Pi-image workflow ([build-pi-image.yml](../.github/workflows/build-pi-image.yml)) | OIDC, same trust |
| `cloudless-ops` | IAM user | Operator (you, locally) | Long-term access keys |
| (root) | Account root | Bootstrap only | Avoid. See [Security note](#security-note) |

## `GitHubActionsOIDC` — the deploy role

Assumed by the `Deploy to Production` workflow. Its trust policy restricts
`token.actions.githubusercontent.com` to this repo. It carries:

- **`PowerUserAccess`** (AWS managed) — broad service access, but explicitly
  excludes IAM. Sufficient for everything SST does *except* role/policy
  manipulation.
- **`cloudless-sst-deploy-iam-tagging`** (customer managed, default version
  `v4`) — fills the IAM gap. Grants the actions SST/Pulumi needs on roles
  matching `cloudl*` and policies matching `cloudl*` (the prefix SST emits
  for stack outputs — see [`memory/sst_role_prefix.md`](../../home/.claude/projects/-mnt-d-Nuxt-Projects-Cloudless-cloudless-gr/memory/sst_role_prefix.md)).
- **`CICDSstRoleManagement`** (inline, legacy) — superseded by `v4` of the
  managed policy above. Safe to keep; safe to remove if anyone has
  `iam:DeleteRolePolicy` on the role (cloudless-ops does not).

**This role does NOT have `iam:SimulatePrincipalPolicy`.** The deploy preflight
[detects that and degrades to a warning](../.github/workflows/deploy.yml).

## `cloudless-github-actions` — the Pi-image role

Assumed by the `build pi image` workflow to push images to the
`cloudless-pi-app` ECR repository (which has IMMUTABLE tag mutability).

- **`ecr:BatchDeleteImage`** on `cloudless-pi-app` — granted in this session
  via inline policy `CICDEcrUntagLatest`. Lets the workflow untag the existing
  `:latest` before re-tagging the new image. See
  [skill: ecr-immutable-tags-ci](../../home/.claude/skills/ecr-immutable-tags-ci/SKILL.md)
  for the why.

If this permission is ever revoked, the workflow [falls back to SHA-only push](../.github/workflows/build-pi-image.yml) and warns — it does not break.

## `cloudless-ops` — the operator user

Long-term IAM user that is the recommended way to make IAM changes locally,
**without** generating root access keys. Carries two attached policies:

- **`cloudless-ops-project`** — read-only across most services + Route 53
  manage.
- **`cloudless-ops-vpc-acm`** — EC2 networking + ACM management + `iam:PassRole`
  scoped to `cloudless-*`.

The non-obvious bit: it also has `iam:CreatePolicyVersion` on
`cloudless-sst-deploy-iam-tagging`. This is the **escape hatch** — you can grant
SST any new IAM permission by creating a new version of that managed policy,
without touching the deploy role inline policy or generating root keys.

Credentials: `C:\Users\baltz\Downloads\cloudless-ops_accessKeys (1).csv`
(AKID `AKIA…EHQJ`).

## How to add a new IAM permission SST needs

When SST starts requiring a new IAM action (this happens whenever the stack
adds a new construct — Lambda warmer, EventBridge rule, etc.), don't add
inline policies to `GitHubActionsOIDC`. Instead, version-bump the managed
policy:

```python
import csv, os, boto3, json

with open('/mnt/c/Users/baltz/Downloads/cloudless-ops_accessKeys (1).csv', encoding='utf-8-sig') as f:
    row = next(csv.DictReader(f))
os.environ['AWS_ACCESS_KEY_ID'] = row['Access key ID'].strip()
os.environ['AWS_SECRET_ACCESS_KEY'] = row['Secret access key'].strip()

iam = boto3.client('iam', region_name='us-east-1')
ARN = 'arn:aws:iam::278585680617:policy/cloudless-sst-deploy-iam-tagging'

pol = iam.get_policy(PolicyArn=ARN)['Policy']
ver = iam.get_policy_version(PolicyArn=ARN, VersionId=pol['DefaultVersionId'])
doc = ver['PolicyVersion']['Document']

# ... mutate doc in place: add an action to the relevant Statement ...

# AWS keeps max 5 versions; delete oldest non-default if at limit
versions = iam.list_policy_versions(PolicyArn=ARN)['Versions']
if len(versions) >= 5:
    oldest = sorted([v for v in versions if not v['IsDefaultVersion']],
                    key=lambda v: v['CreateDate'])[0]
    iam.delete_policy_version(PolicyArn=ARN, VersionId=oldest['VersionId'])

iam.create_policy_version(PolicyArn=ARN, PolicyDocument=json.dumps(doc),
                          SetAsDefault=True)
```

That's it. The deploy role picks up the new permission immediately on the
next deploy — no role edit, no Console click, no root key.

## Resource scoping rules of thumb

When writing IAM policies for this project, scope `Resource` to:

- **SST-managed roles**: `arn:aws:iam::278585680617:role/cloudl*`
  (NOT `cloudless-*` — SST truncates the prefix, see [memory](../../home/.claude/projects/-mnt-d-Nuxt-Projects-Cloudless-cloudless-gr/memory/sst_role_prefix.md))
- **SST-managed policies**: `arn:aws:iam::278585680617:policy/cloudl*`
- **CI-related ECR repos**: `arn:aws:ecr:us-east-1:278585680617:repository/cloudless-*`
- **Application Lambda/etc.**: existing `cloudless-*` prefix on most other
  resources (S3 buckets, SSM params, secrets) — no truncation there.

## Security note

This account has had three separate root access keys generated this year, all
of which were active long enough to be downloaded as `rootkey*.csv` and then
deactivated. AWS auto-disables root keys when it detects them in scanning.

**Do not generate root keys.** Every IAM operation that has come up so far
can be done either by `cloudless-ops` directly, or by version-bumping
`cloudless-sst-deploy-iam-tagging`. If you find yourself reaching for a root
key, the right answer is almost always to expand `cloudless-ops`'s permissions
narrowly — not to bypass IAM entirely.

The bootstrap admin path that does require root, *if you ever need one*, is:

1. From the AWS Console (logged in as root), create an IAM user
   `claude-iam-bootstrap` with whatever scoped admin perms you need.
2. Use that user's keys to do the IAM operation.
3. Delete the user when done.
4. Delete the root access key immediately — never persist it on disk.

## See also

- [docs/deploy.md](deploy.md) — what the deploy role needs and why
- [docs/ci-health-routine.md](ci-health-routine.md) — the weekly green-pipeline check
- [scripts/grant-ci-iam-permissions.py](../scripts/grant-ci-iam-permissions.py) — boto3 helper that applies the recommended scoped policies
- [skill: lighthouse-perf-debug](../../home/.claude/skills/lighthouse-perf-debug/SKILL.md)
- [skill: ecr-immutable-tags-ci](../../home/.claude/skills/ecr-immutable-tags-ci/SKILL.md)
