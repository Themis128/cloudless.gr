#!/usr/bin/env bash
#
# keycloak-add-profile-attrs.sh — declare `company` and `phone` in the realm's
# declarative user profile so the website personalization page can persist them.
#
# Keycloak 26 only stores attributes that are declared in the user profile; an
# undeclared attribute is silently dropped on write (the Account API returns
# 200/204 but nothing persists). firstName/lastName are built-ins and already
# work; company/phone need declaring with user-edit permission.
#
# Runs on a CI runner with kubectl (the keycloak image has no jq/python, so we
# GET the profile out of the pod, edit it here, and PUT it back via kcadm -f).
set -uo pipefail
NS="${NS:-keycloak}"; DEP="${DEP:-keycloak}"; RL="${RL:-master}"
command -v kubectl >/dev/null 2>&1 || { echo "kubectl not found"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "python3 not found"; exit 1; }
POD=$(kubectl -n "$NS" get pod -l app="$DEP" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
[ -n "$POD" ] || { echo "no $DEP pod"; exit 1; }

# kcadm auth, run inside the pod (admin password never leaves the cluster).
KCAUTH='AU="${KEYCLOAK_ADMIN:-${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}}"; AP="${KEYCLOAK_ADMIN_PASSWORD:-${KC_BOOTSTRAP_ADMIN_PASSWORD:-}}"; /opt/keycloak/bin/kcadm.sh config credentials --server http://localhost:8080 --realm master --user "$AU" --password "$AP" >/dev/null 2>&1 || { echo ADMIN_AUTH=failed; exit 7; }'

echo "== 1) GET current user profile =="
kubectl -n "$NS" exec "$POD" -- bash -c "$KCAUTH; /opt/keycloak/bin/kcadm.sh get users/profile -r $RL" > /tmp/profile.json || { echo "GET failed"; exit 1; }
python3 -c "import json;d=json.load(open('/tmp/profile.json'));print('current attrs:',[a.get('name') for a in d.get('attributes',[])])" || { echo "profile parse failed"; cat /tmp/profile.json; exit 1; }

echo "== 2) ensure company + phone are declared =="
python3 - > /tmp/profile.new.json 2>/tmp/changed <<'PY'
import json, sys
d = json.load(open("/tmp/profile.json"))
attrs = d.setdefault("attributes", [])
names = {a.get("name") for a in attrs}
def mk(name, display):
    return {
        "name": name,
        "displayName": display,
        "permissions": {"view": ["user", "admin"], "edit": ["user", "admin"]},
        "multivalued": False,
        "validations": {},
    }
changed = False
for n, disp in [("phone", "Phone"), ("company", "Company")]:
    if n not in names:
        attrs.append(mk(n, disp)); changed = True
print(json.dumps(d))
sys.stderr.write("CHANGED" if changed else "NOCHANGE")
PY
CHG=$(cat /tmp/changed)
echo "decision: $CHG"
if [ "$CHG" = "NOCHANGE" ]; then
  echo "RESULT=PASS (company + phone already declared)"
  exit 0
fi

echo "== 3) PUT updated profile =="
kubectl -n "$NS" exec -i "$POD" -- bash -c "$KCAUTH; cat > /tmp/p.json; /opt/keycloak/bin/kcadm.sh update users/profile -r $RL -f /tmp/p.json && echo UPDATE_OK || echo UPDATE_FAIL" < /tmp/profile.new.json

echo "== 4) verify =="
kubectl -n "$NS" exec "$POD" -- bash -c "$KCAUTH; /opt/keycloak/bin/kcadm.sh get users/profile -r $RL" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);n=[a.get('name') for a in d.get('attributes',[])];print('final attrs:',n);print('RESULT=PASS' if ('phone' in n and 'company' in n) else 'RESULT=FAIL')"
