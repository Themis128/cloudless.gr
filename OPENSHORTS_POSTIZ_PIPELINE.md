# OpenShorts + Postiz Video-to-Social Pipeline

## Overview

This document describes the automated video generation and social publishing pipeline that integrates **OpenShorts** (video rendering) with **Postiz** (social media scheduling) for Cloudless.gr content automation.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
│  Trigger    │────▶│  OpenShorts  │────▶│  Download   │────▶│  Postiz    │
│  Pipeline   │     │  Render Job  │     │  Video File │     │  Upload    │
└─────────────┘     └──────────────┘     └─────────────┘     └────────────┘
                                                                    │
                                                                    ▼
                                                           ┌────────────┐
                                                           │  Schedule  │
                                                           │  Posts     │
                                                           └────────────┘
```

## Prerequisites

### 1. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `POSTIZ_API_KEY` | API key from Postiz dashboard (Settings → API Keys) | **Yes** |
| `OPENSHORTS_API_URL` | OpenShorts API endpoint (default: `http://cluster.local`) | No |
| `POSTIZ_API_URL` | Postiz API endpoint (default: `http://cluster.local`) | No |

### 2. Services Running

- **OpenShorts** deployed at `http://cluster.local` (or configured URL)
- **Postiz** deployed at `http://cluster.local` (or configured URL)
- Both services accessible from the execution environment

### 3. Local Development Setup

```bash
# 1. Copy example env file
cp .dev.vars.example .dev.vars

# 2. Edit .dev.vars and add your Postiz API key
# POSTIZ_API_KEY=your-actual-api-key

# 3. Make pipeline executable
chmod +x openshorts_postiz_pipeline.js
```

## Pipeline Phases

### Phase 1: Trigger Render

- Sends a render job to OpenShorts with template and data
- Returns a job ID for tracking
- **Timeout**: 30 seconds

### Phase 2: Poll Completion

- Polls OpenShorts for job status every 5 seconds
- Maximum 60 attempts (5 minutes total)
- Returns video download URL on completion
- **Timeout**: 5 minutes

### Phase 3: Download Video

- Downloads rendered video to `./temp/video.mp4`
- Uses curl for reliable large file transfer
- **Timeout**: 5 minutes

### Phase 4: Upload to Postiz

- Uploads video to Postiz media library via multipart/form-data
- Returns media ID for scheduling
- **Timeout**: 5 minutes

### Phase 5: Schedule Posts

- Creates scheduled posts for multiple platforms:
  - LinkedIn
  - Twitter/X
  - Facebook
  - Instagram
- Schedules 1 minute in the future (configurable)
- **Timeout**: 30 seconds per platform

## Usage

### Direct Execution

```bash
# With environment variable
POSTIZ_API_KEY=your-key node openshorts_postiz_pipeline.js

# Or with .dev.vars loaded (requires dotenv)
node -r dotenv/config openshorts_postiz_pipeline.js
```

### With Cline MCP Integration

The pipeline can be triggered via Cline using the MCP servers:

1. **openshorts-mcp** - Direct OpenShorts control
2. **postiz-mcp** - Direct Postiz control

