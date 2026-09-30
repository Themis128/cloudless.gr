"""
Unit tests for slack_notify.send_alert() — the Slack Block Kit payload builder.

Asserts:
  - Header, section, context, and divider blocks present in correct order
  - Severity emoji + status emoji mapping
  - Proposed-solution lookup hits the new ESP32 watchdog codes
  - Webhook URL absent → returns False gracefully (no exception)

Run:
    python3 -m unittest tests/test_slack_notify.py
"""

import asyncio
import os
import sys
import unittest
from unittest import mock

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

# Stub httpx so we never touch the network.
sys.modules["httpx"] = mock.MagicMock()

# IMPORTANT: another test file in this directory stubs `slack_notify` with a
# MagicMock for its own isolation. If that test ran first, the stub is now
# cached in sys.modules and our `import slack_notify` below would just return
# the mock. Force a fresh real import.
sys.modules.pop("slack_notify", None)
import importlib  # noqa: E402

import slack_notify  # noqa: E402

slack_notify = importlib.reload(slack_notify)


def _run(coro):
    return (
        asyncio.get_event_loop().run_until_complete(coro)
        if sys.version_info < (3, 10)
        else asyncio.run(coro)
    )


class SeverityEmojiTest(unittest.TestCase):
    def test_known_severities(self):
        self.assertEqual(slack_notify._severity_emoji("critical"), ":red_circle:")
        self.assertEqual(slack_notify._severity_emoji("warning"), ":large_yellow_circle:")
        self.assertEqual(slack_notify._severity_emoji("info"), ":large_green_circle:")
        self.assertEqual(slack_notify._severity_emoji("debug"), ":white_circle:")

    def test_unknown_severity_falls_back_to_white(self):
        self.assertEqual(slack_notify._severity_emoji("weird"), ":white_circle:")

    def test_case_insensitive(self):
        self.assertEqual(slack_notify._severity_emoji("CRITICAL"), ":red_circle:")


class StatusEmojiTest(unittest.TestCase):
    def test_known_statuses(self):
        self.assertEqual(slack_notify._status_emoji("FIRING"), ":rotating_light:")
        self.assertEqual(slack_notify._status_emoji("RESOLVED"), ":white_check_mark:")

    def test_unknown_status(self):
        self.assertEqual(slack_notify._status_emoji("???"), ":grey_question:")


class ProposedSolutionTest(unittest.TestCase):
    """Every ESP32 watchdog alert code MUST have a proposed-solution mapping."""

    def test_all_esp32_watchdog_codes_have_solutions(self):
        required_codes = [
            "ESP32WATCHDOGDOWN",
            "OMVUNREACHABLEFROMESP32",
            "OMVHAUNREACHABLEFROMESP32",
            "BOTHNODESUNREACHABLEFROMESP32",
            "AWSAPPUNREACHABLEFROMESP32",
            "ESP32WIFIWEAK",
            "OMVPROBEFAILURESELEVATED",
            "OMVHAPROBEFAILURESELEVATED",
            "AWSPROBEFAILURESELEVATED",
        ]
        for code in required_codes:
            with self.subTest(code=code):
                sol = slack_notify._proposed_solution(code, "warning")
                self.assertIsNotNone(sol, f"{code} has no proposed_solution")
                self.assertGreater(len(sol), 20, f"{code} solution too terse")

    def test_unknown_code_returns_none(self):
        self.assertIsNone(slack_notify._proposed_solution("NEVER_HEARD_OF_IT", "critical"))

    def test_case_insensitive_lookup(self):
        a = slack_notify._proposed_solution("HIGH_TEMP", "warning")
        b = slack_notify._proposed_solution("high_temp", "warning")
        self.assertEqual(a, b)


class SlackDateTokenTest(unittest.TestCase):
    def test_slack_date_token_format(self):
        import datetime

        ts = datetime.datetime(2026, 5, 29, 12, 0, 0, tzinfo=datetime.UTC)
        out = slack_notify._slack_date(ts)
        # <!date^EPOCH^{date_short_pretty} at {time}|fallback>
        self.assertTrue(out.startswith("<!date^"))
        self.assertIn("|2026-05-29 12:00:00 UTC>", out)


