#!/usr/bin/env bash
# lint-yaml.sh — yamllint (all YAML) + actionlint (GitHub Actions workflows)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TOOLS_BIN="$ROOT/.tools/bin"
TOOLS_PY="$ROOT/.tools/python"
mkdir -p "$TOOLS_BIN" "$TOOLS_PY"

export PYTHONPATH="$TOOLS_PY${PYTHONPATH:+:$PYTHONPATH}"

run_yamllint() {
  if command -v yamllint >/dev/null 2>&1; then
    # Prefer a real install (pipx / system) over the local .tools cache.
    if [[ "$(command -v yamllint)" != "$TOOLS_PY/bin/yamllint" ]]; then
      yamllint "$@"
      return
    fi
  fi
  python3 -m yamllint "$@"
}

ensure_yamllint() {
  if python3 -c "import yamllint" 2>/dev/null; then
    return 0
  fi
  if command -v yamllint >/dev/null 2>&1 && [[ "$(command -v yamllint)" != "$TOOLS_PY/bin/yamllint" ]]; then
    return 0
  fi
  echo "[lint:yaml] installing yamllint into .tools/python …" >&2
  python3 -m pip install --target "$TOOLS_PY" 'yamllint>=1.35,<2' -q
  python3 -c "import yamllint" || {
    echo "[lint:yaml] yamllint import failed after install" >&2
    exit 1
  }
}

ensure_actionlint() {
  if command -v actionlint >/dev/null 2>&1; then
    return 0
  fi
  if [[ -x "$TOOLS_BIN/actionlint" ]]; then
    return 0
  fi
  echo "[lint:yaml] downloading actionlint into .tools/bin …" >&2
  (
    cd "$TOOLS_BIN"
    # Ownership change can fail on some WSL/sandbox mounts; binary still extracts.
    bash <(curl -fsSL https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.bash) latest . \
      || true
  )
  [[ -x "$TOOLS_BIN/actionlint" ]] || {
    echo "[lint:yaml] actionlint install failed" >&2
    exit 1
  }
}

run_actionlint() {
  if command -v actionlint >/dev/null 2>&1; then
    actionlint "$@"
  else
    "$TOOLS_BIN/actionlint" "$@"
  fi
}

ensure_yamllint
ensure_actionlint

echo "==> yamllint"
run_yamllint .

echo "==> actionlint (.github/workflows)"
# Uses .github/actionlint.yaml for self-hosted runner labels.
# concurrency.queue is valid on GitHub but not yet in actionlint's schema.
run_actionlint -ignore 'unexpected key "queue"'

echo "YAML lint OK"
