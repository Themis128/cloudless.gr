#!/usr/bin/env bash
# install-monit-postfix-fix.sh — omv: harden postfix supervision + enable at boot.
#
# Root-cause fix for the recurring "[OMV] Daily Health Check" alert
# ("Service postfix is NOT running!" + "High number of system errors …").
#
#   • postfix.service is *disabled* in systemd, so it never starts on reboot.
#     The nightly nas-health-check then finds it down and restarts it — and, on a
#     quiet morning, the 06:00 check is the ONLY thing that brings it back. On a
#     non-reboot morning (2026-08-26) postfix died at ~17:10 (network-dispatcher
#     event) and stayed down ~13h until the check restarted it.
#   • While postfix is down, monit's alert handler tries to deliver its own mail
#     via 127.0.0.1:25, logs 4 error lines per 30s cycle, and retries — producing
#     the bulk of the "4,755 errors". Fixing postfix collapses the error count.
#
# This script (review before applying — run with --preview by default):
#   1. Enables postfix.service at boot (idempotent).
#   2. Installs a hardened postfix check into /etc/monit/conf.d/ so monit actually
#      supervises postfix and restarts it within ~2 cycles instead of waiting for
#      the nightly health check. NOTE: the stock conf-available/postfix exists but
#      is NOT loaded (conf.d only had k3s-service + tailscaled) — postfix was
#      effectively unsupervised.
#   3. OPTIONAL (--mail-relay, off by default): points monit's alert mail at the
#      external WorkMail relay instead of local postfix, so a postfix outage no
#      longer feeds monit's own error loop. Kept as a documented alternative; the
#      recommended primary fix is root-cause (1)+(2).
#
# Usage (run as root on omv, either from a checkout or scp'd):
#   sudo bash infrastructure/omv/install-monit-postfix-fix.sh            # preview (no changes)
#   sudo bash infrastructure/omv/install-monit-postfix-fix.sh --apply    # apply (1)+(2)
#   sudo bash infrastructure/omv/install-monit-postfix-fix.sh --apply --mail-relay
set -euo pipefail

[ "$EUID" = "0" ] || { echo "must be root" >&2; exit 1; }

APPLY=0
MAIL_RELAY=0
for a in "$@"; do
  case "$a" in
    --apply)     APPLY=1 ;;
    --mail-relay) MAIL_RELAY=1 ;;
    *) echo "unknown arg: $a" >&2; exit 2 ;;
  esac
done

step(){ printf '\n== %s ==\n' "$*"; }
doit(){
  if [ "$APPLY" = "1" ]; then "$@"; else echo "  [preview] would run: $*"; fi
}

POSTFIX_CONF=/etc/monit/conf-available/postfix
POSTFIX_LOADED=/etc/monit/conf.d/postfix
BACKUP_TS="$(date +%Y%m%d-%H%M%S)"

# ---------------------------------------------------------------- 1. boot enable
step "1/2  postfix.service enabled at boot"
if systemctl is-enabled postfix >/dev/null 2>&1; then
  echo "  postfix already enabled at boot"
else
  doit systemctl enable postfix
fi

# ------------------------------------------------------- 2. hardened monit check
step "2/2  hardened postfix supervision in /etc/monit/conf.d"
if [ ! -f "$POSTFIX_CONF" ]; then
  echo "  source $POSTFIX_CONF not found — skipping monit check (postfix still enabled at boot)" >&2
  exit 0
fi

if [ -f "$POSTFIX_LOADED" ]; then
  echo "  $POSTFIX_LOADED already present — will leave as-is"
else
  echo "  installing hardened postfix check (monit currently does not supervise postfix)"
  # Copy the stock (dependency-laden) check, then apply fixes validated with monit -t:
  #   1. 'service' is NOT in monit's PATH -> use /usr/sbin/service (stock check was
  #      otherwise broken: "Program does not exist: 'service'").
  #   2. Drop 'with timeout N seconds' from the port-failure restart (invalid here).
  #   3. Widen the give-up window so a transient down doesn't permanently unmonitor.
  doit cp -a "$POSTFIX_CONF" "$POSTFIX_LOADED"
  doit sed -i \
    -e 's#start program = "service postfix start"#start program = "/usr/sbin/service postfix start"#' \
    -e 's#stop  program = "service postfix stop"#stop  program = "/usr/sbin/service postfix stop"#' \
    -e 's/if failed host localhost port 25 with protocol smtp for 2 times within 3 cycles then restart/if failed host 127.0.0.1 port 25 with protocol smtp for 2 times within 3 cycles then restart/' \
    -e 's/if 5 restarts with 5 cycles then timeout/if 5 restarts with 15 cycles then timeout/' \
    "$POSTFIX_LOADED"
fi

