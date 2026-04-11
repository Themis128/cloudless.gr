#!/usr/bin/env bash
set -euo pipefail

pass() { printf '[PASS] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; }
info() { printf '[INFO] %s\n' "$1"; }

info "Running Dev Containers terminal/engine diagnostics"

if command -v bash >/dev/null 2>&1; then
  pass "bash available: $(command -v bash)"
else
  warn "bash not found in PATH"
fi

if command -v docker >/dev/null 2>&1; then
  pass "docker CLI available: $(command -v docker)"
  if docker version >/dev/null 2>&1; then
    pass "docker daemon reachable from current shell"
  else
    warn "docker daemon not reachable; start Docker Desktop and wait for Engine running"
  fi
else
  warn "docker CLI not found in this distro; enable Docker Desktop WSL integration"
fi

if command -v wsl.exe >/dev/null 2>&1; then
  info "WSL distro list:"
  wsl.exe -l -v || true
  default_distro="$(wsl.exe --status 2>/dev/null | tr -d '\r\000' | awk -F': ' '/Default Distribution/ {print $2; exit}')"
  if [[ -z "$default_distro" ]]; then
    default_distro="$(wsl.exe -l -v 2>/dev/null | tr -d '\r\000' | awk '$1=="*" {print $2; exit}')"
  fi
  if [[ -n "$default_distro" ]]; then
    if [[ "$default_distro" == "docker-desktop" || "$default_distro" == "docker-desktop-data" ]]; then
      warn "WSL default distro is $default_distro; set a real Linux distro as default"
      info "Run: wsl.exe --set-default Ubuntu-24.04"
    else
      pass "WSL default distro looks valid: $default_distro"
    fi
  else
    warn "Could not determine WSL default distro"
  fi
fi

# Measure startup in VS Code probe mode (what userEnvProbe uses) and use median of 3 runs.
samples=()
for _ in 1 2 3; do
  start_ms=$(date +%s%3N)
  VSCODE_RESOLVING_ENVIRONMENT=1 bash -lic "exit" >/dev/null 2>&1 || true
  end_ms=$(date +%s%3N)
  samples+=("$((end_ms-start_ms))")
done
sorted=($(printf '%s\n' "${samples[@]}" | sort -n))
median_ms="${sorted[1]}"
info "bash -lic probe startup median ms (3 samples): $median_ms [${samples[*]}]"
if [[ -n "$median_ms" ]]; then
  if awk -v t="$median_ms" 'BEGIN { exit !(t > 2200) }'; then
    warn "Probe startup is high (>2200ms); VS Code userEnvProbe delays are likely"
    info "Likely cause: heavy ~/.bashrc or ~/.profile init (nvm/bash_completion/path scripts)"
  else
    pass "Probe startup is within normal range"
  fi
else
  warn "Could not measure bash startup latency"
fi

settings='/mnt/c/Users/baltz/AppData/Roaming/Code - Insiders/User/settings.json'
if [[ -f "$settings" ]]; then
  info "Checking terminal launch-critical VS Code settings"
  rg -n '"terminal\.integrated\.(defaultProfile\.windows|profiles\.windows|inheritEnv|automationProfile\.windows|cwd|env\.windows|windowsEnableConpty)"' "$settings" || true
  pass "settings.json found and scanned"
else
  warn "VS Code user settings not found at expected path: $settings"
fi

info "Diagnostics complete"
