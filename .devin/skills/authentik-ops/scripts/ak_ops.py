#!/usr/bin/env python3
"""authentik ops — one entrypoint for the omv k3s IdP.
SSHes to omv (tbaltzakis@100.74.191.58, ~/.ssh/id_rsa_win) and drives the
authentik REST API. Subcommands: status, add, env-token, outposts, health."""

import base64
import json
import subprocess
import sys
import urllib.error
import urllib.request

AK = "http://192.168.1.128:30910"
SSH = [
    "ssh",
    "-i",
    "~/.ssh/id_rsa_win",
    "-o",
    "StrictHostKeyChecking=no",
    "-o",
    "ConnectTimeout=10",
    "tbaltzakis@100.74.191.58",
]


def omv(cmd: str) -> str:
    return subprocess.run(SSH + [cmd], capture_output=True, text=True, timeout=60).stdout.strip()


def api_key() -> str:
    raw = omv(
        "sudo kubectl get secret authentik-secret -n authentik -o jsonpath='{.data.ops-api-token}'"
    )
    return base64.b64decode(raw).decode()


def api(method: str, path: str, body=None, key=None):
    h = {"Content-Type": "application/json", "Authorization": f"Bearer {key}"}
    r = urllib.request.Request(AK + path, headers=h, method=method)
    if body is not None:
        r.data = json.dumps(body).encode()
    try:
        return json.load(urllib.request.urlopen(r, timeout=25))
    except urllib.error.HTTPError as e:
        print(f"{method} {path} -> {e.code} {e.read()[:200]}")
        return {}


def remote_py(script: str) -> str:
    """Run a python snippet on omv (reaches 192.168.1.128:30910)."""
    import base64 as b64

    enc = b64.b64encode(script.encode()).decode()
    return omv(f"python3 -c \"import base64;exec(base64.b64decode('{enc}'))\"")


def flows(key):
    f = api("GET", "/api/v3/flows/instances/?designation=authorization&search=provider", key=key)
    inv = api("GET", "/api/v3/flows/instances/?designation=invalidation&search=provider", key=key)
    return f["results"][0]["pk"], inv["results"][0]["pk"]


def cmd_status(key):
    print(
        remote_py(f"""
import urllib.request,json
try:
    urllib.request.urlopen('{AK}/-/health/ready/',timeout=10)
    print('authentik: READY')
except Exception as e: print('authentik: DOWN',e)
""")
    )
    outs = api("GET", "/api/v3/outposts/instances/?type=proxy&page_size=50", key=key).get(
        "results", []
    )
    for o in outs:
        print(f"outpost {o['name']}: {len(o.get('providers') or [])} providers")
    provs = api("GET", "/api/v3/providers/proxy/?page_size=100", key=key).get("results", [])
    for p in provs:
        print(f"  {p['name']} -> {p.get('internal_host')}")


def cmd_outposts(key):
    for o in api("GET", "/api/v3/outposts/instances/?page_size=50", key=key).get("results", []):
        print(f"{o['name']} [{o.get('type')}] providers={o.get('providers')}")


def cmd_health():
    print(omv("sudo kubectl get pods -n authentik --no-headers | awk '{print $1,$3,$4}'"))
    print(omv("sudo kubectl top pods -n authentik 2>/dev/null"))


def cmd_env_token():
    # pull the token via ak shell on omv
    print(
        omv(
            'sudo kubectl exec -n authentik deploy/authentik-server -- ak shell -c "'
            "from authentik.core.models import Token\n"
            "for t in Token.objects.filter(identifier__startswith='ak-outpost'):\n"
            " print(t.identifier, t.key)\n\" 2>/dev/null | grep -v '###\\|objects imported'"
        )
    )


def cmd_add(key, side, host, internal):
    slug = host.split(".")[0].replace("-", "_")
    fl, inv = flows(key)
    p = api(
        "POST",
        "/api/v3/providers/proxy/",
        {
            "name": host,
            "authorization_flow": fl,
            "invalidation_flow": inv,
            "external_host": f"https://{host}",
            "internal_host": internal,
            "mode": "proxy",
            "cookie_domain": "cloudless.gr",
            "internal_host_ssl_validation": False,
        },
        key=key,
    )
    if not p.get("pk"):
        return print("provider create failed")
    api(
        "POST",
        "/api/v3/core/applications/",
        {"name": slug, "slug": slug, "provider": p["pk"], "policy_engine_mode": "any"},
        key=key,
    )
    outs = api("GET", "/api/v3/outposts/instances/?type=proxy&page_size=50", key=key).get(
        "results", []
    )
    target = "embedded" if side == "omv" else "cu130"
    o = next((x for x in outs if target in x.get("name", "").lower()), None)
    if o:
        api(
            "PATCH",
            f"/api/v3/outposts/instances/{o['pk']}/",
            {"providers": list(set(list(o.get("providers") or []) + [p["pk"]]))},
            key=key,
        )
    print(f"{host} gated via {target} outpost -> {internal}")
    print(
        f"point tunnel {host} -> http://{'192.168.1.128:30910' if side == 'omv' else 'authentik-outpost:9000'} + DNS CNAME"
    )


