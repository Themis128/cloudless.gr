#!/usr/bin/env python3
"""
Grafana Slack Proxy - Collects and categorizes alerts before posting to Slack.
"""

import os
import hmac
import hashlib
import json
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler

import requests

# Configuration
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL")
SLACK_DEFAULT_CHANNEL = os.environ.get("SLACK_DEFAULT_CHANNEL", "#ads-test-scope")
PORT = int(os.environ.get("PORT", 5001))

# Verify signature if SLACK_SIGNING_SECRET is set
SLACK_SIGNING_SECRET = os.environ.get("SLACK_SIGNING_SECRET")


def verify_signature(body, timestamp, signature):
    """Verify Slack request signature (HMAC-SHA256)."""
    if not SLACK_SIGNING_SECRET:
        return True
    
    req = f"v0:{timestamp}:{body.decode()}"
    expected = "v0=" + hmac.new(
        SLACK_SIGNING_SECRET.encode(), req.encode(), hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(expected, signature)


def categorize_alert(alert_data):
    """Categorize alert by app and severity."""
    labels = alert_data.get("labels", {})
    
    app = labels.get("app", "unknown")
    category = labels.get("category", "general")
    severity = labels.get("severity", "info").upper()
    
    severity_emoji = {
        "CRITICAL": ":red_circle:",
        "HIGH": ":orange_circle:",
        "WARNING": ":yellow_circle:",
        "INFO": ":blue_circle:",
    }.get(severity, ":grey_question:")
    
    return {
        "app": app,
        "category": category,
        "severity": severity,
        "severity_emoji": severity_emoji,
    }


def format_alert_block(alert_data, category_info):
    """Format alert as Slack Block Kit."""
    annotations = alert_data.get("annotations", {})
    summary = annotations.get("summary", "No summary")
    description = annotations.get("description", "No description")
    runbook_url = annotations.get("runbook_url", "")
    
    start_time = alert_data.get("startsAt", "")
    if start_time:
        try:
            dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
            formatted_time = dt.strftime("%Y-%m-%d %H:%M:%S")
        except:
            formatted_time = start_time
    else:
        formatted_time = "unknown"
    
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{category_info['severity_emoji']} *{category_info['severity']} Alert*"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*App:*\n{category_info['app']}"},
                {"type": "mrkdwn", "text": f"*Category:*\n{category_info['category']}"},
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{summary}*\n_{description}_"
            }
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Started: {formatted_time}"},
            ]
        },
    ]
    
    if runbook_url:
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "View Runbook"},
                    "url": runbook_url,
                }
            ],
        })
    
    return blocks


def format_summary_block(category_counts, category_info):
    """Format summary block for grouped alerts."""
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{category_info['severity_emoji']} *{category_info['severity']} Alerts Summary*"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Total Alerts:*\n{category_counts['total']}"},
                {"type": "mrkdwn", "text": f"*Category:*\n{category_info['category']}"},
            ]
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "\n".join([
                    f":warning: *{app}* ({count} alert{'s' if count > 1 else ''})"
                    for app, count in category_counts['by_app'].items()
                ])
            }
        },
        {
            "type": "context",
            "elements": [
                {"type": "mrkdwn", "text": f"Time window: Last 5 minutes"},
            ]
        },
    ]
    
    return blocks


def post_to_slack(blocks, text=None):
    """Post message to Slack webhook."""
    payload = {"blocks": blocks}
    if text:
        payload["text"] = text
    if SLACK_DEFAULT_CHANNEL:
        payload["channel"] = SLACK_DEFAULT_CHANNEL
    
    try:
        response = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"Failed to post to Slack: {e}")
        return False


class GrafanaWebhookHandler(BaseHTTPRequestHandler):
    """Handle Grafana webhook alerts."""
    
    def log_message(self, format, *args):
        """Log to stdout."""
        print(f"[{datetime.now().isoformat()}] {format % args}")
    
    def do_POST(self):
        """Handle POST request."""
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        timestamp = self.headers.get('X-Slack-Request-Timestamp', '')
        signature = self.headers.get('X-Slack-Signature', '')
        
        if not verify_signature(body, timestamp, signature):
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return
        
        try:
            data = json.loads(body)
        except json.JSONDecodeError as e:
            self.send_response(400)
            self.end_headers()
            self.wfile.write(f"Invalid JSON: {e}".encode())
            return
        
        alerts = data.get("alerts", [])
        if not alerts:
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"No alerts")
            return
        
        category_alerts = {}
        
        for alert in alerts:
            category_info = categorize_alert(alert)
            key = (category_info['app'], category_info['severity'])
            
            if key not in category_alerts:
                category_alerts[key] = {
                    "category_info": category_info,
                    "alerts": [],
                    "by_app": {},
                }
            
            category_alerts[key]["alerts"].append(alert)
            
            app = category_info['app']
            category_alerts[key]["by_app"][app] = category_alerts[key]["by_app"].get(app, 0) + 1
        
        posted = 0
        for key, data in category_alerts.items():
            category_info = data["category_info"]
            alerts_list = data["alerts"]
            
            if len(alerts_list) > 1:
                summary_blocks = format_summary_block({
                    "total": len(alerts_list),
                    "by_app": data["by_app"],
                }, category_info)
                post_to_slack(summary_blocks)
            else:
                alert = alerts_list[0]
                alert_blocks = format_alert_block(alert, category_info)
                post_to_slack(alert_blocks)
            
            posted += 1
        
        self.send_response(200)
        self.end_headers()
        self.wfile.write(f"Processed {posted} alerts".encode())


def main():
    """Start the server."""
    if not SLACK_WEBHOOK_URL:
        print("ERROR: SLACK_WEBHOOK_URL environment variable is required")
        print("Set it to your Slack webhook URL")
        return
    
    server = HTTPServer(("0.0.0.0", PORT), GrafanaWebhookHandler)
    print(f"[{datetime.now().isoformat()}] Grafana Slack Proxy starting on port {PORT}")
    print(f"[{datetime.now().isoformat()}] Target channel: {SLACK_DEFAULT_CHANNEL}")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"[{datetime.now().isoformat()}] Shutting down...")
        server.shutdown()


if __name__ == "__main__":
    main()
