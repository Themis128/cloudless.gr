"""
Unit tests for main._render_alertmanager_message().

These pin the exact Slack-section format we ship — if the message body changes,
this test fails first (before a noisy Slack channel does).

Run from infrastructure/pi-alert-api/:
    python3 -m unittest tests/test_render_alertmanager_message.py

Or from anywhere:
    python3 -m unittest discover infrastructure/pi-alert-api/tests
"""

import os
import sys
import unittest
from unittest import mock

# main.py imports several runtime modules (httpx, fastapi, etc.) we don't need
# for testing a pure function. Stub them out before import so the test can run
# in any clean Python environment without installing the full requirements.txt.
for stub in (
    "httpx",
    "fastapi",
    "fastapi.middleware",
    "fastapi.middleware.cors",
    "pydantic",
    "database",
    "slack_notify",
    "flap_guard",
    "tls_check",
    "healthchecks_ping",
    "mqtt_publish",
    "esp32_command_routes",
):
    sys.modules.setdefault(stub, mock.MagicMock())

# Make sure we import the repo copy of main.py, not anything on the system path.
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)

# fastapi.FastAPI() needs to behave like a usable object — give the mock a no-op
# add_middleware so the top-of-module `app.add_middleware(...)` doesn't blow up.
sys.modules["fastapi"].FastAPI = lambda **kw: mock.MagicMock()  # type: ignore[attr-defined]

# Now we can import the function under test.
from main import _PRIMARY_LABELS, _render_alertmanager_message  # noqa: E402