See [Cline Integration Guide](#cline-mcp-integration) below.

## Cline MCP Integration

### MCP Configuration

The following MCP servers are configured in `mcp.json`:

```json
{
  "mcpServers": {
    "openshorts": {
      "command": "npx",
      "args": ["-y", "@mutonby/openshorts-mcp"],
      "env": {
        "OPENSHORTS_API_URL": "http://cluster.local"
      },
      "autoStart": false
    },
    "postiz": {
      "command": "npx",
      "args": ["-y", "@antoniolg/postiz-mcp"],
      "env": {
        "POSTIZ_API_URL": "http://cluster.local",
        "POSTIZ_API_KEY": "${POSTIZ_API_KEY}"
      },
      "autoStart": false
    }
  }
}
```

### Operational Prompt for Cline

Copy and paste this prompt into Cline to trigger the pipeline:

```
You are acting as an automated DevOps and Content Pipeline Agent. Your goal is to orchestrate a video generation and social publishing workflow using local cluster services.

### Infrastructure Context
1. **Video Engine:** OpenShorts is deployed at `http://cluster.local`
2. **Scheduler Engine:** Postiz API is available at `http://cluster.local`
3. **Pipeline Runner:** Use the `openshorts_postiz_pipeline.js` script.

### Operational Instructions
1. **Pre-Flight Check:** Read the `POSTIZ_API_KEY` from environment variables. If it is missing, stop immediately and report the error.
2. **Execute Pipeline:** Run `node openshorts_postiz_pipeline.js` via your terminal tool to initiate the video generation sequence.
3. **Monitor Logs:** Parse the terminal stdout to trace execution progress across all 5 pipeline phases (Trigger → Poll → Download → Upload → Schedule).
4. **Error Handling:** If any step fails (e.g., render timeout, upload rejection), pull the service logs using your terminal capabilities (`kubectl logs service/openshorts-service`) to debug the underlying engine state and propose fixes.
```

### Verification Checklist for Cline

When Cline initiates the automation task, it should track progress using this validation checklist:

| Phase | Operational Check | Verification Action Required | Expected Outcome |
|-------|------------------|------------------------------|------------------|
| 01 | Cluster Networking | Check connectivity to OpenShorts and Postiz core services | HTTP Status 200 or 404 (not 502/504) |
| 02 | Security Tokens | Confirm POSTIZ_API_KEY environment string is populated | Non-empty string wrapper |
| 03 | Engine Capacity | Verify OpenShorts worker node has processing room | Memory limits below 2Gi threshold |
| 04 | State Garbage Collection | Verify temporary .mp4 workspace data is purged from container storage | Local disk space fully reclaimed post-publish |

## Customization

### Modify Video Template

Edit the `renderPayload` in `triggerRender()` function:

```javascript
const renderPayload = {
  template: 'your-template-name',
  data: {
    title: 'Your Title',
    subtitle: 'Your Subtitle',
    cta: 'Your CTA'
  },
  format: 'mp4',
  quality: 'high'
};
```

### Modify Social Platforms

Edit the `platforms` array in `schedulePosts()` function:

```javascript
const platforms = ['linkedin', 'twitter', 'facebook', 'instagram', 'threads'];
```

### Modify Post Content

Edit the `postPayload` content in `schedulePosts()`:

```javascript
const postPayload = {
  content: `Your custom content here`,
  mediaIds: [mediaId],
  platforms: [platform],
  scheduledAt: new Date(Date.now() + 60000).toISOString(),
  timezone: 'Europe/Athens'
};
```

### Adjust Timing

- **Poll interval**: Change `intervalMs` in `pollCompletion()` (default: 5000ms)
- **Max attempts**: Change `maxAttempts` in `pollCompletion()` (default: 60)
- **Schedule delay**: Change `Date.now() + 60000` in `schedulePosts()` (default: 1 minute)

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `POSTIZ_API_KEY not set` | Missing environment variable | Set in `.dev.vars` or export before running |
| `OpenShorts health check failed` | Service not running | Check `kubectl get pods -n openshorts` |
| `Render timeout` | Video too complex or queue full | Increase timeout or check OpenShorts logs |
| `Upload failed` | Postiz API key invalid or quota exceeded | Verify API key in Postiz dashboard |
| `Schedule failed` | Platform not connected in Postiz | Connect social accounts in Postiz settings |

### Debug Commands

```bash
# Check OpenShorts logs
kubectl logs -n openshorts deployment/openshorts

# Check Postiz logs
kubectl logs -n postiz deployment/postiz

# Test OpenShorts API directly
curl http://cluster.local/health
curl http://cluster.local/api/render

# Test Postiz API directly
curl -H "Authorization: Bearer $POSTIZ_API_KEY" http://cluster.local/health
```

### Manual Pipeline Steps

If the automated pipeline fails, you can run steps manually:

```bash
# 1. Trigger render manually
curl -X POST http://cluster.local/api/render \
  -H "Content-Type: application/json" \
  -d '{"template":"default","data":{"title":"Test"},"format":"mp4"}'

# 2. Check job status
curl http://cluster.local/api/render/JOB_ID/status

# 3. Download video
curl -L -o video.mp4 "VIDEO_URL_FROM_STATUS"

# 4. Upload to Postiz
curl -X POST http://cluster.local/api/media/upload \
  -H "Authorization: Bearer $POSTIZ_API_KEY" \
  -F "file=@video.mp4" -F "type=video"

# 5. Schedule post
curl -X POST http://cluster.local/api/posts \
  -H "Authorization: Bearer $POSTIZ_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"content":"Test","mediaIds":["MEDIA_ID"],"platforms":["linkedin"]}'
```

## Monitoring & Logging

The pipeline provides structured logging with timestamps:

```
[2026-08-16T19:30:00.000Z] [INFO] Phase 1: Trigger Render - STARTED
[2026-08-16T19:30:02.000Z] [INFO] Phase 1: Trigger Render - COMPLETED (2.15s) - Job ID: abc123
[2026-08-16T19:30:02.000Z] [INFO] Phase 2: Poll Completion - STARTED
...
```

### Log Levels

- **INFO**: Normal operations
- **WARN**: Non-critical issues (e.g., platform scheduling failed)
- **ERROR**: Critical failures that stop the pipeline

## Security Considerations

1. **API Keys**: Never commit `POSTIZ_API_KEY` to version control
2. **Network**: Services communicate over internal cluster network (`cluster.local`)
3. **Secrets**: Use Wrangler secrets in production, `.dev.vars` locally
4. **Cleanup**: Temporary video files are automatically cleaned up on completion or failure

## Production Deployment

For production use, consider:

1. **Cron Job**: Schedule pipeline via Kubernetes CronJob or Cloudflare Workers Cron Trigger
2. **Queue System**: Use a message queue (Redis/RabbitMQ) for job management
3. **Monitoring**: Add Prometheus metrics and alerts
4. **Retry Logic**: Implement exponential backoff for transient failures
5. **Notifications**: Add Slack/email notifications on success/failure

## Related Files

- `openshorts_postiz_pipeline.js` - Main pipeline script
- `.dev.vars.example` - Environment variable template
- `mcp.json` - MCP server configuration
- `OPENSHORTS_POSTIZ_PIPELINE.md` - This documentation

## Support

For issues with:

- **OpenShorts**: Check [OpenShorts GitHub](https://github.com/mutonby/openshorts)
- **Postiz**: Check [Postiz GitHub](https://github.com/gitroomhq/postiz)
- **Pipeline**: Check Cloudless.gr repository issues
