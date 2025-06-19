# Jenkins Webhook Troubleshooting Guide

## 🚨 Current Issue: 404 Error on Webhook

Your webhook URL `https://da19-85-75-69-233.ngrok-free.app/github-webhook/` is returning a 404 error.

## 🔧 Quick Fixes to Try

### Option 1: Try Different Jenkins Webhook Endpoints

Test these URLs in your browser first to see which one responds:

1. **Generic Webhook Trigger Plugin:**

   ```
   https://da19-85-75-69-233.ngrok-free.app/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token
   ```

2. **GitHub Integration Plugin:**

   ```
   https://da19-85-75-69-233.ngrok-free.app/github-webhook/
   ```

3. **Generic Git Plugin:**

   ```
   https://da19-85-75-69-233.ngrok-free.app/git/notifyCommit?url=YOUR_REPO_URL
   ```

4. **Build Trigger (no specific plugin):**
   ```
   https://da19-85-75-69-233.ngrok-free.app/job/YOUR_JOB_NAME/build?token=YOUR_BUILD_TOKEN
   ```

### Option 2: Enable Generic Webhook Trigger

1. **Install the Plugin:**

   - Go to Jenkins → Manage Jenkins → Manage Plugins
   - Search for "Generic Webhook Trigger"
   - Install and restart Jenkins

2. **Update GitHub Webhook URL to:**

   ```
   https://da19-85-75-69-233.ngrok-free.app/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token
   ```

3. **Uncomment the webhook trigger in your Jenkinsfile**

## 🛠️ Step-by-Step Webhook Setup

### Step 1: Verify Jenkins Plugins

Required plugins:

- Generic Webhook Trigger Plugin
- GitHub Integration Plugin
- Pipeline: GitHub Groovy Libraries

### Step 2: Configure Jenkins Job

1. Go to your Jenkins job → Configure
2. Under "Build Triggers", check:
   - "Generic Webhook Trigger" (if using generic webhook)
   - "GitHub hook trigger for GITScm polling" (if using GitHub plugin)

### Step 3: Set Up GitHub Webhook

1. Go to your GitHub repository
2. Settings → Webhooks → Add webhook
3. Configure:
   - **Payload URL**: One of the URLs above that works
   - **Content type**: `application/json`
   - **Secret**: Your webhook secret (optional but recommended)
   - **Events**: Select "Just the push event" or "Let me select individual events"
   - **Active**: ✅ Checked

### Step 4: Test the Webhook

After setup, test by:

1. Making a small commit to your `application` branch
2. Pushing the commit
3. Check GitHub webhook deliveries for success/failure
4. Check Jenkins for triggered builds

## 🔍 Debugging Steps

### Check Jenkins Logs

```bash
# Access Jenkins container logs
docker logs jenkins-container-name

# Or check Jenkins system logs
# Go to Jenkins → Manage Jenkins → System Log
```

### Test Webhook Manually

```bash
# Test generic webhook trigger
curl -X POST "https://da19-85-75-69-233.ngrok-free.app/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token" \
  -H "Content-Type: application/json" \
  -d '{"ref":"refs/heads/application","repository":{"name":"cloudless.gr"}}'

# Test GitHub webhook endpoint
curl -X POST "https://da19-85-75-69-233.ngrok-free.app/github-webhook/" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"ref":"refs/heads/application","repository":{"name":"cloudless.gr"}}'
```

### Check ngrok Status

```bash
# Check ngrok status and tunnels
curl http://localhost:4040/api/tunnels

# Verify ngrok is pointing to correct Jenkins port
# Default Jenkins port is usually 8080
```

## 🚀 Recommended Solution

**Use Generic Webhook Trigger Plugin** (most reliable):

1. **Install the plugin** in Jenkins
2. **Update your GitHub webhook URL to:**
   ```
   https://da19-85-75-69-233.ngrok-free.app/generic-webhook-trigger/invoke?token=cloudless-gr-webhook-token
   ```
3. **Uncomment the webhook configuration** in your Jenkinsfile
4. **Test the setup**

## 🔐 Security Considerations

1. **Use HTTPS**: ✅ You're already using ngrok with HTTPS
2. **Add webhook secret**: Configure a secret in both GitHub and Jenkins
3. **Restrict IP access**: Consider restricting to GitHub webhook IPs
4. **Use authentication tokens**: Ensure your webhook token is secure

## 📞 If Still Having Issues

1. **Check Jenkins is accessible:**

   ```bash
   curl -I https://da19-85-75-69-233.ngrok-free.app/
   ```

2. **Verify Jenkins webhook endpoints:**

   ```bash
   curl https://da19-85-75-69-233.ngrok-free.app/pluginManager/api/json
   ```

3. **Check Jenkins plugin status:**

   - Go to Jenkins → Manage Jenkins → Manage Plugins → Installed
   - Verify webhook plugins are installed and enabled

4. **Review Jenkins security settings:**
   - Go to Jenkins → Manage Jenkins → Configure Global Security
   - Ensure webhooks are not blocked by CSRF protection
