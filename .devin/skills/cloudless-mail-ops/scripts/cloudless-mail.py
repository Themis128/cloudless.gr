#!/usr/bin/env python3
"""cloudless-mail — read/search/send for tbaltzakis@cloudless.gr.

The cloudless.gr mailbox is Dovecot Maildir on omv-ha
(/var/mail/vhosts/cloudless.gr/<user>/), reachable only over SSH
(tbaltzakis@100.95.117.84, key ~/.ssh/id_rsa, files need sudo -n).
Outbound mail goes through the mail-outbound Cloudflare worker
(%APPDATA%/devin/secrets/mail-outbound.json) which sends AS
*@cloudless.gr — text only, no attachments (use webmail.cloudless.gr
for those; it sits behind Cloudflare Access).

usage:
  cloudless-mail.py folders [--user tbaltzakis]
  cloudless-mail.py list [FOLDER] [--max N] [--since YYYY-MM-DD] [--user U]
  cloudless-mail.py search [FOLDER|all] TERM [TERM...] [--user U]
      terms: plain substring ANDed; prefix field: e.g. from:x to:x subject:x
  cloudless-mail.py read [FOLDER] SUBSTR [--user U]
      SUBSTR matches the Maildir filename (e.g. the delivery timestamp)
  cloudless-mail.py get [FOLDER] SUBSTR [--att N | --name X] [--out PATH]
      download an attachment from the matched message
  cloudless-mail.py send --to A --subject S (--body TEXT | --body-file F)
      [--cc A,B] [--category C] [--user U]

FOLDER names are case-insensitive; INBOX = root cur/new, others are the
dot-folders (.Sent -> Sent, .Drafts -> Drafts, .Trash -> Trash, .Junk -> Junk,
.Heartbeat -> Heartbeat). Omit FOLDER in list/search/read to cover all.
"""

import argparse
import base64
import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

SSH = [
    "ssh",
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=10",
    "-i",
    os.path.expanduser("~/.ssh/id_rsa"),
    "tbaltzakis@100.95.117.84",
]
KEYS = os.path.join(os.environ.get("APPDATA", ""), "devin", "secrets")

