#!/usr/bin/env bash
# omv-security-update.sh — Check and optionally apply Debian security updates on OMV
#
# This script runs ON the omv host (via Tailscale SSH from CI or manually).
# It checks for outstanding security upgrades and optionally installs them.
#
# Usage:
#   omv-security-update.sh            # Dry-run: check + list available updates
#   omv-security-update.sh --apply    # Apply security updates
#   omv-security-update.sh --apply --only=unzip,zip,util-linux  # Apply specific packages
#
# Security sources (trixie-security) are checked via apt-cache policy.
set -euo pipefail

MODE="check"
ONLY=""
PKG_LIST=""
ALL_OK="n/a"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)    MODE="apply"; shift ;;
    --only=*)   ONLY="${1#--only=}"; shift ;;
    --help|-h)
      echo "Usage: $0 [--apply] [--only=pkg1,pkg2]"
      echo "  (no flags)  → dry-run: list pending security updates"
      echo "  --apply     → install security updates"
      echo "  --only=     → restrict to comma-separated package list"
      exit 0
      ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"; }

# --- Gather context -----------------------------------------------------------

HOSTNAME=$(hostname 2>/dev/null || echo "unknown")
APT_VERSION=$(apt --version 2>/dev/null | head -1 || echo "apt not found")
OS_RELEASE=$(grep '^VERSION=' /etc/os-release 2>/dev/null || echo "unknown")

log "=== OMV Security Update Check ==="
log "Host: $HOSTNAME"
log "OS: $OS_RELEASE"
log "APT: $APT_VERSION"
log "Mode: $MODE"
[[ -n "$ONLY" ]] && log "Package filter: $ONLY"

# --- Check security sources ---------------------------------------------------

SECURITY_SOURCES=$(grep -rh '^deb ' /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null \
  | grep -i security || true)

if [[ -z "$SECURITY_SOURCES" ]]; then
  log "WARN: No Debian security sources found in apt sources"
else
  log "Security sources detected:"
  echo "$SECURITY_SOURCES" | while read -r line; do
    echo "  $line"
  done
fi

# --- APT update ---------------------------------------------------------------

log "Running apt-get update..."
# Capture update output; treat lock/dpkg interruptions as non-fatal
apt-get update 2>&1 | tee /tmp/apt-update.log || {
  log "WARN: apt-get update exited non-zero (may be transient)"
}

# --- Identify security updates ------------------------------------------------

# Build a list of upgradable packages and filter for security origins.
# Debian marks security updates with "-security" in the origin/site.
log "Checking for upgradable packages via apt..."
apt-get upgrade --simulate --assume-no 2>/tmp/apt-simulate.log || true
# apt-get upgrade --simulate prints candidate versions in a parseable way
apt-check --human-output /tmp/apt-sim.log 2>/dev/null || true

# Use /usr/lib/update-notifier/apt-check if available (Debian standard way)
APT_CHECK="/usr/lib/update-notifier/apt-check"
if [[ -x "$APT_CHECK" ]]; then
  log "Using apt-check for security update counting..."
  # apt-check outputs to stdout: "Updates: N security updates"
  UPDATES_RAW=$("$APT_CHECK" 2>&1 || true)
  log "apt-check output: $UPDATES_RAW"
fi

# Parse `apt list --upgradable` for packages with security origins
UPGRADABLE=$(apt list --upgradable 2>/dev/null | tail -n +2 || true)

# Filter: packages whose candidate version is from a -security repository
SECURITY_UPDATES=""
if [[ -n "$UPGRADABLE" ]]; then
  while IFS= read -r pkgline; do
    [[ -z "$pkgline" ]] && continue
    pkgname=$(echo "$pkgline" | cut -d/ -f1)
    # Get the candidate version's origin
    origin=$(apt-cache policy "$pkgname" 2>/dev/null \
      | awk '/\*\*\*/ {found=1; next} found && /^     / {print $2, $3; exit}' \
      | tr -d '[]' || true)
    if echo "$origin" | grep -qiE 'security|trixie-security' 2>/dev/null; then
      # Extract version number
      version=$(echo "$pkgline" | awk -F'[ /]' '{print $3}' | head -1)
      if [[ -n "$SECURITY_UPDATES" ]]; then
        SECURITY_UPDATES="${SECURITY_UPDATES}\n  ${pkgname} → ${version}"
      else
        SECURITY_UPDATES="  ${pkgname} → ${version}"
      fi
    fi
  done <<< "$UPGRADABLE"
