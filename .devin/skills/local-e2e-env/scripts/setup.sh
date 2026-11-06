#!/usr/bin/env bash
# Idempotent local Playwright env bootstrap for cloudless.gr on WSL/Ubuntu
# without sudo. Run from the repo root:  bash .devin/skills/local-e2e-env/scripts/setup.sh
#
# What it fixes (all hit 2026-11-06):
#   1. System Node is v20 — playwright.config.mts fails to load (extensionless
#      .ts import). CI uses Node 22 → we install a user-local Node 22 tarball.
#   2. `corepack pnpm` cache is corrupt → use `npx -y pnpm@9.15.0` instead.
#   3. `workers/mail-outbound/node_modules` may be root-owned (old sudo install)
#      → pnpm install dies with EACCES. Rename it aside once.
#   4. Playwright chromium misses libnspr4/libnss3/libasound → extract the
#      Ubuntu debs into /tmp/pwlibs and export LD_LIBRARY_PATH.
set -euo pipefail
cd "$(dirname "$0")/../../../.."

NODE_VERSION="v22.20.0"
NODE_DIR="${HOME}/.local/node/${NODE_VERSION}"
PWLIBS="${HOME}/.local/pwlibs"

echo "== node $NODE_VERSION =="
if [ ! -x "${NODE_DIR}/bin/node" ]; then
  mkdir -p "${NODE_DIR}"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "${NODE_DIR}" --strip-components=1
fi
"${NODE_DIR}/bin/node" --version

echo "== playwright system libs =="
if [ ! -f "${PWLIBS}/.ready" ]; then
  mkdir -p "${PWLIBS}/debs" "${PWLIBS}/root"
  (cd "${PWLIBS}/debs" && apt-get download libnspr4 libnss3 libasound2t64)
  for f in "${PWLIBS}"/debs/*.deb; do dpkg -x "$f" "${PWLIBS}/root"; done
  touch "${PWLIBS}/.ready"
fi
CHROME="$(ls -d "${HOME}"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell 2>/dev/null | head -1 || true)"
if [ -n "$CHROME" ]; then
  MISSING=$(LD_LIBRARY_PATH="${PWLIBS}/root/usr/lib/x86_64-linux-gnu" ldd "$CHROME" 2>/dev/null | grep -c "not found" || true)
  echo "chrome-headless-shell unresolved libs: ${MISSING}"
fi

echo "== root-owned workspace node_modules =="
for d in workers/*/node_modules scripts/etl/node_modules; do
  [ -d "$d" ] || continue
  if [ ! -w "$d" ]; then
    mv "$d" "$d.root-owned"
    echo "renamed $d -> $d.root-owned (needs sudo rm -rf later)"
  fi
done

echo "== deps =="
export PATH="${NODE_DIR}/bin:$PATH"
export LD_LIBRARY_PATH="${PWLIBS}/root/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
npx -y pnpm@9.15.0 install --frozen-lockfile --prefer-offline
npx -y pnpm@9.15.0 exec playwright install chromium

echo
echo "Done. For every playwright run use:"
echo "  PATH=${NODE_DIR}/bin:\$PATH LD_LIBRARY_PATH=${PWLIBS}/root/usr/lib/x86_64-linux-gnu \\"
echo "    npx -y pnpm@9.15.0 exec playwright test <spec> --project=chromium"
