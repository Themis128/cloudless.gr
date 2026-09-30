#!/usr/bin/env python3
"""ses-iam-grant-report — build the issue comment for
grant-ses-iam-permissions.yml.

Usage: python3 scripts/ses-iam-grant-report.py \
    STATUS ROLE ACCOUNT TIMESTAMP"""

import json
import sys

STATUS = sys.argv[1] if len(sys.argv) > 1 else "unknown"
ROLE = sys.argv[2] if len(sys.argv) > 2 else "unknown"
ACCOUNT = sys.argv[3] if len(sys.argv) > 3 else "unknown"
TIMESTAMP = sys.argv[4] if len(sys.argv) > 4 else "unknown"

print(f"""# SES IAM permissions grant — {TIMESTAMP}

**Status:** {STATUS}
**Role:** `{ROLE}`
""")

if STATUS == "success":
    print(f"""Policy **AllowSesSmtpUserProvisioning** attached to **`{ROLE}`**.

provision-ses-smtp.yml triggered — check issue #382 in ~60s for SES provisioning result.""")
else:
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "iam:GetUser",
                    "iam:CreateUser",
                    "iam:PutUserPolicy",
                    "iam:ListAccessKeys",
                    "iam:CreateAccessKey",
                    "iam:DeleteAccessKey",
                ],
                "Resource": f"arn:aws:iam::{ACCOUNT}:user/cloudless-ses-smtp",
            },
            {
                "Effect": "Allow",
                "Action": ["ssm:PutParameter", "ssm:GetParameter"],
                "Resource": f"arn:aws:ssm:us-east-1:{ACCOUNT}:parameter/cloudless/production/SES*",
            },
        ],
    }
    print(f"""**`iam:PutRolePolicy` denied** — the OIDC role cannot self-grant permissions.

**Manual fix:** AWS Console → IAM → Roles → `GitHubActionsOIDC` → Add inline policy:

```json
{json.dumps(policy, indent=2)}
```

After adding the policy, touch `.github/workflows/provision-ses-smtp.yml` to re-trigger.""")
