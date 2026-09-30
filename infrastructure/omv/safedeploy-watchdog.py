#!/usr/bin/env python3
"""safedeploy-watchdog.py — continuous prod health monitor + auto-rollback.

Port of safedeploy-watchdog.sh.

Runs on omv (host, outside the k3s cluster) via a systemd timer every 2 min.
Polls the local cloudless-app NodePort. Uses "Notify-first" strategy:

  • unhealthy 3× in a row  (~6 min)   → send alerts (ntfy + Slack + email)
  • still unhealthy 8× total (~16 min)→ ALSO run rollback-style
                                         symlink flip + kubectl rollout restart,
                                         then send "rolled back" alert
  • recovers                          → send "recovered" alert; reset state

Safeguards to prevent rollback loops or premature action:
  • 60-min cooldown between auto-rollbacks
  • skip rollback if current release symlink is <15 min old
    (deploy-time verify already handled that window)
  • one "alert" notification per incident (no repeated pings)

Config: /etc/safedeploy-watchdog.env populated at install time from the
        cloudless-secrets k8s Secret. Values are NEVER printed by this script.

State: /var/lib/safedeploy-watchdog/{fail_count,last_rollback_ts,last_notify_ts,notified,incident_start}

Usage: python3 safedeploy-watchdog.py
"""

import json
import os
import subprocess
import time
import urllib.request
from datetime import UTC, datetime, timedelta
from pathlib import Path

# --- config ------------------------------------------------------------------
STATE_DIR = Path("/var/lib/safedeploy-watchdog")
CURRENT = Path("/home/tbaltzakis/cloudless-standalone")
RELEASES = Path("/home/tbaltzakis/cloudless-releases")
NS = "cloudless"
DEPLOY = "cloudless-app"
HEALTH_URL_LOCAL = os.environ.get("HEALTH_URL_LOCAL", "http://127.0.0.1:30300/api/health")
HEALTH_URL_LAN = os.environ.get("HEALTH_URL_LAN", "http://192.168.1.128:30300/api/health")
HEALTH_URL_PUBLIC = os.environ.get("HEALTH_URL_PUBLIC", "https://cloudless.gr/api/health")
NOTIFY_THRESHOLD = 3        # consecutive failures to send first alert
ROLLBACK_THRESHOLD = 8      # consecutive failures to auto-rollback
ROLLBACK_COOLDOWN = 3600    # min seconds between auto-rollbacks
MIN_RELEASE_AGE = 900       # skip rollback if symlink younger than this (seconds)

# Satellite probes: (name, url, expect, remediation)
#   expect      = "ok" (any 2xx/3xx — Cloudflare Access 302 counts as up)
#                 or an exact status like "200"
#   remediation = "none" (alert only) or ("k3s", ns, deploy) → rollout restart
#                 at ROLLBACK_THRESHOLD consecutive failures
WATCH_TARGETS = [
    ("pi-origin", "https://pi-origin.cloudless.gr/api/health", "200", None),
    ("social", "https://social.cloudless.gr/", "ok", None),
    ("postiz", "https://postiz.cloudless.gr/", "ok", ("postiz", "postiz")),
    ("espocrm", "https://espocrm.cloudless.gr/", "ok", ("espocrm", "espocrm")),
    ("n8n", "https://n8n.cloudless.gr/healthz", "200", ("n8n", "n8n")),
    ("grafana", "https://grafana.cloudless.gr/api/health", "200", ("monitoring", "kube-prom-grafana")),
    ("appflowy", "https://appflowy.cloudless.gr/api/health", "200", ("appflowy", "appflowy-cloud")),
    ("ntfy", "https://ntfy.cloudless.gr/", "ok", ("ntfy", "ntfy")),
    ("uptime-kuma", "https://kuma.cloudless.gr/", "ok", ("uptime-kuma", "uptime-kuma")),
    ("webmail", "https://webmail.cloudless.gr/", "ok", None),
    ("postiz-ai-proxy", "https://postiz-ai-proxy.baltzakis-themis.workers.dev/v1/models", "200", None),
]
WORKER_ERROR_THRESHOLD = 3    # per-script errors in the window below → alert
WORKER_ERROR_WINDOW_MIN = 30  # GraphQL lookback window
WORKER_CHECK_EVERY = 5        # run the GraphQL check every Nth tick (~10 min)
WORKER_ROLLBACK_SCRIPTS = ["postiz-ai-proxy"]
WORKER_ROLLBACK_AFTER = 2     # consecutive error checks before rollback
WORKER_ROLLBACK_MIN_AGE = 900  # skip rollback for deploys <15min old (verify window)
WORKER_ROLLBACK_MAX_AGE = 7200  # skip rollback for deploys >2h old (not deploy-correlated)
DISK_K3S_PCT = 85             # alert when the k3s SSD (sda1) exceeds this
DISK_DATA_PCT = 90            # alert when the data SSD (sdb1) exceeds this


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# --- credentials (from env file, never printed) ------------------------------
load_env(Path("/etc/safedeploy-watchdog.env"))
NTFY_BASE_URL = os.environ.get("NTFY_BASE_URL", "")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "")
NTFY_TOKEN = os.environ.get("NTFY_TOKEN", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL = os.environ.get("SLACK_CHANNEL", "#general")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "tbaltzakis@cloudless.gr")
CF_API_TOKEN = os.environ.get("CF_API_TOKEN", "")
CF_ACCOUNT_ID = os.environ.get("CF_ACCOUNT_ID", "")
HEALTHCHECK_PING_URL = os.environ.get("HEALTHCHECK_PING_URL", "")

