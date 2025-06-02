import os
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

def send_slack_alert(message, channel=None):
    slack_token = os.getenv("SLACK_BOT_TOKEN")
    default_channel = os.getenv("SLACK_ALERT_CHANNEL", "#alerts")
    channel = channel or default_channel
    if not slack_token:
        raise RuntimeError("SLACK_BOT_TOKEN environment variable not set.")
    client = WebClient(token=slack_token)
    try:
        client.chat_postMessage(channel=channel, text=message)
    except SlackApiError as e:
        print(f"Slack API error: {e.response['error']}")

if __name__ == "__main__":
    import sys
    msg = sys.argv[1] if len(sys.argv) > 1 else "Test alert from Cloudless Platform"
    send_slack_alert(msg)