REMOTE = r"""
import sys, os, json, email, email.policy, time, base64

BASE = '/var/mail/vhosts/cloudless.gr'
SKIP_PREFIX = ('dovecot',)
SKIP_NAMES = {'sieve','subscriptions','tmp','maildirfolder','.','..'}

def folders(user):
    root = os.path.join(BASE, user)
    res = {'INBOX': root}
    try:
        for name in sorted(os.listdir(root)):
            p = os.path.join(root, name)
            if name in SKIP_NAMES or name.startswith(SKIP_PREFIX):
                continue
            if name.startswith('.') and os.path.isdir(p):
                res[name[1:]] = p
    except OSError:
        pass
    return res

def iter_msgs(fdir):
    for sub in ('cur', 'new'):
        sd = os.path.join(fdir, sub)
        try:
            names = os.listdir(sd)
        except OSError:
            continue
        for fn in names:
            yield os.path.join(sd, fn)

def hdr(msg, k):
    return str(msg.get(k) or '')

def body_text(msg, limit):
    for p in msg.walk():
        if p.get_content_type() == 'text/plain' and not p.get_filename():
            try:
                return p.get_content()[:limit]
            except Exception:
                pass
    for p in msg.walk():
        if p.get_content_type() == 'text/html' and not p.get_filename():
            try:
                return p.get_content()[:limit]
            except Exception:
                pass
    return ''

def attachments(msg):
    out = []
    for p in msg.walk():
        fn = p.get_filename()
        if fn or (p.get_content_disposition() == 'attachment'):
            payload = p.get_payload(decode=True) or b''
            out.append({'name': fn or p.get_content_type(),
                        'mime': p.get_content_type(),
                        'size': len(payload)})
    return out

def parse(path):
    try:
        raw = open(path, 'rb').read()
    except OSError:
        return None
    msg = email.message_from_bytes(raw, policy=email.policy.default)
    try:
        mt = os.path.getmtime(path)
    except OSError:
        mt = 0
    return {
        'file': os.path.basename(path),
        'path': path,
        'mtime': mt,
        'date': hdr(msg, 'Date'),
        'from': hdr(msg, 'From'),
        'to': hdr(msg, 'To'),
        'cc': hdr(msg, 'Cc'),
        'subject': hdr(msg, 'Subject'),
        'message_id': hdr(msg, 'Message-ID'),
        'in_reply_to': hdr(msg, 'In-Reply-To'),
        'size': len(raw),
        'body': body_text(msg, 8000),
        'attachments': attachments(msg),
    }

def match_terms(m, terms):
    hay = {'from': m['from'], 'to': m['to'] + ' ' + m['cc'],
           'subject': m['subject'], 'body': m['body'],
           'any': ' '.join([m['from'], m['to'], m['cc'], m['subject'], m['body']])}
    for t in terms:
        if ':' in t:
            field, val = t.split(':', 1)
            if field not in hay:
                field, val = 'any', t
        else:
            field, val = 'any', t
        if val.lower() not in hay[field].lower():
            return False
    return True

def since_ts(s):
    # accept YYYY-MM-DD or epoch
    try:
        return float(s)
    except ValueError:
        pass
    for fmt in ('%Y-%m-%d', '%Y-%m-%d %H:%M'):
        try:
            import datetime
            return time.mktime(datetime.datetime.strptime(s, fmt).timetuple())
        except ValueError:
            continue
    return 0

def main():
    args = sys.argv[1:]
    cmd = args.pop(0)
    user = 'tbaltzakis'
    if '--user' in args:
        i = args.index('--user'); user = args[i+1]; del args[i:i+2]
    if not user or '..' in user or not all(c.isalnum() or c in '._-' for c in user):
        print(json.dumps({'error': 'invalid user'}))
        sys.exit(2)
    fdirs = folders(user)
    low = {k.lower(): k for k in fdirs}

    def resolve(folder):
        if not folder or folder.lower() in ('all', '*'):
            return list(fdirs.items())
        k = low.get(folder.lower())
        if not k:
            print(json.dumps({'error': 'unknown folder', 'folders': sorted(fdirs)}))
            sys.exit(2)
        return [(k, fdirs[k])]

    if cmd == 'folders':
        out = {}
        for name, d in fdirs.items():
            out[name] = len(list(iter_msgs(d)))
        print(json.dumps(out, indent=2))
        return

    maxn = 20
    since = 0
    att_sel = None
    att_name = None
    positional = []
    it = iter(args)
    for a in it:
        if a == '--max':
            maxn = int(next(it))
        elif a == '--since':
            since = since_ts(next(it))
        elif a == '--att':
            att_sel = next(it)
        elif a == '--name':
            att_name = next(it)
        else:
            positional.append(a)

    if cmd == 'list':
        folder = positional[0] if positional else None
        rows = []
        for name, d in resolve(folder):
            msgs = []
            for p in iter_msgs(d):
                m = parse(p)
                if m:
                    msgs.append(m)
            msgs.sort(key=lambda m: m['mtime'], reverse=True)
            for m in msgs[:maxn]:
                if since and m['mtime'] < since:
                    continue
                rows.append({'folder': name, 'date': m['date'], 'from': m['from'],
                             'to': m['to'], 'subject': m['subject'],
                             'size': m['size'], 'attachments': m['attachments'],
                             'file': m['file']})
        print(json.dumps(rows, indent=2, ensure_ascii=False))
        return

    if cmd == 'search':
        folder = positional[0] if positional else 'all'
        terms = positional[1:]
        if folder.lower() in ('all', '*') or not terms:
            if not terms:
                terms = positional
                folder = 'all'
        hits = []
        for name, d in resolve(folder):
            for p in iter_msgs(d):
                m = parse(p)
                if m and (not since or m['mtime'] >= since) and match_terms(m, terms):
                    m['folder'] = name
                    hits.append(m)
        hits.sort(key=lambda m: m['mtime'], reverse=True)
        hits = hits[:maxn]
        for m in hits:
            m.pop('path', None)
        print(json.dumps(hits, indent=2, ensure_ascii=False))
        return

    if cmd == 'read':
        folder = positional[0] if len(positional) > 1 else None
        substr = positional[-1] if positional else ''
        found = []
        for name, d in resolve(folder):
            for p in iter_msgs(d):
                if substr.lower() in os.path.basename(p).lower():
                    m = parse(p)
                    if m:
                        m['folder'] = name
                        found.append(m)
        if not found:
            print(json.dumps({'error': 'not found', 'substr': substr}))
            sys.exit(2)
        found.sort(key=lambda m: m['mtime'], reverse=True)
        found[0].pop('path', None)
        print(json.dumps(found[0], indent=2, ensure_ascii=False))
        return

    if cmd == 'getatt':
        folder = positional[0] if len(positional) > 1 else None
        substr = positional[-1] if positional else ''
        cands = []
        for name, d in resolve(folder):
            for p in iter_msgs(d):
                if substr.lower() in os.path.basename(p).lower():
                    cands.append((os.path.getmtime(p), p))
        if not cands:
            print(json.dumps({'error': 'message not found', 'substr': substr}))
            sys.exit(2)
        p = max(cands)[1]
        raw = open(p, 'rb').read()
        msg = email.message_from_bytes(raw, policy=email.policy.default)
        parts = []
        for part in msg.walk():
            fn = part.get_filename()
            if fn or part.get_content_disposition() == 'attachment':
                payload = part.get_payload(decode=True) or b''
                parts.append({'name': fn or part.get_content_type(),
                              'mime': part.get_content_type(),
                              'b64': base64.b64encode(payload).decode()})
        if att_sel is not None:
            try:
                chosen = parts[int(att_sel)]
            except (ValueError, IndexError):
                print(json.dumps({'error': 'bad --att index',
                                  'count': len(parts)}))
                sys.exit(2)
        elif att_name:
            chosen = next((x for x in parts
                           if att_name.lower() in x['name'].lower()), None)
            if not chosen:
                print(json.dumps({'error': 'attachment not found',
                                  'names': [x['name'] for x in parts]}))
                sys.exit(2)
        elif len(parts) == 1:
            chosen = parts[0]
        else:
            print(json.dumps({'error': 'multiple attachments, pick one',
                              'names': [x['name'] for x in parts]}))
            sys.exit(2)
        print(json.dumps({'name': chosen['name'], 'mime': chosen['mime'],
                          'size': len(base64.b64decode(chosen['b64'])),
                          'b64': chosen['b64']}, ensure_ascii=False))
        return

    print(json.dumps({'error': 'unknown command', 'cmd': cmd}))
    sys.exit(2)

main()
"""