# --- state helpers -----------------------------------------------------------
STATE_DIR.mkdir(parents=True, exist_ok=True)


def _get(key: str, default: str) -> str:
    try:
        v = (STATE_DIR / key).read_text().strip()
        return v if v else default
    except OSError:
        return default


def _set(key: str, val: str) -> None:
    (STATE_DIR / key).write_text(f"{val}\n")


def _now() -> int:
    return int(time.time())


def log(msg: str) -> None:
    subprocess.run(["logger", "-t", "safedeploy-watchdog", msg], check=False, capture_output=True)
    print(f"[{datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ')}] {msg}")


def run(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(list(args), capture_output=True, text=True, check=False)


def http_req(method: str, url: str, timeout: int = 10,
             headers: dict | None = None, body: bytes | None = None,
             follow: bool = False) -> tuple[str, bytes]:
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    try:
        opener = urllib.request.build_opener() if follow else urllib.request.build_opener(NoRedirect())
        with opener.open(req, timeout=timeout) as resp:
            return str(resp.status), resp.read()
    except urllib.error.HTTPError as e:
        return str(e.code), b""
    except Exception:
        return "000", b""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        return None


# --- notifications (best-effort; failures never block the watchdog) ---------
def notify_ntfy(title: str, msg: str, prio: str = "high") -> None:
    if not NTFY_BASE_URL or not NTFY_TOPIC:
        return
    headers = {"Title": title, "Priority": prio, "Tags": "warning"}
    if NTFY_TOKEN:
        headers["Authorization"] = f"Bearer {NTFY_TOKEN}"
    http_req("POST", f"{NTFY_BASE_URL.rstrip('/')}/{NTFY_TOPIC}", 10, headers, msg.encode())


def notify_slack(title: str, msg: str) -> None:
    if not SLACK_BOT_TOKEN:
        return
    payload = json.dumps({"channel": SLACK_CHANNEL, "text": f"{title}\n{msg}"}).encode()
    http_req("POST", "https://slack.com/api/chat.postMessage", 10,
             {"Authorization": f"Bearer {SLACK_BOT_TOKEN}",
              "Content-Type": "application/json; charset=utf-8"}, payload)


def notify_email(subject: str, body: str) -> None:
    if not RESEND_API_KEY:
        return
    payload = json.dumps({
        "from": "safedeploy-watchdog@cloudless.gr",
        "to": ALERT_EMAIL,
        "subject": subject,
        "text": body,
    }).encode()
    http_req("POST", "https://api.resend.com/emails", 10,
             {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
             payload)


def notify_all(title: str, body: str, prio: str = "high") -> None:
    notify_ntfy(title, body, prio)
    notify_slack(title, body)
    notify_email(title, body)


# --- health probe ------------------------------------------------------------
# Returns True healthy, False unhealthy. Also captures whether it's a 502
# (strong signal — origin unreachable) vs a health-endpoint issue.
def probe_health() -> bool:
    # Try local NodePort first (fastest, most direct)
    for url in (HEALTH_URL_LOCAL, HEALTH_URL_LAN):
        code, body = http_req("GET", url, 8)
        if code == "200" and b'"status"' in body:
            _set("last_http_code", code)
            return True
    # Fall back to public URL (catches tunnel/cloudflare-level breakage too)
    code, _body = http_req("GET", HEALTH_URL_PUBLIC, 12)
    _set("last_http_code", code)
    return code == "200"


# --- rollback (LOCAL to omv) -------------------------------------------------
def do_rollback() -> bool:
    cur = ""
    if CURRENT.is_symlink():
        cur = os.readlink(CURRENT).replace("cloudless-releases/", "")
    prev = ""
    if RELEASES.is_dir():
        candidates = sorted(
            (p.name for p in RELEASES.iterdir() if p.name != cur),
            key=lambda n: (RELEASES / n).stat().st_mtime,
            reverse=True,
        )
        prev = candidates[0] if candidates else ""
    if not prev:
        log("ROLLBACK aborted: no previous release available")
        return False
    log(f"ROLLBACK: flipping {cur} → {prev}")
    os.symlink(f"cloudless-releases/{prev}", str(CURRENT) + ".tmp")
    os.replace(str(CURRENT) + ".tmp", CURRENT)
    run("chown", "-h", "tbaltzakis:users", str(CURRENT))
    run("k3s", "kubectl", "-n", NS, "rollout", "restart", f"deploy/{DEPLOY}")
    run("k3s", "kubectl", "-n", NS, "rollout", "status", f"deploy/{DEPLOY}", "--timeout=180s")
    _set("last_rollback_ts", str(_now()))
    log(f"ROLLBACK done, now on {prev} (was {cur})")
    _set("rollback_from", cur)
    _set("rollback_to", prev)
    return True


# --- satellite HTTP probes ---------------------------------------------------
def check_targets() -> None:
    now = _now()
    for name, url, expect, remed in WATCH_TARGETS:
        code, _body = http_req("GET", url, 10, follow=True)
        ok = code.startswith(("2", "3")) if expect == "ok" else code == expect

        fc = int(_get(f"fail_count_{name}", "0"))
        if ok:
            if fc > 0 or _get(f"notified_{name}", "0") == "1":
                log(f"TARGET RECOVERED: {name} (was fail_count={fc})")
                notify_all(f"✅ {name} recovered", f"{url} healthy again after ~{fc * 2} min.", "low")
            _set(f"fail_count_{name}", "0")
            _set(f"notified_{name}", "0")
            continue

        fc += 1
        _set(f"fail_count_{name}", str(fc))
        log(f"TARGET UNHEALTHY: {name} http={code} tick={fc}")
        if fc >= NOTIFY_THRESHOLD and _get(f"notified_{name}", "0") == "0":
            notify_all(f"⚠️ {name} unhealthy", f"{url} failing ~{fc * 2} min. Last HTTP={code}.", "high")
            _set(f"notified_{name}", "1")
        if fc >= ROLLBACK_THRESHOLD and remed:
            ns, dep = remed
            prev = int(_get(f"remed_ts_{name}", "0"))
            if now - prev >= ROLLBACK_COOLDOWN:
                log(f"REMEDIATION: k3s rollout restart {ns}/{dep} for {name}")
                if run("k3s", "kubectl", "-n", ns, "rollout", "restart", f"deploy/{dep}").returncode == 0:
                    _set(f"remed_ts_{name}", str(now))
                    notify_all(f"🔁 {name} restarted",
                               f"k3s rollout restart deploy/{dep} in ns {ns} after {fc} consecutive failures.", "high")
                else:
                    notify_all(f"🚨 {name} remediation failed",
                               f"rollout restart deploy/{dep} in ns {ns} failed. Manual check needed.", "urgent")


# --- worker error watcher ----------------------------------------------------
def check_worker_errors() -> None:
    if not CF_API_TOKEN or not CF_ACCOUNT_ID:
        return
    tick = int(_get("tick_count", "0")) + 1
    _set("tick_count", str(tick))
    if tick % WORKER_CHECK_EVERY != 0:
        return

    since = (datetime.now(UTC) - timedelta(minutes=WORKER_ERROR_WINDOW_MIN)).strftime("%Y-%m-%dT%H:%M:%SZ")
    now_iso = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
    query = (
        "query($a:String!,$s:Time!,$e:Time!){viewer{accounts(filter:{accountTag:$a})"
        "{workersInvocationsAdaptive(limit:200,filter:{datetime_geq:$s,datetime_leq:$e})"
        "{sum{errors}dimensions{scriptName}}}}}"
    )
    payload = json.dumps({
        "query": query,
        "variables": {"a": CF_ACCOUNT_ID, "s": since, "e": now_iso},
    }).encode()
    code, body = http_req("POST", "https://api.cloudflare.com/client/v4/graphql", 15,
                          {"Authorization": f"Bearer {CF_API_TOKEN}",
                           "Content-Type": "application/json"}, payload)
    if not code.startswith("2"):
        return

    try:
        rows = json.loads(body)["data"]["viewer"]["accounts"][0]["workersInvocationsAdaptive"]
    except (json.JSONDecodeError, KeyError, IndexError, TypeError):
        return

    errors: dict[str, int] = {}
    for row in rows:
        name = row.get("dimensions", {}).get("scriptName", "")
        count = row.get("sum", {}).get("errors", 0)
        if name and count:
            errors[name] = count

    over = {n: c for n, c in errors.items() if c >= WORKER_ERROR_THRESHOLD}
    under = {n: c for n, c in errors.items() if 0 < c < WORKER_ERROR_THRESHOLD}

    # Per-script sustained-error counters — consecutive windows only.
    for wl in WORKER_ROLLBACK_SCRIPTS:
        if wl not in errors:
            _set(f"werr_count_{wl}", "0")
    for name, count in errors.items():
        if count >= WORKER_ERROR_THRESHOLD:
            sustained = int(_get(f"werr_count_{name}", "0")) + 1
            _set(f"werr_count_{name}", str(sustained))
            if name in WORKER_ROLLBACK_SCRIPTS and sustained >= WORKER_ROLLBACK_AFTER:
                worker_auto_rollback(name)
        else:
            _set(f"werr_count_{name}", "0")

    over_s = " ".join(f"{n}={c}" for n, c in over.items())
    under_s = " ".join(f"{n}={c}" for n, c in under.items())
    prev = _get("worker_alert_active", "0")
    if over_s:
        if prev == "0":
            log(f"WORKER ERRORS over threshold: {over_s} (below: {under_s or 'none'})")
            details = worker_error_details(list(over))
            body_text = f"Cloudflare worker errors in last {WORKER_ERROR_WINDOW_MIN}min (≥{WORKER_ERROR_THRESHOLD}): {over_s}"
            if under_s:
                body_text += f"\nBelow threshold: {under_s}"
            body_text += f"\n\nLatest exceptions:\n{details}" if details else "\nCheck wrangler tail / recent deploys."
            notify_all("⚠️ worker exceptions", body_text, "high")
            _set("worker_alert_active", "1")
    elif prev == "1":
        log("WORKER ERRORS cleared")
        suffix = f" Under threshold: {under_s}" if under_s else ""
        notify_all("✅ worker errors cleared",
                   f"No worker exceptions ≥{WORKER_ERROR_THRESHOLD} in the last {WORKER_ERROR_WINDOW_MIN}min.{suffix}", "low")
        _set("worker_alert_active", "0")


def worker_error_details(scripts: list[str]) -> str:
    """Fetch recent exception texts via Workers Observability telemetry/query."""
    now_ms = int(time.time() * 1000)
    since_ms = now_ms - WORKER_ERROR_WINDOW_MIN * 60000
    out: list[str] = []
    for script in scripts:
        payload = json.dumps({
            "queryId": "adhoc",
            "timeframe": {"from": since_ms, "to": now_ms},
            "view": "events",
            "parameters": {
                "filters": [{
                    "key": "$metadata.service",
                    "operation": "eq",
                    "type": "string",
                    "value": script,
                }],
                "limit": 20,
            },
        }).encode()
        code, body = http_req(
            "POST",
            f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/workers/observability/telemetry/query",
            15,
            {"Authorization": f"Bearer {CF_API_TOKEN}", "Content-Type": "application/json"},
            payload,
        )
        if not code.startswith("2"):
            continue
        try:
            events = (json.loads(body).get("result", {}).get("events", {}) or {}).get("events", []) or []
        except json.JSONDecodeError:
            continue
        for e in events:
            w = e.get("$workers") or e.get("$cloudflare", {}).get("$workers") or {}
            outcome = w.get("outcome", "")
            excs = e.get("exceptions") or w.get("exceptions") or []
            if outcome == "success" and not excs:
                continue
            msg = ""
            if isinstance(excs, list) and excs:
                msg = str(excs[0].get("message") or excs[0].get("name") or "")
            if not msg:
                for line in reversed(e.get("logs") or []):
                    if line.get("level") in ("error", "fatal"):
                        msg = str(line.get("message") or "")
                        break
            if not msg:
                msg = str(w.get("eventMessage") or outcome or "exception")
            script_name = w.get("scriptName") or e.get("$metadata", {}).get("service") or "?"
            out.append(f"{script_name}: {msg[:160]}")
            if len(out) >= 3:
                return "\n".join(out)
    return "\n".join(out)


def worker_auto_rollback(script: str) -> None:
    now = _now()
    last = int(_get(f"worker_rb_ts_{script}", "0"))
    if last and now - last < ROLLBACK_COOLDOWN:
        log(f"SKIP worker rollback {script}: cooldown ({(ROLLBACK_COOLDOWN - (now - last)) // 60}min left)")
        return

    api = f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/workers/scripts/{script}"
    code, body = http_req("GET", f"{api}/deployments", 15,
                          {"Authorization": f"Bearer {CF_API_TOKEN}"})
    if not code.startswith("2"):
        return
    try:
        deploys = (json.loads(body).get("result") or {}).get("deployments") or []
    except json.JSONDecodeError:
        return
    deploys = [
        d for d in deploys
        if d.get("versions") and d["versions"][0].get("percentage") == 100
    ]
    deploys.sort(key=lambda d: d.get("created_on", ""), reverse=True)
    if len(deploys) < 2:
        log(f"SKIP worker rollback {script}: <2 deployments")
        return
    prev_vid = deploys[1]["versions"][0]["version_id"]
    created = deploys[0]["created_on"].replace("Z", "+00:00")
    cur_age = int(datetime.now(UTC).timestamp() - datetime.fromisoformat(created).timestamp())

    if cur_age < WORKER_ROLLBACK_MIN_AGE:
        log(f"SKIP worker rollback {script}: current deploy age={cur_age}s < {WORKER_ROLLBACK_MIN_AGE}s")
        return
    if cur_age > WORKER_ROLLBACK_MAX_AGE:
        log(f"SKIP worker rollback {script}: deploy age={cur_age}s > {WORKER_ROLLBACK_MAX_AGE}s — errors not deploy-correlated")
        return

    log(f"WORKER ROLLBACK: {script} → version {prev_vid} (deploy age {cur_age}s)")
    payload = json.dumps({
        "strategy": "percentage",
        "versions": [{"version_id": prev_vid, "percentage": 100}],
        "annotations": {"workers/message": "safedeploy-watchdog auto-rollback after sustained errors"},
    }).encode()
    code, resp_body = http_req("POST", f"{api}/deployments", 15,
                               {"Authorization": f"Bearer {CF_API_TOKEN}",
                                "Content-Type": "application/json"}, payload)
    if code.startswith("2"):
        _set(f"worker_rb_ts_{script}", str(now))
        _set(f"werr_count_{script}", "0")
        notify_all(f"🔁 {script} auto-rolled-back",
                   f"Pinned previous version {prev_vid[:8]} after ≥{WORKER_ROLLBACK_AFTER} checks "
                   f"≥{WORKER_ERROR_THRESHOLD} errors/{WORKER_ERROR_WINDOW_MIN}min.", "high")
    else:
        notify_all(f"🚨 {script} rollback FAILED",
                   f"Auto-rollback to {prev_vid[:8]} failed: {resp_body[:200].decode('utf-8', 'replace')}", "urgent")


# --- infra checks ------------------------------------------------------------
def check_infra() -> None:
    r = run("k3s", "kubectl", "get", "nodes", "--no-headers")
    notready = [
        line.split()[0]
        for line in (r.stdout or "").splitlines()
        if line.split() and len(line.split()) > 1 and line.split()[1] != "Ready"
    ]
    if notready:
        if _get("infra_node_alert", "0") == "0":
            names = ",".join(notready)
            log(f"INFRA: node(s) NotReady: {names}")
            notify_all("🚨 k3s node NotReady", f"Node(s) not Ready: {names}", "urgent")
            _set("infra_node_alert", "1")
    elif _get("infra_node_alert", "0") == "1":
        _set("infra_node_alert", "0")
        notify_all("✅ k3s nodes Ready", "All nodes back to Ready.", "low")

    for dev, thresh, tag in (
        ("/var/lib/rancher/k3s", DISK_K3S_PCT, "k3s-ssd"),
        ("/srv/dev-disk-by-uuid-fa6231ab-eae7-40ea-a4b6-400f767a89d7", DISK_DATA_PCT, "data-ssd"),
    ):
        r = run("df", "--output=pcent", dev)
        lines = (r.stdout or "").splitlines()
        if len(lines) < 2:
            continue
        pct = int("".join(c for c in lines[-1] if c.isdigit()) or "0")
        if pct >= thresh:
            if _get(f"infra_disk_{tag}", "0") == "0":
                log(f"INFRA: {tag} at {pct}% (threshold {thresh}%)")
                notify_all(f"⚠️ disk pressure: {tag}",
                           f"{dev} at {pct}% (alert at {thresh}%). For k3s-ssd: crictl rmi --prune first.", "high")
                _set(f"infra_disk_{tag}", "1")
        elif _get(f"infra_disk_{tag}", "0") == "1" and pct < thresh - 5:
            _set(f"infra_disk_{tag}", "0")
            notify_all(f"✅ disk recovered: {tag}", f"{dev} back to {pct}%.", "low")


# --- deadman ping ------------------------------------------------------------
def deadman_ping() -> None:
    if HEALTHCHECK_PING_URL:
        http_req("GET", HEALTHCHECK_PING_URL, 8)


# --- main tick ---------------------------------------------------------------
def main() -> None:
    fail_count = int(_get("fail_count", "0"))
    now = _now()

    # Extended checks run every tick regardless of main-site state (the main
    # path below has early returns that must not starve them).
    check_targets()
    check_worker_errors()
    check_infra()
    deadman_ping()

    if probe_health():
        # HEALTHY
        if fail_count > 0 or _get("notified", "0") == "1":
            incident_start = int(_get("incident_start", str(now)))
            duration_min = (now - incident_start) // 60
            rf = _get("rollback_from", "")
            rt = _get("rollback_to", "")
            body = f"Site recovered after ~{duration_min} min unhealthy."
            if rt:
                body += f"\nAuto-rollback fired: {rf} → {rt}"
            log(f"RECOVERED after {duration_min}min (was fail_count={fail_count})")
            notify_all("✅ cloudless.gr recovered", body, "low")
        for k, v in (("fail_count", "0"), ("notified", "0"),
                     ("rollback_from", ""), ("rollback_to", ""), ("incident_start", "")):
            _set(k, v)
        return

    # UNHEALTHY — increment counter
    fail_count += 1
    _set("fail_count", str(fail_count))
    if fail_count == 1:
        _set("incident_start", str(now))
    code = _get("last_http_code", "?")
    log(f"UNHEALTHY tick={fail_count} http={code}")

    # First alert at NOTIFY_THRESHOLD (only once per incident)
    if fail_count >= NOTIFY_THRESHOLD and _get("notified", "0") == "0":
        body = (
            f"cloudless.gr health check has failed {fail_count} times in a row "
            f"(~{fail_count * 2} min). Last HTTP={code}.\n\n"
            "Rollback candidate: run 'python3 scripts/rollback.py previous' from a workstation.\n\n"
            f"Auto-rollback will fire after {ROLLBACK_THRESHOLD} consecutive failures "
            f"(~{ROLLBACK_THRESHOLD * 2} min total) if still unhealthy."
        )
        log(f"NOTIFY sent (threshold={NOTIFY_THRESHOLD} reached)")
        notify_all("⚠️ cloudless.gr unhealthy", body, "high")
        _set("notified", "1")

    # Auto-rollback at ROLLBACK_THRESHOLD (with safeguards)
    if fail_count >= ROLLBACK_THRESHOLD:
        # Safeguard 1: cooldown since last auto-rollback
        last_rb = int(_get("last_rollback_ts", "0"))
        if last_rb and now - last_rb < ROLLBACK_COOLDOWN:
            log(f"SKIP rollback: cooldown ({(ROLLBACK_COOLDOWN - (now - last_rb)) // 60} min remaining)")
            return
        # Safeguard 2: don't rollback a release younger than MIN_RELEASE_AGE
        try:
            link_age = now - int(CURRENT.lstat().st_mtime)
        except OSError:
            link_age = now
        if link_age < MIN_RELEASE_AGE:
            log(f"SKIP rollback: current release age={link_age}s < {MIN_RELEASE_AGE}s (deploy-time rollback likely already fired)")
            return
        if do_rollback():
            rf = _get("rollback_from", "?")
            rt = _get("rollback_to", "?")
            notify_all("🔁 cloudless.gr auto-rolled-back",
                       f"Auto-flipped {rf} → {rt} after {fail_count} consecutive failures. Verifying…", "high")
        else:
            notify_all("🚨 cloudless.gr rollback FAILED",
                       "Wanted to auto-rollback but couldn't (no previous release?). Manual intervention needed.", "urgent")


if __name__ == "__main__":
    main()
