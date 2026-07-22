#!/usr/bin/env bash
# Plan for removing AWS SDK packages from main package.json
# This file documents the strategy; actual edits done via replace_in_file
#
# Strategy:
# 1. Convert all static AWS imports to dynamic imports in src/ files
# 2. Replace @aws-lambda-powertools/logger with console
# 3. Keep @aws-sdk/client-s3 only (needed for R2 uploads via S3-compatible API)
# 4. Remove 8 of 9 AWS packages from package.json
#
# Files to modify by package:
#
# @aws-lambda-powertools/logger (1 file)
#   src/lib/logger.ts -> replace with console
#
# @aws-sdk/client-ssm (5 files -> dynamic imports)
#   src/lib/ssm-config.ts
#   src/lib/voice-brief-store.ts
#   src/lib/pending-clients.ts
#   src/lib/client-portals.ts
#   src/lib/workspace-server.ts
#
# @aws-sdk/client-dynamodb (8 files -> dynamic imports)  
#   src/lib/session-token-store.ts
#   src/lib/stripe-transactions.ts
#   src/lib/stripe-analytics-read.ts
#   src/lib/gsc-cache.ts
#   src/lib/user-profile.ts
#   src/lib/ad-analytics/bookmarks.ts
#   src/lib/admin-notifications.ts
#   src/lib/recommendations.ts
#
# @aws-sdk/client-bedrock-runtime (4 files -> dynamic imports)
#   src/lib/bedrock-chat.ts
#   src/lib/bedrock-shared.ts
#   src/lib/bedrock-embeddings.ts
#   src/lib/agent-book.ts
#   src/lib/recommendations.ts
#
# @aws-sdk/client-cognito-identity-provider (3 files -> dynamic imports)
#   src/app/api/admin/users/[id]/route.ts
#   src/app/api/admin/users/route.ts
#   src/app/api/user/delete/route.ts
#
# @aws-sdk/client-sns (1 file -> dynamic import)
#   src/lib/sns-notify.ts
#
# @aws-sdk/client-athena (1 file -> dynamic import)
#   src/lib/athena.ts
#
# @aws-sdk/client-s3 (KEEP for R2, but convert non-R2 uses to dynamic)
#   src/lib/r2-upload.ts -> KEEP static (R2 uses S3 API)
#   src/lib/admin-notifications.ts -> dynamic
#   src/lib/stripe-transactions.ts -> already dynamic
#   src/lib/cost-analytics.ts -> already dynamic
#
# @aws-sdk/client-sesv2 (already all dynamic)
#   src/lib/ses-suppression.ts -> already dynamic
#   src/lib/email-sender.ts -> already dynamic
#
echo "Plan loaded. Execute edits sequentially."