def cmd_act_add(key, slug, name, url):
    # launch_url alone doesn't persist — needs meta_launch_url set via PUT too
    body = {"slug": slug, "name": name, "open_in_new_tab": True, "policy_engine_mode": "any"}
    r = api("POST", "/api/v3/core/applications/", body, key=key)
    if not r.get("pk"):
        return print("failed")
    app = api("GET", f"/api/v3/core/applications/{slug}/", key=key)
    app["launch_url"] = app["meta_launch_url"] = url
    api(
        "PUT",
        f"/api/v3/core/applications/{slug}/",
        {k: v for k, v in app.items() if k != "pk"},
        key=key,
    )
    print(f"launcher '{slug}' -> {url}")


def cmd_act_list(key):
    for a in api("GET", "/api/v3/core/applications/?page_size=100", key=key).get("results", []):
        if not a.get("provider"):
            print(
                f"  {a['slug']:20} {a['name']:40} {(a.get('launch_url') or a.get('meta_launch_url') or '')[:50]}"
            )


def cmd_act_rm(key, slug):
    r = api("GET", f"/api/v3/core/applications/{slug}/", key=key)
    if r.get("pk"):
        api("DELETE", f"/api/v3/core/applications/{slug}/", key=key)
        print(f"removed {slug}")
    else:
        print(f"{slug} not found")


def cmd_recovery(key):
    """Finish the recovery flow: password prompt stage at order 2 + verify all bindings."""
    fl = api("GET", "/api/v3/flows/instances/cloudless-recovery/", key=key)
    if not fl.get("pk"):
        return print("recovery flow missing")
    binds = api("GET", f"/api/v3/flows/bindings/?target={fl['pk']}&page_size=50", key=key).get(
        "results", []
    )
    orders = {b["order"] for b in binds}
    if 2 not in orders:
        # create password prompt field + stage via ORM (API field pk not exposed)
        out = remote_py("""
import subprocess
print(subprocess.run(['sudo','kubectl','exec','-n','authentik','deploy/authentik-server','--','ak','shell','-c',
'from authentik.stages.prompt.models import Prompt, PromptStage, FieldTypes\n'
'from authentik.flows.models import Flow, FlowStageBinding\n'
'pw,_=Prompt.objects.get_or_create(field_key=\\'password\\',defaults={\\'label\\':\\'New password\\',\\'type\\':FieldTypes.PASSWORD,\\'required\\':True})\n'
'st,_=PromptStage.objects.get_or_create(name=\\'recovery-password\\')\n'
'st.fields.add(pw)\n'
'FlowStageBinding.objects.get_or_create(target=Flow.objects.get(slug=\\'cloudless-recovery\\'),stage=st,order=2)\n'
'print(\\'bound\\')'],capture_output=True,text=True).stdout[-200:])
""")
        print(out.strip()[-120:])
    else:
        print("password stage already bound")
    print("recovery:", [(b["order"], b["stage"]) for b in binds])


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        return
    cmd = args[0]
    key = api_key()
    if cmd == "status":
        cmd_status(key)
    elif cmd == "outposts":
        cmd_outposts(key)
    elif cmd == "health":
        cmd_health()
    elif cmd == "env-token":
        cmd_env_token()
    elif cmd == "add" and len(args) == 4:
        cmd_add(key, args[1], args[2], args[3])
    elif cmd == "recovery":
        cmd_recovery(key)
    elif cmd == "act" and len(args) >= 2:
        sub = args[1]
        if sub == "add" and len(args) == 5:
            cmd_act_add(key, args[2], args[3], args[4])
        elif sub == "list":
            cmd_act_list(key)
        elif sub == "rm" and len(args) == 3:
            cmd_act_rm(key, args[2])
        else:
            print("usage: ak_ops.py act add <slug> <name> <url> | list | rm <slug>")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