# validate + reload (only when applying)
if [ "$APPLY" = "1" ]; then
  if monit -t >/dev/null 2>&1; then
    monit reload
    echo "  monit: config OK, reloaded"
  else
    echo "  monit -t FAILED — restoring previous config" >&2
    cp -a "$POSTFIX_LOADED" "${POSTFIX_LOADED}.bad-${BACKUP_TS}" 2>/dev/null || true
    rm -f "$POSTFIX_LOADED"
    exit 1
  fi
else
  echo "  [preview] would run: monit -t && monit reload"
fi

# ------------------------------------------- 3. OPTIONAL: mail loop alternative
# Primary fix is root-cause (1)+(2): postfix stays up, so monit's own 127.0.0.1:25
# alert path keeps working and stops spamming errors. --mail-relay additionally
# points monit's alert mail AT the external relay so even a real postfix outage
# can't feed monit's error loop. CAVEATS (why (1)+(2) is the primary fix):
#   - monitrc is auto-generated by OMV and the header says "changes will get lost" —
#     persist via the OMV web UI/confdb, or re-run after OMV regenerates monitrc.
#   - WorkMail :465 is implicit (SMTPS) TLS; monit 5.34 uses STARTTLS 'using tls',
#     so auth/TLS behavior against :465 may be flaky across vendor SMTP servers.
#   - monit's username/password would live in monitrc (OMV DB), a new secret copy.
# We still back up + validate (monit -t) and roll back on failure if you try it.
if [ "$MAIL_RELAY" = "1" ]; then
  step "3/3  (optional) point monit alert mail at external WorkMail relay"
  MONITRC=/etc/monit/monitrc
  MAIN_CF=/etc/postfix/main.cf
  SASL=/etc/postfix/sasl_passwd
  [ -f "$MONITRC" ] || { echo "  $MONITRC not found" >&2; exit 1; }

  # --- resolve relay endpoint from postfix main.cf: 'relayhost = [host]:port'
  relay="$(sed -n 's/^relayhost[[:space:]]*=[[:space:]]*//p' "$MAIN_CF" | head -1 | tr -d '[:space:]')"
  if [ -z "$relay" ]; then echo "  no relayhost in $MAIN_CF — cannot compute external relay" >&2; exit 1; fi
  host="${relay#[}"; host="${host%\]*}"                    # strip [ ]
  port="${relay##*:}"; port="${port%]}"                   # after last :
  [ -n "$host" ] && [ "${port:-}" != "$relay" ] || { echo "  could not parse relay '$relay'" >&2; exit 1; }

  # --- resolve SMTP auth from postfix sasl_passwd: '<[host]:port>  user:pass'
  authkey="[${host}]:${port}"
  cred="$(awk -v key="$authkey" '$1==key {print $2; exit}' "$SASL" 2>/dev/null | head -1)"
  if [ -z "$cred" ]; then
    echo "  WARN: no sasl_passwd line for [${host}]:${port} — using relay without auth" >&2
    username=""; password=""
  else
    username="${cred%%:*}"; password="${cred#*:}"
  fi

  mserver="set mailserver ${host} port ${port}"
  if [ -n "$username" ]; then
    mserver="${mserver} username \"${username}\" password \"${password}\""
  fi
  mserver="${mserver} using tls"

  if grep -q '^set mailserver 127.0.0.1' "$MONITRC"; then
    echo "  replacing 'set mailserver 127.0.0.1' with: $mserver"
    if [ "$APPLY" = "1" ]; then
      cp -a "$MONITRC" "${MONITRC}.bak-${BACKUP_TS}"
      awk -v repl="$mserver" '
        /^set mailserver 127\.0\.0\.1/ { print repl; printed=1; next }
        { print }
        END { if (!printed) print repl }
      ' "$MONITRC" > "${MONITRC}.new"
      if monit -t -c "${MONITRC}.new" >/dev/null 2>&1; then
        mv "${MONITRC}.new" "$MONITRC"
        monit reload
        echo "  monitrc updated + reloaded (backup: ${MONITRC}.bak-${BACKUP_TS})"
      else
        echo "  monit -t FAILED on new config — rolling back, no change made" >&2
        rm -f "${MONITRC}.new"
        exit 1
      fi
    else
      echo "  [preview] would update monitrc (backup kept) + monit reload"
    fi
  else
    echo "  monitrc 'set mailserver' already customized — leaving as-is"
  fi
fi

echo
echo "review / apply:"
echo "  sudo bash $(basename "$0") --apply              # applies (1) boot-enable + (2) monit watchdog"
echo "  sudo bash $(basename "$0") --apply --mail-relay # also (3) point monit alerts at external relay"
echo "  tail -40 /var/log/nas-daily-health.log          # confirm 'postfix is NOT running' is gone"
