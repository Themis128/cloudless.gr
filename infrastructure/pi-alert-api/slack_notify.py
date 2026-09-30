"""
slack_notify.py - Alert API v2.2
Sends structured Slack Block Kit messages for ESP32 sensor alerts.

v2.2 changes vs v2.1:
- Severity emoji back in the header (shortcode form, emoji:true)
- Context block with alert ID + dedupe count for at-a-glance scanning
v2.1 changes vs v2.0:
- Single mrkdwn section (replaces 2-column `fields` that mash on copy/mobile)
- Slack <!date> token auto-localizes the timestamp for each viewer
- Status line collapsed when status == severity
"""

import logging
import os
from datetime import UTC, datetime

import httpx

logger = logging.getLogger(__name__)

SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL_ID = os.environ.get("SLACK_CHANNEL_ID", "C09AF5W3X16")
SLACK_TIMEOUT = 10
SLACK_API_POST = "https://slack.com/api/chat.postMessage"


def _severity_emoji(severity: str) -> str:
    return {
        "critical": ":red_circle:",
        "high": ":large_orange_circle:",
        "warning": ":large_yellow_circle:",
        "medium": ":large_yellow_circle:",
        "low": ":large_blue_circle:",
        "info": ":large_green_circle:",
        "debug": ":white_circle:",
    }.get(severity.lower(), ":white_circle:")


def _status_emoji(status: str) -> str:
    return {
        "FIRING": ":rotating_light:",
        "ONGOING": ":hourglass_flowing_sand:",
        "RESOLVED": ":white_check_mark:",
        "INFO": ":information_source:",
    }.get(status.upper(), ":grey_question:")


def _proposed_solution(code: str, severity: str) -> str | None:
    solutions = {
        "HIGH_TEMP": "Check cooling / airflow. Reduce CPU load if thermal.",
        "HIGH_CPU": "Inspect running processes (`top`). Restart if runaway.",
        "HIGH_MEM": "Check for memory leaks. Restart offending service.",
        "DISK_FULL": "Run `df -h`, clear logs or old Docker images.",
        "NET_DOWN": "Check interface with `ip link`. Restart networking.",
        "SERVICE_DOWN": "Restart the service via systemd or kubectl rollout.",
        "PING_FAIL": "Verify network path. Check firewall rules.",
        "HIGH_LOAD": "Reduce concurrent workloads. Check cron jobs.",
        "ESP32_STARTED": "ESP32 rebooted. If repeating, check power supply / watchdog.",
        "ESP32_ROOM_HIGH_TEMP": "Server-closet hotter than expected. Open the cabinet, check airflow.",
        "ESP32_WIFI_DEGRADED": "ESP32 WiFi signal weak. Move closer to AP or check 2.4GHz channel congestion.",
        "ESP32_NTP_DRIFT": "ESP32 RTC drifted from NTP. Check internet/NTP reachability.",
        "ESP32_REBOOT_LOOP": "ESP32 keeps rebooting. Inspect power, WDT, or extra_checks crashes.",
        "WAN_IP_CHANGED": "Public IP changed. Verify Cloudflare tunnel + DNS health.",
        "WIFI_ROGUE_AP": "Unknown AP mimicking your SSID. Investigate physical area; could be Evil Twin.",
        "DEP_CLOUDFLARE_API": "api.cloudflare.com unreachable. Tunnel/cert ops will fail until restored.",
        "DEP_SLACK_HOOKS": "Slack webhook target unreachable — alert delivery degraded.",
        "DEP_GHCR": "GHCR unreachable. cloudless-manager image pulls will fail.",
        "DEP_ECR_US_EAST_1": "ECR unreachable. cloudless.gr/online image pulls will fail.",
        "DEP_AWS_STS": "AWS STS unreachable. IAM/OIDC auth flows will fail.",
        "DEP_GITHUB_API": "GitHub API unreachable. CI workflows will queue.",
        "DEP_GOOGLE_DNS": "8.8.8.8 unreachable. Probable upstream DNS / WAN issue.",
        "DEP_CLOUDFLARE_DNS": "1.1.1.1 unreachable. Probable upstream DNS / WAN issue.",
        "CERT_EXPIRING_SOON": "Cert expires within 14 days. Verify cert-manager / Cloudflare renewal flow.",
        "CERT_EXPIRING_CRITICAL": "Cert expires within 3 days. Force renewal NOW.",
        "CERT_EXPIRED": "TLS cert has EXPIRED. Site will show browser warnings. Force-renew immediately.",
        # ── ESP32 watchdog alerts (Alertmanager → webhook) ──────────────────
        "ESP32WATCHDOGDOWN": "Ping 192.168.1.201; if unreachable, check Wi-Fi + USB power. Board may need a power-cycle.",
        "OMVUNREACHABLEFROMESP32": "omv (192.168.1.128) is offline to the external probe. Check power, switch, then `ssh tbaltzakis@192.168.1.128`.",
        "OMVHAUNREACHABLEFROMESP32": "omv-ha (192.168.1.130) offline. HA failover capacity lost — restore before omv has any issue.",
        "BOTHNODESUNREACHABLEFROMESP32": "FULL outage. Verify rack power + switch first; CloudFront should already be serving Lambda origin.",
        "AWSAPPUNREACHABLEFROMESP32": "cloudless.gr down to the watchdog. Check CloudFront origin health, Lambda 5xx rate, TLS cert expiry.",
        "ESP32WIFIWEAK": "RSSI below -80 dBm. Move ESP32 closer to AP or switch 2.4 GHz channel.",
        "OMVPROBEFAILURESELEVATED": "omv intermittently failing probes. Check node_exporter, switch port, ESP32 Wi-Fi. Outage not yet confirmed.",
        "OMVHAPROBEFAILURESELEVATED": "omv-ha intermittently failing probes. Same checklist as omv version.",
        "AWSPROBEFAILURESELEVATED": "Intermittent HTTPS probe failures to cloudless.gr. Verify with `curl -w '%{http_code} %{time_total}s\\n' https://cloudless.gr/api/health` from another network.",
    }
    return solutions.get(code.upper())