def remote(*args):
    r = subprocess.run(
        SSH + ["sudo", "-n", "python3", "-"] + list(args),
        input=REMOTE.encode(),
        capture_output=True,
        timeout=120,
    )
    if r.returncode != 0:
        sys.stderr.write(r.stderr.decode("utf-8", "replace"))
        # remote script reports errors as JSON on stdout — keep it in the
        # exception so MCP callers see the structured error, not just exit code
        detail = r.stdout.decode("utf-8", "replace").strip()
        raise RuntimeError(detail[:500] or f"remote exited {r.returncode}")
    return r.stdout.decode("utf-8", "replace")


def cmd_folders(a):
    print(remote("folders", "--user", a.user))


def cmd_list(a):
    args = []
    if a.folder:
        args.append(a.folder)
    args += ["--max", str(a.max)]
    if a.since:
        args += ["--since", a.since]
    args += ["--user", a.user]
    print(remote("list", *args))


def cmd_search(a):
    args = [a.folder] + a.terms + ["--user", a.user]
    if a.since:
        args += ["--since", a.since]
    if a.max:
        args += ["--max", str(a.max)]
    print(remote("search", *args))


def cmd_read(a):
    args = ([a.folder] if a.folder else []) + [a.substr, "--user", a.user]
    print(remote("read", *args))


def cmd_get(a):
    args = ([a.folder] if a.folder else []) + [a.substr, "--user", a.user]
    if a.att is not None:
        args += ["--att", str(a.att)]
    if a.name:
        args += ["--name", a.name]
    out = json.loads(remote("getatt", *args))
    if "b64" not in out:
        print(json.dumps(out, ensure_ascii=False))
        sys.exit(2)
    # attachment names come from remote mail — sanitize to basename so a
    # crafted name can't traverse outside the cwd when --out is omitted
    raw_name = out.get("name") or "attachment.bin"
    dest = a.out or os.path.basename(raw_name.replace("\\", "/"))
    if dest in ("", ".", ".."):
        dest = "attachment.bin"
    with open(dest, "wb") as f:
        f.write(base64.b64decode(out["b64"]))
    print(
        json.dumps(
            {
                "saved": os.path.abspath(dest),
                "name": out["name"],
                "mime": out["mime"],
                "size": out["size"],
            },
            ensure_ascii=False,
        )
    )