class SendAlertTest(unittest.TestCase):
    def test_returns_false_without_webhook_or_bot(self):
        with (
            mock.patch.object(slack_notify, "SLACK_WEBHOOK_URL", ""),
            mock.patch.object(slack_notify, "SLACK_BOT_TOKEN", ""),
        ):
            result = _run(
                slack_notify.send_alert(
                    {
                        "code": "TEST",
                        "host": "h",
                        "service": "s",
                        "severity": "warning",
                        "message": "m",
                        "status": "FIRING",
                    }
                )
            )
        self.assertFalse(result)

    def test_payload_shape_when_webhook_set(self):
        captured = {}

        class FakeResp:
            status_code = 200
            text = "ok"

            def json(self):
                return {"ok": True}

        class FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, json=None, headers=None):
                captured["url"] = url
                captured["json"] = json
                return FakeResp()

        with (
            mock.patch.object(slack_notify, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/test"),
            mock.patch.object(slack_notify, "SLACK_BOT_TOKEN", ""),
            mock.patch.object(slack_notify.httpx, "AsyncClient", FakeClient),
        ):
            result = _run(
                slack_notify.send_alert(
                    {
                        "id": 999,
                        "code": "AWSAPPUNREACHABLEFROMESP32",
                        "host": "cloudless-watchdog",
                        "service": "cloudless.gr",
                        "severity": "critical",
                        "message": "Real outage detected.",
                        "status": "FIRING",
                        "count": 1,
                    }
                )
            )

        self.assertTrue(result)
        self.assertEqual(captured["url"], "https://hooks.slack.com/test")
        payload = captured["json"]

        # Block Kit invariants
        self.assertIn("text", payload)  # fallback text for notifications
        self.assertIn("blocks", payload)
        types = [b["type"] for b in payload["blocks"]]
        self.assertEqual(types, ["header", "section", "context", "divider"])

        # Header includes severity emoji + code
        header_text = payload["blocks"][0]["text"]["text"]
        self.assertIn("AWSAPPUNREACHABLEFROMESP32", header_text)
        self.assertIn(":red_circle:", header_text)

        # Section body includes message + proposed solution + time
        section_text = payload["blocks"][1]["text"]["text"]
        self.assertIn("Real outage detected.", section_text)
        self.assertIn(":bulb: *Proposed solution:*", section_text)
        self.assertIn("CloudFront origin health", section_text)  # from solution mapping

        # Context includes alert ID + dedupe count + severity
        ctx_text = payload["blocks"][2]["elements"][0]["text"]
        self.assertIn("Alert #999", ctx_text)
        self.assertIn("severity: critical", ctx_text)

    def test_bot_token_posts_chat_api(self):
        captured = {}

        class FakeResp:
            status_code = 200
            text = '{"ok":true}'

            def json(self):
                return {"ok": True}

        class FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, json=None, headers=None):
                captured["url"] = url
                captured["json"] = json
                captured["headers"] = headers
                return FakeResp()

        with (
            mock.patch.object(slack_notify, "SLACK_WEBHOOK_URL", ""),
            mock.patch.object(slack_notify, "SLACK_BOT_TOKEN", "xoxb-test"),
            mock.patch.object(slack_notify, "SLACK_CHANNEL_ID", "C09AF5W3X16"),
            mock.patch.object(slack_notify.httpx, "AsyncClient", FakeClient),
        ):
            result = _run(
                slack_notify.send_alert(
                    {
                        "code": "TEST",
                        "host": "h",
                        "service": "s",
                        "severity": "info",
                        "message": "m",
                        "status": "FIRING",
                    }
                )
            )
        self.assertTrue(result)
        self.assertEqual(captured["url"], slack_notify.SLACK_API_POST)
        self.assertEqual(captured["json"]["channel"], "C09AF5W3X16")
        self.assertIn("Bearer xoxb-test", captured["headers"]["Authorization"])

    def test_resolved_status_suppresses_proposed_solution(self):
        captured = {}

        class FakeResp:
            status_code = 200
            text = "ok"

            def json(self):
                return {"ok": True}

        class FakeClient:
            def __init__(self, *a, **kw):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, json=None, headers=None):
                captured["json"] = json
                return FakeResp()

        with (
            mock.patch.object(slack_notify, "SLACK_WEBHOOK_URL", "https://hooks.slack.com/test"),
            mock.patch.object(slack_notify.httpx, "AsyncClient", FakeClient),
        ):
            _run(
                slack_notify.send_alert(
                    {
                        "code": "AWSAPPUNREACHABLEFROMESP32",
                        "host": "h",
                        "service": "s",
                        "severity": "critical",
                        "message": "ok now",
                        "status": "RESOLVED",
                    }
                )
            )
        section_text = captured["json"]["blocks"][1]["text"]["text"]
        self.assertNotIn(":bulb: *Proposed solution:*", section_text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
