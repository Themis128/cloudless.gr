"""Unit tests for infrastructure/omv/install-logrotate-writecache-fix.py.

The installer refuses to import as non-root (module-level geteuid check), so
the tests patch os.geteuid before import and drive main() against tmp_path
fixtures with a stubbed logrotate -d. Nothing touches the host.

    python3 -m unittest discover -s infrastructure/omv/tests
"""

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).resolve().parents[1] / "install-logrotate-writecache-fix.py"

BROKEN_BODY = """\
/var/log/daemon.log /var/log/syslog /var/log/user.log /var/log/kern.log /var/log/ufw.log /var/log/pi-alert-remediation.log {
\tmaxsize 40M
\trotate 2
\tcompress
\tmissingok
\tnotifempty
\tsharedscripts
\tpostrotate
\t\t/usr/lib/rsyslog/rsyslog-rotate
\tendscript
}
"""


def _load_module():
    with mock.patch("os.geteuid", return_value=0):
        spec = importlib.util.spec_from_file_location("logrotate_fix_test", SCRIPT)
        mod = importlib.util.module_from_spec(spec)
        sys.modules["logrotate_fix_test"] = mod
        spec.loader.exec_module(mod)
    return mod


class TestLogrotateWritecacheFix(unittest.TestCase):
    def setUp(self):
        self.mod = _load_module()
        argv_p = mock.patch.object(sys, "argv", ["installer"])
        argv_p.start()
        self.addCleanup(argv_p.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.target = Path(self.tmp.name) / "omv-writecache-logs"
        self.backup = Path(self.tmp.name) / "backup"
        patcher = mock.patch.multiple(
            self.mod,
            TARGET=self.target,
            BACKUP_DIR=Path(self.tmp.name),
            BACKUP_TS="TEST",
            APPLY=False,
            create=True,
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def _logrotate_clean(self):
        """Stub logrotate -d to report no duplicate errors."""

        def fake_run(cmd, **kwargs):
            return mock.Mock(returncode=0, stdout="considering log /x", stderr="")

        return mock.patch.object(self.mod.subprocess, "run", side_effect=fake_run)

    def test_missing_file_is_noop(self):
        with self._logrotate_clean():
            self.assertEqual(self.mod.main(), 0)

    def test_already_fixed_is_noop(self):
        self.target.write_text(self.mod.FIXED_BODY)
        with self._logrotate_clean():
            self.assertEqual(self.mod.main(), 0)
        self.assertEqual(self.target.read_text(), self.mod.FIXED_BODY)

    def test_preview_does_not_touch_file(self):
        self.target.write_text(BROKEN_BODY)
        with self._logrotate_clean():
            self.assertEqual(self.mod.main(), 0)
        self.assertIn("/var/log/syslog", self.target.read_text())  # unchanged

    def test_apply_rewrites_and_backs_up(self):
        self.target.write_text(BROKEN_BODY)
        argv_p = mock.patch.object(sys, "argv", ["installer", "--apply"])
        argv_p.start()
        self.addCleanup(argv_p.stop)
        with self._logrotate_clean():
            self.assertEqual(self.mod.main(), 0)
        fixed = self.target.read_text()
        self.assertIn("/var/log/pi-alert-remediation.log", fixed)
        self.assertNotIn("/var/log/syslog", fixed)
        self.assertNotIn("/var/log/ufw.log", fixed)
        backups = list(self.backup.parent.glob("omv-writecache-logs.bak-*"))
        self.assertEqual(len(backups), 1)
        self.assertIn("/var/log/syslog", backups[0].read_text())

    def test_apply_fails_when_logrotate_still_reports_duplicates(self):
        self.target.write_text(BROKEN_BODY)
        argv_p = mock.patch.object(sys, "argv", ["installer", "--apply"])
        argv_p.start()
        self.addCleanup(argv_p.stop)
        with mock.patch.object(
            self.mod.subprocess,
            "run",
            new=lambda *a, **k: mock.Mock(
                returncode=0,
                stdout="error: rsyslog:1 duplicate log entry for /var/log/syslog",
                stderr="",
            ),
        ):
            self.assertEqual(self.mod.main(), 1)


if __name__ == "__main__":
    unittest.main()
