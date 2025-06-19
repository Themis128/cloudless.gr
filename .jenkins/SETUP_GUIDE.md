# Jenkins Push Trigger Setup Guide

This guide explains how to configure Jenkins to automatically trigger builds when you push code to your repository.

## 🔧 Configuration Options

### Option 1: GitHub Webhook (Recommended)

#### 1. Configure GitHub Webhook

1. Go to your GitHub repository → Settings → Webhooks
2. Click "Add webhook"
3. Set Payload URL: `http://your-jenkins-server/github-webhook/`
4. Content type: `application/json`
5. Secret: Use the same secret as in Jenkins credentials
6. Select events: `Push events` and `Pull requests`
7. Active: ✅ checked

#### 2. Jenkins Webhook Plugin Setup

Install required plugins in Jenkins:

```bash
# Jenkins plugins to install
- GitHub Integration Plugin
- Generic Webhook Trigger Plugin
- Pipeline: GitHub Groovy Libraries
```

#### 3. Jenkins Credentials Setup

1. Go to Jenkins → Manage Jenkins → Manage Credentials
2. Add these credentials:
   - `github-credentials-id`: GitHub personal access token
   - `cloudless-gr-webhook-token`: Webhook secret token

### Option 2: SCM Polling (Fallback)

Your Jenkinsfile now includes SCM polling every 2 minutes:

```groovy
triggers {
    pollSCM('H/2 * * * *')
}
```

### Option 3: Multibranch Pipeline (Advanced)

Use the provided `job-dsl.groovy` script to create a multibranch pipeline that automatically:

- Detects new branches
- Triggers builds on push
- Handles pull requests
- Manages branch lifecycle

## 🚀 Quick Setup Steps

### For Existing Jenkins Job:

1. Open your Jenkins job configuration
2. Scroll to "Build Triggers" section
3. Check "GitHub hook trigger for GITScm polling"
4. Save the configuration

### For New Jenkins Job:

1. Create new Pipeline job
2. Use the provided `job-dsl.groovy` script
3. Or manually configure using the webhook settings

## 🔍 Testing the Setup

### Test GitHub Webhook:

1. Make a small commit to your repository
2. Push to the main branch
3. Check Jenkins for new build

### Test Manual Trigger:

```bash
# Trigger via webhook URL
curl -X POST http://your-jenkins-server/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token
```

## 📊 Monitoring

### Jenkins Build Logs

Check these locations for trigger information:

- Jenkins job console output
- Jenkins system logs
- GitHub webhook delivery logs

### Webhook Debugging

1. GitHub → Repository → Settings → Webhooks
2. Click on your webhook
3. Check "Recent Deliveries" tab
4. Look for successful/failed deliveries

## ⚙️ Environment Variables

The pipeline automatically receives these variables from GitHub webhooks:

- `$ref` - Branch reference (e.g., refs/heads/main)
- `$repository` - Repository name
- `$pusher` - Who pushed the code
- `$BUILD_NUMBER` - Jenkins build number
- `$GIT_COMMIT` - Git commit hash

## 🔐 Security Considerations

1. **Use HTTPS**: Always use HTTPS for webhook URLs
2. **Secret Tokens**: Configure webhook secrets for security
3. **IP Restrictions**: Restrict Jenkins access to GitHub IPs
4. **Credentials**: Store all secrets in Jenkins credential store

## 🎯 Branch-Specific Triggers

The current configuration triggers on:

- `main` branch (production)
- `master` branch (legacy)
- `develop` branch (development)

To modify branches, update this regex in Jenkinsfile:

```groovy
regexpFilterExpression: 'refs/heads/(main|master|develop|feature/.*)'
```

## 📝 Troubleshooting

### Common Issues:

1. **Webhook not triggering**: Check GitHub webhook delivery logs
2. **Jenkins not responding**: Verify Jenkins URL is accessible from GitHub
3. **Build not starting**: Check Jenkins job trigger configuration
4. **Permission denied**: Verify GitHub credentials in Jenkins

### Debug Commands:

```bash
# Check Jenkins webhook endpoint
curl -I http://your-jenkins-server/github-webhook/

# Test generic webhook trigger
curl -X POST "http://your-jenkins-server/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token" \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/main","repository":{"name":"cloudless.gr"}}'
```

## 📈 Advanced Features

### Conditional Builds:

- Skip builds for documentation-only changes
- Different pipelines for different branches
- Build parameter customization based on commit message

### Integration with GitHub Actions:

Your existing GitHub Actions can trigger Jenkins jobs or vice versa using repository dispatch events.

---

## 📞 Need Help?

If you encounter issues:

1. Check Jenkins system logs
2. Verify GitHub webhook deliveries
3. Test webhook manually using curl
4. Review Jenkins plugin documentation
