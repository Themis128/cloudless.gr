# Jenkins Webhook Setup Script - PowerShell Version
# This script helps you configure the correct webhook URL for your Jenkins setup

Write-Host "🔧 Jenkins Webhook Configuration Helper" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Your current ngrok URL
$NGROK_URL = "https://da19-85-75-69-233.ngrok-free.app"
$WEBHOOK_TOKEN = "cloudless-gr-webhook-token"

Write-Host ""
Write-Host "📡 Testing Jenkins endpoints..." -ForegroundColor Yellow

# Test different webhook endpoints
$endpoints = @(
  "/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN",
  "/github-webhook/",
  "/git/notifyCommit",
  "/job/cloudless-gr-e2e-pipeline/build?token=$WEBHOOK_TOKEN"
)

Write-Host ""
Write-Host "🧪 Testing endpoints (expect 200/405 for working endpoints):" -ForegroundColor Yellow

foreach ($endpoint in $endpoints) {
  $url = "$NGROK_URL$endpoint"
  Write-Host "Testing: $url ... " -NoNewline

  try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
    $status = $response.StatusCode
  }
  catch {
    $status = $_.Exception.Response.StatusCode.Value__
  }

  switch ($status) {
    { $_ -in 200, 405 } { Write-Host "✅ WORKING (Status: $_)" -ForegroundColor Green }
    404 { Write-Host "❌ NOT FOUND (Status: $_)" -ForegroundColor Red }
    403 { Write-Host "⚠️  FORBIDDEN (Status: $_) - Check authentication" -ForegroundColor Yellow }
    default { Write-Host "🔍 UNKNOWN (Status: $_)" -ForegroundColor Gray }
  }
}

Write-Host ""
Write-Host "📋 Recommended GitHub Webhook URLs:" -ForegroundColor Cyan
Write-Host ""

# Generic Webhook Trigger (Recommended)
Write-Host "1. 🎯 Generic Webhook Trigger (RECOMMENDED):" -ForegroundColor Green
Write-Host "   URL: $NGROK_URL/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN" -ForegroundColor White
Write-Host "   Content Type: application/json" -ForegroundColor Gray
Write-Host "   Events: Just the push event" -ForegroundColor Gray
Write-Host ""

# GitHub Integration Plugin
Write-Host "2. 🐙 GitHub Integration Plugin:" -ForegroundColor Blue
Write-Host "   URL: $NGROK_URL/github-webhook/" -ForegroundColor White
Write-Host "   Content Type: application/json" -ForegroundColor Gray
Write-Host "   Events: Just the push event" -ForegroundColor Gray
Write-Host ""

# Direct Job Trigger
Write-Host "3. 🔨 Direct Job Trigger:" -ForegroundColor Magenta
Write-Host "   URL: $NGROK_URL/job/YOUR_JOB_NAME/build?token=$WEBHOOK_TOKEN" -ForegroundColor White
Write-Host "   Content Type: application/x-www-form-urlencoded" -ForegroundColor Gray
Write-Host "   Events: Just the push event" -ForegroundColor Gray
Write-Host ""

Write-Host "🔍 Quick Test Commands:" -ForegroundColor Cyan
Write-Host ""

# Test Generic Webhook Trigger
Write-Host "Test Generic Webhook Trigger:" -ForegroundColor Yellow
$genericTest = @"
Invoke-RestMethod -Uri '$NGROK_URL/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN' ``
  -Method POST ``
  -ContentType 'application/json' ``
  -Body '{"ref":"refs/heads/application","repository":{"name":"cloudless.gr"}}'
"@
Write-Host $genericTest -ForegroundColor White
Write-Host ""

# Test GitHub Webhook
Write-Host "Test GitHub Webhook:" -ForegroundColor Yellow
$githubTest = @"
Invoke-RestMethod -Uri '$NGROK_URL/github-webhook/' ``
  -Method POST ``
  -ContentType 'application/json' ``
  -Headers @{'X-GitHub-Event'='push'} ``
  -Body '{"ref":"refs/heads/application","repository":{"name":"cloudless.gr"}}'
"@
Write-Host $githubTest -ForegroundColor White
Write-Host ""

Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Install 'Generic Webhook Trigger' plugin in Jenkins if not already installed" -ForegroundColor White
Write-Host "2. Use the first URL (Generic Webhook Trigger) in your GitHub webhook" -ForegroundColor White
Write-Host "3. Test the webhook using the PowerShell commands above" -ForegroundColor White
Write-Host "4. Check Jenkins build queue for triggered builds" -ForegroundColor White
Write-Host ""

Write-Host "📚 For detailed troubleshooting, see: .jenkins/WEBHOOK_TROUBLESHOOTING.md" -ForegroundColor Gray

# Test the recommended endpoint
Write-Host ""
Write-Host "🧪 Testing recommended endpoint now..." -ForegroundColor Yellow

try {
  $testResponse = Invoke-RestMethod -Uri "$NGROK_URL/generic-webhook-trigger/invoke?token=$WEBHOOK_TOKEN" -Method POST -ContentType 'application/json' -Body '{"ref":"refs/heads/application","repository":{"name":"cloudless.gr"}}' -ErrorAction Stop
  Write-Host "✅ Generic Webhook Trigger is working!" -ForegroundColor Green
  Write-Host "Response: $testResponse" -ForegroundColor Gray
}
catch {
  Write-Host "❌ Generic Webhook Trigger test failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Try the GitHub webhook endpoint instead" -ForegroundColor Yellow
}