def _smtp_fallback(a, body):
    """Send via omv-ha postfix sendmail when the CF worker can't reach
    external recipients (send_email 502s on non-@cloudless.gr addresses).
    Uses the localhost relay — same path webmail/Roundcube takes."""
    from email.mime.text import MIMEText
    from email.utils import formatdate

    msg = MIMEText(body, "plain", "utf-8")
    msg["From"] = a.user + "@cloudless.gr"
    msg["To"] = a.to
    if a.cc:
        msg["Cc"] = a.cc
    msg["Subject"] = a.subject
    msg["Date"] = formatdate(localtime=True)
    r = subprocess.run(
        SSH + ["/usr/sbin/sendmail -t -i"],
        input=msg.as_bytes(),
        capture_output=True,
        timeout=60,
    )
    if r.returncode != 0:
        raise RuntimeError("sendmail fallback failed: " + r.stderr.decode("utf-8", "replace")[:300])
    print(json.dumps({"ok": True, "via": "omv-ha-postfix"}))


def cmd_send(a):
    cfg = json.load(open(os.path.join(KEYS, "mail-outbound.json")))
    body = a.body
    if a.body_file:
        body = open(a.body_file, encoding="utf-8").read()
    payload = {"to": a.to, "subject": a.subject, "text": body, "category": a.category}
    if a.cc:
        payload["cc"] = a.cc
    req = urllib.request.Request(
        cfg["url"],
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + cfg["token"],
            "Content-Type": "application/json",
            "User-Agent": "cloudless-mail/1.0",
        },
    )
    try:
        print(urllib.request.urlopen(req, timeout=30).read().decode())
    except urllib.error.HTTPError as e:
        if e.code in (502, 503):
            # worker's send_email binding only reaches @cloudless.gr —
            # external recipients need the postfix relay on omv-ha
            sys.stderr.write(f"worker {e.code}, falling back to omv-ha SMTP\n")
            _smtp_fallback(a, body)
        else:
            raise


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    p = argparse.ArgumentParser(prog="cloudless-mail")
    sub = p.add_subparsers(dest="cmd", required=True)

    def user_arg(sp):
        sp.add_argument(
            "--user",
            default="tbaltzakis",
            help="mailbox user under /var/mail/vhosts/cloudless.gr",
        )

    sp = sub.add_parser("folders")
    user_arg(sp)
    sp.set_defaults(f=cmd_folders)

    sp = sub.add_parser("list")
    user_arg(sp)
    sp.add_argument("folder", nargs="?")
    sp.add_argument("--max", type=int, default=20)
    sp.add_argument("--since", help="YYYY-MM-DD or epoch")
    sp.set_defaults(f=cmd_list)

    sp = sub.add_parser("search")
    user_arg(sp)
    sp.add_argument("folder", nargs="?", default="all")
    sp.add_argument("terms", nargs="+")
    sp.add_argument("--max", type=int, default=20)
    sp.add_argument("--since")
    sp.set_defaults(f=cmd_search)

    sp = sub.add_parser("read")
    user_arg(sp)
    sp.add_argument("folder", nargs="?")
    sp.add_argument("substr")
    sp.set_defaults(f=cmd_read)

    sp = sub.add_parser("get")
    user_arg(sp)
    sp.add_argument("folder", nargs="?")
    sp.add_argument("substr", help="Maildir filename fragment (e.g. timestamp)")
    sp.add_argument("--att", type=int, help="attachment index (0-based)")
    sp.add_argument("--name", help="attachment filename substring")
    sp.add_argument("--out", help="output path (default: attachment filename)")
    sp.set_defaults(f=cmd_get)

    sp = sub.add_parser("send")
    sp.add_argument("--to", required=True)
    sp.add_argument("--subject", required=True)
    sp.add_argument("--body")
    sp.add_argument("--body-file")
    sp.add_argument("--cc")
    sp.add_argument("--category", default="ops-alert")
    sp.add_argument("--user", default="tbaltzakis")
    sp.set_defaults(f=cmd_send)

    a = p.parse_args()
    if a.cmd == "send" and not (a.body or a.body_file):
        p.error("send needs --body or --body-file")
    try:
        a.f(a)
    except RuntimeError as e:
        sys.stderr.write(str(e) + "\n")
        sys.exit(1)


if __name__ == "__main__":
    main()
