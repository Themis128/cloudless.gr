---
inclusion: always
---

> **Historical — Cognito retired.** auth is Cloudflare D1 (`user-auth-db`, `src/lib/auth-d1.ts`, opaque `session_token` cookies). Cognito references below describe the old AWS stack. Kept for reference — do not follow as current ops.

# Infrastructure Constraint: Serverless Only

All implementations MUST be serverless. Never create, suggest, or reference:

- EC2 instances
- ECS on EC2 launch type
- Self-managed VMs or servers
- On-premise compute

Allowed compute: Lambda, API Gateway, Next.js on Lambda (SST/Amplify), ECS Fargate, S3, Athena, DynamoDB, Cognito, SES, CloudFront — all serverless/managed AWS services.