def _slack_date(ts: datetime) -> str:
    epoch = int(ts.timestamp())
    fallback = ts.strftime("%Y-%m-%d %H:%M:%S UTC")
    return f"<!date^{epoch}^{{date_short_pretty}} at {{time}}|{fallback}>"


async def send_alert(data: dict) -> bool:
    """Deliver alert via Incoming Webhook (legacy) or chat.postMessage (preferred)."""
    if not SLACK_WEBHOOK_URL and not SLACK_BOT_TOKEN:
        logger.warning("Neither SLACK_WEBHOOK_URL nor SLACK_BOT_TOKEN set; skipping Slack")
        return False

    code = data.get("code", "UNKNOWN")
    host = data.get("host", "unknown")
    service = data.get("service", "") or "-"
    severity = data.get("severity", "info")
    message = data.get("message", "")
    status = data.get("status", "FIRING")
    count = data.get("count", 1)
    alert_id = data.get("id")

    sev_emoji = _severity_emoji(severity)
    sta_emoji = _status_emoji(status)
    solution = _proposed_solution(code, severity)
    when = _slack_date(datetime.now(UTC))

    show_status = status.upper() != severity.upper()

    lines = [
        f"*Host:* `{host}`  -  *Service:* `{service}`",
        f"*Severity:* {sev_emoji} {severity.upper()}"
        + (f"   -   *Status:* {sta_emoji} {status.upper()}" if show_status else ""),
        f"*Code:* `{code}`   -   *Count:* {count}",
        f"*Time:* {when}",
        "",
        f"*Message:*\n{message}",
    ]
    if solution and status.upper() != "RESOLVED":
        lines += ["", f":bulb: *Proposed solution:* {solution}"]

    # Context block: alert id + dedupe count, small grey text below the section.
    ctx_parts = []
    if alert_id is not None:
        ctx_parts.append(f"Alert #{alert_id}")
    ctx_parts.append(f"dedupe count: {count}")
    ctx_parts.append(f"severity: {severity.lower()}")
    ctx_parts.append(f"status: {status.lower()}")
    context_text = "  •  ".join(ctx_parts)

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{sev_emoji} {severity.upper()} - {code}",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "text": {"type": "mrkdwn", "text": "\n".join(lines)},
        },
        {
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": context_text}],
        },
        {"type": "divider"},
    ]

    fallback = f"{sev_emoji} {severity.upper()} [{status}] {code} on {host}"
    payload = {"text": fallback, "blocks": blocks}

    try:
        async with httpx.AsyncClient(timeout=SLACK_TIMEOUT) as client:
            if SLACK_WEBHOOK_URL:
                resp = await client.post(SLACK_WEBHOOK_URL, json=payload)
                ok = resp.status_code == 200
            else:
                body = {**payload, "channel": SLACK_CHANNEL_ID}
                resp = await client.post(
                    SLACK_API_POST,
                    headers={"Authorization": f"Bearer {SLACK_BOT_TOKEN}"},
                    json=body,
                )
                ok = resp.status_code == 200 and bool((resp.json() or {}).get("ok"))
            if ok:
                logger.info("Slack alert sent: %s/%s [%s]", host, code, status)
                return True
            logger.error("Slack delivery %s: %s", resp.status_code, resp.text)
            return False
    except httpx.TimeoutException:
        logger.error("Slack delivery timed out after %ds", SLACK_TIMEOUT)
        return False
    except Exception as exc:
        logger.error("Slack delivery exception: %s", exc)
        return False
