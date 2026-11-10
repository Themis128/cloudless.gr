#!/usr/bin/env bash
# verify_testimonials.sh — confirm AppFlowy testimonials render on the live site.
# Usage: .devin/skills/appflowy-testimonials-ops/scripts/verify_testimonials.sh [base_url]
set -euo pipefail
BASE="${1:-https://cloudless.gr}"

echo "== /api/testimonials =="
TMP=$(mktemp -d)
HEADERS=$(mktemp)
trap 'rm -rf "$TMP"; rm -f "$HEADERS"' EXIT
curl -fsS -D "$HEADERS" "$BASE/api/testimonials" -o "$TMP/api.json"
CMS_SOURCE=$(grep -i '^x-cms-source:' "$HEADERS" | tr -d '\r' | awk '{print $2}' | tail -1)
echo "x-cms-source: ${CMS_SOURCE:-<missing>}"
[ "$CMS_SOURCE" = "appflowy" ] || echo "WARNING: API served static fallback, not AppFlowy"
python3 - "$TMP/api.json" <<'PY'
import json,sys
d=json.load(open(sys.argv[1]))
items=d if isinstance(d,list) else d.get("testimonials",d.get("items",[]))
print("count=%d" % len(items))
for t in items:
    print("  - %s | %s | rating=%s | featured=%s" % (
        t.get("name","?"), t.get("company",""), t.get("rating"), t.get("featured")))
PY

echo "== homepage testimonials section =="
curl -fsS "$BASE/en" -o "$TMP/home.html"
grep -q 'data-testid="testimonials-section"' "$TMP/home.html" \
  && echo "section: PRESENT" || echo "section: ABSENT (AppFlowy empty/unreachable — expected fallback)"

echo "== store testimonials =="
curl -fsS "$BASE/en/store" -o "$TMP/store.html"
grep -q "TESTIMONIALS" "$TMP/store.html" && echo "store section: PRESENT"
grep -oE "Marina K\.|Dimitris P\.|Elena T\." "$TMP/store.html" | sort -u | sed 's/^/  fallback-name: /' || true
