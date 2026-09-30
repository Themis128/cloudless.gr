#!/usr/bin/env python3
"""R13 EspoCRM MariaDB hourly xbstream backup check — validates
the backup CronJob manifest.

Usage: python3 scripts/check_r13_espocrm_mariadb_backup.py \
    [manifest]
(default k8s/espocrm/backup/mariadb-xbstream-backup.yaml)"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _check import Check

MANIFEST = sys.argv[1] if len(sys.argv) > 1 else \
    "k8s/espocrm/backup/mariadb-xbstream-backup.yaml"

c = Check()
print("== R13 EspoCRM MariaDB hourly xbstream backup check ==")
print(f"Manifest: {MANIFEST}\n")

m = Path(MANIFEST)
c.expect(m.is_file(), "manifest exists",
         f"manifest missing: {MANIFEST}")

cases = [
    ("kind: CronJob", "is a Kubernetes CronJob",
     "missing kind: CronJob", "fail"),
    ("namespace: espocrm", "targets espocrm namespace",
     "missing namespace: espocrm", "fail"),
    ("name: mariadb-xbstream-backup",
     "uses canonical CronJob name",
     "CronJob name differs from mariadb-xbstream-backup",
     "warn"),
    ('schedule: "0 * * * *"', "uses hourly schedule",
     'schedule is not hourly: expected schedule: "0 * * * *"',
     "fail"),
    ("concurrencyPolicy: Forbid",
     "prevents overlapping backups",
     "missing concurrencyPolicy: Forbid", "warn"),
    ("failedJobsHistoryLimit: 7",
     "keeps failed job history",
     "failedJobsHistoryLimit not set to 7", "warn"),
    ("successfulJobsHistoryLimit: 3",
     "keeps successful job history",
     "successfulJobsHistoryLimit not set to 3", "warn"),
    ("xbstream", "uses xbstream streaming format",
     "missing xbstream", "fail"),
    ("aws s3 cp", "uploads stream to S3",
     "missing aws s3 cp upload", "fail"),
    ("aws s3api head-object",
     "verifies uploaded S3 object",
     "missing S3 head-object verification", "warn"),
    ("cloudless-analytics-data",
     "uses cloudless analytics S3 bucket",
     "missing cloudless-analytics-data bucket", "fail"),
    ("pvc-backups/espocrm/xbstream/hourly/",
     "uses hourly EspoCRM xbstream S3 prefix",
     "missing hourly S3 prefix", "fail"),
    ("espocrm-secrets", "uses espocrm-secrets",
     "missing espocrm-secrets reference", "fail"),
    ("mariadb-root-password",
     "uses root DB password secret key",
     "missing mariadb-root-password secret key", "fail"),
    ("pvc-backup-aws",
     "uses existing pvc-backup-aws credentials secret",
     "missing pvc-backup-aws secret reference", "fail"),
    ("backup too small",
     "fails on suspiciously small backup",
     "missing small-backup failure guard", "warn"),
]

for text, good, bad, kind in cases:
    c.expect(c.contains(m, text), good, bad, kind=kind)

c.expect(c.contains_re(m, r"backoffLimit: [01]"),
         "has low retry/backoff behavior",
         "backoffLimit should preferably be 0 or 1",
         kind="warn")
c.expect(c.contains_re(
    m, r"restartPolicy: Never|restartPolicy: OnFailure"),
    "has explicit restart policy",
    "missing restartPolicy", kind="warn")
c.expect(c.contains_re(m, r"mariadb-backup|mariabackup"),
         "uses MariaDB physical backup tooling",
         "missing mariadb-backup/mariabackup")

c.finish()
