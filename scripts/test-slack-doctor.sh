#!/usr/bin/env bash
# Smoke-test scripts/slack-app-doctor.sh against the live Cloudless app.
set -u
cd ~/code/cloudless.gr 2>/dev/null || cd /sessions/fervent-epic-darwin/mnt/cloudless.gr
TOKEN=$(aws ssm get-parameter --region us-east-1 --name /cloudless/production/SLACK_BOT_TOKEN --with-decryption --query Parameter.Value --output text)
SS=$(aws ssm get-parameter --region us-east-1 --name /cloudless/production/SLACK_SIGNING_SECRET --with-decryption --query Parameter.Value --output text)
CH=$(aws ssm get-parameter --region us-east-1 --name /cloudless/production/NEWSLETTER_SLACK_CHANNEL_ID --query Parameter.Value --output text)
echo "token len: ${#TOKEN}  secret len: ${#SS}  channel: $CH"
bash scripts/slack-app-doctor.sh \
  --token "$TOKEN" \
  --signing-secret "$SS" \
  --channel "$CH" \
  --commands-url https://cloudless.gr/api/slack/commands