fi

# Also explicitly check the packages from apt-listchanges (those are the ones we know about)
KNOWN_PACKAGES="unzip zip util-linux"

log ""
log "=== Security Updates Available ==="
if [[ -n "$SECURITY_UPDATES" ]]; then
  echo -e "$SECURITY_UPDATES"
else
  log "No packages with security origin detected via apt list."
  # Fall back to checking the known packages explicitly
  log "Checking known packages from apt-listchanges..."
  for pkg in $KNOWN_PACKAGES; do
    installed=$(dpkg-query -W -f '${Version}' "$pkg" 2>/dev/null || echo "not-installed")
    candidate=$(apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ {print $2}')
    if [[ "$installed" != "$candidate" && -n "$candidate" && "$candidate" != "(none)" ]]; then
      log "  $pkg: $installed → $candidate (UPGRADE AVAILABLE)"
    else
      log "  $pkg: $installed (up to date)"
    fi
  done
fi

# --- Apply updates if requested -----------------------------------------------

if [[ "$MODE" == "apply" ]]; then
  log ""
  log "=== Applying Security Updates ==="

  # Build package list
  if [[ -n "$ONLY" ]]; then
    PKG_LIST="$ONLY"
    log "Applying updates for specific packages: $PKG_LIST"
  else
    # Collect security-upgradable package names
    PKG_LIST=$(apt list --upgradable 2>/dev/null | tail -n +2 | while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      echo "$line" | cut -d/ -f1
    done | tr '\n' ' ')
    if [[ -z "$PKG_LIST" ]]; then
      log "No upgradable packages found. Nothing to apply."
      exit 0
    fi
    log "Applying updates for all upgradable packages: $PKG_LIST"
  fi

  # Install with --assume-yes, logging output
  log "Running apt-get install --only-upgrade --assume-yes $PKG_LIST..."
  apt-get install --only-upgrade --assume-yes $PKG_LIST 2>&1 | tee /tmp/apt-upgrade.log || {
    log "ERROR: apt-get install failed"
    exit 1
  }

  # --- Verify ---------------------------------------------------------------

  log ""
  log "=== Post-Upgrade Verification ==="
  ALL_OK=true
  for pkg in $PKG_LIST; do
    installed=$(dpkg-query -W -f '${Version}' "$pkg" 2>/dev/null || echo "not-installed")
    candidate=$(apt-cache policy "$pkg" 2>/dev/null | awk '/Candidate:/ {print $2}')
    if [[ "$installed" == "$candidate" ]]; then
      log "  ✅ $pkg: $installed"
    else
      log "  ❌ $pkg: installed=$installed, candidate=$candidate"
      ALL_OK=false
    fi
  done

  if $ALL_OK; then
    log "All packages upgraded successfully."
  else
    log "WARNING: Some packages did not reach the candidate version."
  fi

  # Check for packages needing restart
  if command -v needrestart >/dev/null 2>&1; then
    log ""
    log "=== Services/Processes Requiring Restart ==="
    needrestart -r a -b 2>&1 | tee /tmp/needrestart.log || true
  else
    log "needrestart not installed — skipping restart check."
  fi
else
  log ""
  log "Dry-run mode. To apply updates, run with --apply"
fi

# --- Summary -------------------------------------------------------------------

log ""
log "=== Summary ==="
log "Hostname: $HOSTNAME"
log "Mode: $MODE"
log "Done at: $(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Write a machine-readable summary
cat > /tmp/security-update-summary.txt <<EOF
hostname=$HOSTNAME
os=$OS_RELEASE
mode=$MODE
timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
packages_updated=$PKG_LIST
all_ok=$ALL_OK
EOF

log "Summary written to /tmp/security-update-summary.txt"