class RenderAlertmanagerMessageTest(unittest.TestCase):
    """One test per shape we promise to render."""

    def _render(self, labels=None, annotations=None, am_alert=None):
        return _render_alertmanager_message(
            labels=labels or {},
            annotations=annotations or {},
            am_alert=am_alert or {},
        )

    # ── happy path ────────────────────────────────────────────────────────
    def test_renders_summary_then_description(self):
        out = self._render(
            annotations={
                "summary": "omv (192.168.1.128) unreachable",
                "description": "Node down.\nCheck power.",
            },
        )
        self.assertIn("omv (192.168.1.128) unreachable", out)
        self.assertIn("Node down.\nCheck power.", out)
        # summary comes before description
        self.assertLess(out.index("unreachable"), out.index("Check power"))

    def test_omits_description_when_identical_to_summary(self):
        same = "Same line."
        out = self._render(annotations={"summary": same, "description": same})
        self.assertEqual(out.count(same), 1)

    # ── fact lines ────────────────────────────────────────────────────────
    def test_value_field_rendered_when_present(self):
        out = self._render(
            annotations={"summary": "x"},
            am_alert={"value": "7"},
        )
        self.assertIn("*Value:* `7`", out)

    def test_value_omitted_when_none_or_empty(self):
        out = self._render(annotations={"summary": "x"}, am_alert={"value": ""})
        self.assertNotIn("*Value:*", out)
        out = self._render(annotations={"summary": "x"}, am_alert={"value": None})
        self.assertNotIn("*Value:*", out)

    def test_instance_field_rendered(self):
        out = self._render(
            labels={"instance": "192.168.1.130:9100"},
            annotations={"summary": "x"},
        )
        self.assertIn("*Instance:* `192.168.1.130:9100`", out)

    def test_target_and_probe_rendered_together(self):
        out = self._render(
            labels={"target": "cloudless.gr", "probe": "esp32-https"},
            annotations={"summary": "x"},
        )
        self.assertIn("*Target / Probe:* `cloudless.gr` / `esp32-https`", out)

    def test_target_only_renders_with_placeholder(self):
        out = self._render(
            labels={"target": "omv"},
            annotations={"summary": "x"},
        )
        self.assertIn("*Target / Probe:* `omv` / `-`", out)

    def test_pod_field_rendered(self):
        out = self._render(
            labels={"pod": "alert-api-abc-xyz"},
            annotations={"summary": "x"},
        )
        self.assertIn("*Pod:* `alert-api-abc-xyz`", out)

    # ── extra labels footer ───────────────────────────────────────────────
    def test_extra_labels_footer_appears_for_unknown_keys(self):
        out = self._render(
            labels={
                "alertname": "X",  # primary — should NOT appear in footer
                "severity": "warning",  # primary
                "instance": "host:9100",  # primary
                "namespace": "monitoring",  # primary
                "node": "omv",  # primary
                "job": "node-exporter",  # primary
                "pod": "node-exporter-xx",  # primary
                "component": "etcd",  # extra
                "cluster": "homelab",  # extra
            },
            annotations={"summary": "x"},
        )
        self.assertIn("_Other labels:_", out)
        self.assertIn("`cluster=homelab`", out)
        self.assertIn("`component=etcd`", out)
        # Primary labels MUST NOT leak into the footer
        self.assertNotIn("`alertname=", out)
        self.assertNotIn("`severity=", out)
        self.assertNotIn("`pod=", out.split("_Other labels:_", 1)[1])

    def test_no_extra_labels_footer_when_only_primary(self):
        out = self._render(
            labels={"alertname": "X", "severity": "warning", "instance": "i"},
            annotations={"summary": "x"},
        )
        self.assertNotIn("_Other labels:_", out)

    def test_primary_labels_set_is_stable(self):
        # If someone changes this constant, the test catches it — primary set
        # drives the "Other labels:" footer logic.
        self.assertEqual(
            _PRIMARY_LABELS,
            {"alertname", "severity", "namespace", "node", "instance", "job", "pod"},
        )

    # ── references (runbook, generator URL) ───────────────────────────────
    def test_runbook_rendered_as_slack_link(self):
        out = self._render(
            annotations={"summary": "x", "runbook_url": "https://wiki/runbook"},
        )
        self.assertIn("<https://wiki/runbook|open>", out)

    def test_generator_url_rendered_as_slack_link(self):
        out = self._render(
            annotations={"summary": "x"},
            am_alert={"generatorURL": "http://prom/graph"},
        )
        self.assertIn("<http://prom/graph|Prometheus query>", out)

    def test_both_refs_appear_on_their_own_lines(self):
        out = self._render(
            annotations={"summary": "x", "runbook_url": "https://r"},
            am_alert={"generatorURL": "https://g"},
        )
        runbook_line = "📖 *Runbook:* <https://r|open>"
        source_line = "📊 *Source:* <https://g|Prometheus query>"
        self.assertIn(runbook_line, out)
        self.assertIn(source_line, out)

    # ── degenerate inputs ─────────────────────────────────────────────────
    def test_empty_input_falls_back_to_named_message(self):
        out = self._render(labels={"alertname": "MyAlert"})
        self.assertEqual(out, "MyAlert fired (no annotations).")

    def test_completely_empty_input(self):
        out = self._render()
        # Unknown alertname → "ALERT fired (no annotations)."
        self.assertIn("fired (no annotations)", out)

    def test_strips_surrounding_whitespace_from_annotations(self):
        out = self._render(
            annotations={"summary": "  spaced  \n", "description": "\n  body  \n"},
        )
        self.assertTrue(out.startswith("spaced"))
        self.assertIn("body", out)
        self.assertNotIn("  spaced", out)

    # ── ordering invariants ───────────────────────────────────────────────
    def test_section_order_is_stable(self):
        out = self._render(
            labels={"instance": "i", "target": "t", "probe": "p", "pod": "po"},
            annotations={
                "summary": "S",
                "description": "D",
                "runbook_url": "https://r",
            },
            am_alert={"value": "42", "generatorURL": "https://g"},
        )

        # Order: summary → description → facts → other-labels → refs
        def idx(needle):
            return out.index(needle)

        self.assertLess(idx("S"), idx("D"))
        self.assertLess(idx("D"), idx("*Value:*"))
        self.assertLess(idx("*Value:*"), idx("📖 *Runbook:*"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
