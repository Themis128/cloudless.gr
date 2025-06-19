#!/bin/bash

# Jenkins Webhook Setup Script
# This script helps you configure the correct webhook URL for your Jenkins setup

echo "🔧 Jenkins Webhook Configuration Helper"
echo "======================================"

# Your current ngrok URL
NGROK_URL="https://da19-85-75-69-233.ngrok-free.app"
WEBHOOK_TOKEN="cloudless-gr-webhook-token"

echo ""
echo "📡 Testing Jenkins endpoints..."

# Test different webhook endpoints
endpoints=(
    "/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN"
    "/github-webhook/"
    "/git/notifyCommit"
    "/job/cloudless-gr-e2e-pipeline/build?token=$WEBHOOK_TOKEN"
)

echo ""
echo "🧪 Testing endpoints (expect 200/405 for working endpoints):"

for endpoint in "${endpoints[@]}"; do
    url="${NGROK_URL}${endpoint}"
    echo -n "Testing: $url ... "

    status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)

    case $status in
        200|405) echo "✅ WORKING (Status: $status)" ;;
        404) echo "❌ NOT FOUND (Status: $status)" ;;
        403) echo "⚠️  FORBIDDEN (Status: $status) - Check authentication" ;;
        *) echo "🔍 UNKNOWN (Status: $status)" ;;
    esac
done

echo ""
echo "📋 Recommended GitHub Webhook URLs:"
echo ""

# Generic Webhook Trigger (Recommended)
echo "1. 🎯 Generic Webhook Trigger (RECOMMENDED):"
echo "   URL: ${NGROK_URL}/generic-webhook-trigger/invoke?token=${WEBHOOK_TOKEN}"
echo "   Content Type: application/json"
echo "   Events: Just the push event"
echo ""

# GitHub Integration Plugin
echo "2. 🐙 GitHub Integration Plugin:"
echo "   URL: ${NGROK_URL}/github-webhook/"
echo "   Content Type: application/json"
echo "   Events: Just the push event"
echo ""

# Direct Job Trigger
echo "3. 🔨 Direct Job Trigger:"
echo "   URL: ${NGROK_URL}/job/YOUR_JOB_NAME/build?token=${WEBHOOK_TOKEN}"
echo "   Content Type: application/x-www-form-urlencoded"
echo "   Events: Just the push event"
echo ""

echo "🔍 Quick Test Commands:"
echo ""

# Test Generic Webhook Trigger
echo "Test Generic Webhook Trigger:"
echo "curl -X POST '${NGROK_URL}/generic-webhook-trigger/invoke?token=${WEBHOOK_TOKEN}' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"ref\":\"refs/heads/application\",\"repository\":{\"name\":\"cloudless.gr\"}}'"
echo ""

# Test GitHub Webhook
echo "Test GitHub Webhook:"
echo "curl -X POST '${NGROK_URL}/github-webhook/' \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'X-GitHub-Event: push' \\"
echo "  -d '{\"ref\":\"refs/heads/application\",\"repository\":{\"name\":\"cloudless.gr\"}}'"
echo ""

echo "🎯 Next Steps:"
echo "1. Install 'Generic Webhook Trigger' plugin in Jenkins if not already installed"
echo "2. Use the first URL (Generic Webhook Trigger) in your GitHub webhook"
echo "3. Test the webhook using the curl commands above"
echo "4. Check Jenkins build queue for triggered builds"
echo ""

echo "📚 For detailed troubleshooting, see: .jenkins/WEBHOOK_TROUBLESHOOTING.md"
