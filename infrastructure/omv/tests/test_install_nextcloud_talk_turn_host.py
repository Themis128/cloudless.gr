"""Unit tests for infrastructure/omv/install-nextcloud-talk-turn-host.py.

The installer refuses to import as non-root (module-level geteuid check), so
the tests patch os.geteuid before import. Compose files, docker/occ calls and
the TURN TCP probe are all stubbed — nothing touches the host.

    python3 -m unittest discover -s infrastructure/omv/tests
"""

import importlib.util
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "install-nextcloud-talk-turn-host.py"

COMPOSE_BODY = """\
  talk-hpb:
    image: nextcloud/aio-talk:latest
    environment:
      - NC_DOMAIN=cloud.cloudless.gr
      - TALK_HOST=signal.cloudless.gr
      - TALK_PORT=3478
    ports:
      - "3478:3478/udp"
"""


def _load_module():
    with mock.patch("os.geteuid", return_value=0):
        spec = importlib.util.spec_from_file_location("talk_host_test", SCRIPT)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["talk_host_test"] = mod
        spec.loader.exec_module(mod)
    return mod


class TestNextcloudTalkTurnHost(unittest.TestCase):
    def setUp(self):
        self.mod = _load_module()
        argv_p = mock.patch.object(sys, "argv", ["installer"])
        argv_p.start()
        self.addCleanup(argv_p.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.compose = Path(self.tmp.name) / "workspace.yml"
        self.compose.write_text(COMPOSE_BODY)

    def _patch_common(self, *, apply=False, tcp_ok=True, turn_list=""):
        argv = ["installer", "--apply"] if apply else ["installer"]
        argv_p = mock.patch.object(sys, "argv", argv)
        argv_p.start()
        self.addCleanup(argv_p.stop)
        bdir_p = mock.patch.object(self.mod, "BACKUP_DIR", Path(self.tmp.name))
        bdir_p.start()
        self.addCleanup(bdir_p.stop)
        # compose file discovery → fixture
        gp = mock.patch.object(self.mod.glob, "glob", return_value=[str(self.compose)])
        gp.start()
        self.addCleanup(gp.stop)
        # TURN TCP probe
        cp = (
            mock.patch.object(self.mod.socket, "create_connection", mock.MagicMock())
            if tcp_ok
            else mock.patch.object(
                self.mod.socket,
                "create_connection",
                mock.MagicMock(side_effect=OSError("refused")),
            )
        )
        cp.start()
        self.addCleanup(cp.stop)
        # docker compose / occ / docker exec
        calls: list[list] = []

        def fake_run(cmd, **kwargs):
            calls.append(list(cmd))
            if any("TURN_SECRET" in str(c) for c in cmd):
                return mock.Mock(returncode=0, stdout="test-secret\n", stderr=b"")
            out = turn_list if "talk:turn:list" in cmd else ""
            return mock.Mock(returncode=0, stdout=out, stderr=b"")

        rp = mock.patch.object(self.mod.subprocess, "run", side_effect=fake_run)
        rp.start()
        self.addCleanup(rp.stop)
        return calls

    def test_missing_compose_file_fails(self):
        with mock.patch.object(self.mod.glob, "glob", return_value=[]):
            self.assertEqual(self.mod.main(), 1)

    def test_already_good_host_is_noop(self):
        self.compose.write_text(
            COMPOSE_BODY.replace("TALK_HOST=signal.cloudless.gr", "TALK_HOST=192.168.1.200")
        )
        calls = self._patch_common(turn_list="schemes: turn")
        self.assertEqual(self.mod.main(), 0)
        self.assertNotIn("compose", [c[0] for c in calls])

    def test_preview_does_not_touch_file(self):
        self._patch_common(apply=False)
        self.assertEqual(self.mod.main(), 0)
        self.assertIn("TALK_HOST=signal.cloudless.gr", self.compose.read_text())

    def test_apply_rewrites_host_recreates_and_clears_stale_turn_entry(self):
        calls = self._patch_common(apply=True, turn_list="schemes: turn,turns")
        self.assertEqual(self.mod.main(), 0)
        text = self.compose.read_text()
        self.assertIn("TALK_HOST=192.168.1.200", text)
        self.assertNotIn("TALK_HOST=signal.cloudless.gr", text)
        flat = [c for call in calls for c in call]
        self.assertIn("talk-hpb", flat)  # compose up recreated the container
        self.assertIn("talk:turn:delete", flat)
        self.assertIn("talk:turn:add", flat)

    def test_add_failure_reverts_file_and_raises(self):
        """compose up failing reverts workspace.yml from the backup and propagates."""
        self._patch_common(apply=True)

        def failing_compose(cmd, **kwargs):
            if "compose" in cmd and kwargs.get("check"):
                raise subprocess.CalledProcessError(1, cmd)
            return mock.Mock(returncode=0, stdout="", stderr=b"")

        with mock.patch.object(self.mod.subprocess, "run", side_effect=failing_compose):
            with self.assertRaises(subprocess.CalledProcessError):
                self.mod.main()
        self.assertIn("TALK_HOST=signal.cloudless.gr", self.compose.read_text())
        self.assertNotIn("TALK_HOST=192.168.1.200", self.compose.read_text())


if __name__ == "__main__":
    unittest.main()
