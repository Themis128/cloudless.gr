#!/usr/bin/env bash
# Generate a single branded social card from CLI args, render to PNG, upload to Postiz.
# Usage: generate-post-card.sh <slug> <category> "<title>" "<author>" "<read-time>"
# Example:
#   generate-post-card.sh 5-aws-cost-mistakes FinOps "5 AWS cost mistakes killing your cloud bill." "Themis Baltzakis" "6 min read"
set -euo pipefail

BRANDING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
slug="$1"; cat="$2"; title="$3"; author="$4"; rt="$5"

OUT_DIR="$BRANDING_DIR/cloudless-brand/social-cards"
mkdir -p "$OUT_DIR"

HTML_TMP="$(mktemp --suffix=.html)"
cat > "$HTML_TMP" <<HTML
<!doctype html><html><head><meta charset="utf-8"/><style>
:root{--bg-0:#0a0a0f;--bg-1:#12121a;--bg-2:#1a1a2e;--cyan:#00fff5;--cyan-dim:#0ad4ff;--ink-60:rgba(255,255,255,.6)}
html,body{margin:0;background:#0a0a0f;font-family:ui-sans-serif,system-ui,Inter,sans-serif;color:#fff}
.card{width:1200px;height:630px;position:relative;overflow:hidden;background:linear-gradient(135deg,var(--bg-0),var(--bg-1) 50%,var(--bg-2));padding:72px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between}
.grid{position:absolute;inset:0;background-image:linear-gradient(90deg,rgba(0,255,245,.05) 1px,transparent 1px),linear-gradient(rgba(0,255,245,.05) 1px,transparent 1px);background-size:60px 60px}
.glow{position:absolute;top:-120px;right:-120px;width:480px;height:480px;border-radius:50%;background:radial-gradient(closest-side,rgba(0,255,245,.18),rgba(0,255,245,0));filter:blur(40px)}
.top{position:relative;display:flex;justify-content:space-between;align-items:flex-start}
.cat{display:flex;align-items:center;gap:14px;font-family:ui-monospace,monospace;font-size:18px;color:var(--cyan);letter-spacing:.22em;text-transform:uppercase}
.dot{width:10px;height:10px;border-radius:50%;background:var(--cyan);box-shadow:0 0 16px var(--cyan)}
.br{display:flex;align-items:center;gap:14px;font-weight:800;font-size:22px;letter-spacing:-.5px}
.mk{width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,var(--cyan),var(--cyan-dim));display:flex;align-items:center;justify-content:center;color:#0a0a0f;font-weight:900;font-size:20px}
.ls{color:var(--cyan)}
.t{position:relative;font-size:78px;line-height:1.06;font-weight:800;letter-spacing:-1.8px;max-width:1050px}
.b{position:relative;display:flex;justify-content:space-between;align-items:flex-end}
.m{color:var(--ink-60);font-size:18px}
.m strong{color:#fff;font-weight:600;font-size:20px;display:block;margin-bottom:4px}
.u{font-family:ui-monospace,monospace;font-size:18px;color:var(--cyan)}
.s{position:absolute;left:0;bottom:0;width:100%;height:6px;background:linear-gradient(90deg,var(--cyan),var(--cyan-dim) 50%,transparent)}
</style></head><body><div class="card"><div class="grid"></div><div class="glow"></div>
<div class="top"><div class="cat"><span class="dot"></span>$cat</div><div class="br"><div class="mk">C</div><span>Cloud<span class="ls">less</span></span></div></div>
<div class="t">$title</div>
<div class="b"><div class="m"><strong>$author</strong>Cloudless · $rt</div><div class="u">cloudless.gr/blog</div></div>
<div class="s"></div></div></body></html>
HTML

CHROME="$(command -v chromium || command -v chromium-browser || command -v google-chrome)"
[[ -z "$CHROME" ]] && { echo "Install chromium first" >&2; exit 1; }

PNG="$OUT_DIR/$slug.png"
"$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1200,630 --screenshot="$PNG" \
  --virtual-time-budget=2000 "file://$HTML_TMP" 2>/dev/null
rm "$HTML_TMP"

echo "Rendered $PNG ($(stat -c%s "$PNG") bytes)"

# Optional: upload to Postiz if POSTIZ_API_KEY is set
if [[ -n "${POSTIZ_API_KEY:-}" ]]; then
  echo "Uploading to Postiz storage..."
  curl -sS -X POST "${POSTIZ_API_URL:-https://postiz.cloudless.gr}/api/public/v1/upload" \
    -H "Authorization: $POSTIZ_API_KEY" \
    -F "file=@$PNG"
  echo
fi
