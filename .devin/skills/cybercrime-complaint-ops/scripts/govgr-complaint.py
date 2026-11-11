#!/usr/bin/env python3
"""Drive the gov.gr «Καταγγελίες για εγκλήματα κυβερνοχώρου» wizard over CDP.

Requires the debug Chrome on :9229 with an authenticated dilosi.services.gov.gr
session (TAXISnet/GSIS login done — see gsis-login-ops). The wizard is a
server-side state machine: completed steps redirect forward to /preview/, so
fields cannot be edited after Συνέχεια. This script walks create -> preview and
STOPS before the final submit unless --submit --confirm-submission is passed.

Usage:
  python govgr-complaint.py --config complaint.json            # fill + preview
  python govgr-complaint.py --config complaint.json --submit --confirm-submission

complaint.json example:
{
  "category_label": "Παραβίαση απορρήτου των ηλεκτρονικών και τηλεφωνικών επικοινωνιών",
  "description": "...",
  "suspect": {"suspect_full_name": "...", "suspect_email": "..."},
  "attachments": ["C:/path/a.pdf", "C:/path/b.pdf"]
}

Gotchas encoded here (learned 2026-11-11):
- React-style fields ignore el.value=...; must use the native prototype setter
  + input/change events, else «Το πεδίο είναι υποχρεωτικό» on submit.
- File inputs need fresh DOM nodeIds via DOM.getDocument + DOM.querySelector,
  then DOM.setFileInputFiles (paths must be Windows-style for setFileInputFiles).
- Session timer ~20 min; «Ανανέωση Χρόνου» button renews it.
- /preview/ is read-only; the only forward action is «Συνέχεια» (terms -> submit).
- Personal data (AFM, address, postal code) comes from the gov.gr profile and is
  NOT editable on this wizard — verify on the preview page instead.
"""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time

sys.path.insert(0, r"C:\Users\tbaltzakis\AppData\Roaming\devin\skills\gmail-telegram-watch\scripts")
from cdp import Tab, find_page, open_tab  # noqa: E402

ADB = r"C:\Users\tbaltzakis\AppData\Local\Android\Sdk\platform-tools\adb.exe"
BASE = "https://dilosi.services.gov.gr"
CREATE_URL = BASE + "/templates/KATHLEG/create"
ISSUE_RE = "/issue/"


def connect():
    t = find_page("dilosi.services.gov.gr")
    if not t:
        t = open_tab(CREATE_URL)
        time.sleep(5)
        t = find_page("dilosi.services.gov.gr")
    if not t:
        sys.exit("no dilosi.services.gov.gr tab on :9229 — is debug Chrome running?")
    return Tab(t["webSocketDebuggerUrl"])


def url(tab):
    return tab.js("location.href") or ""


def body(tab, n=400):
    return tab.js(f"document.body.innerText.slice(0,{n})") or ""


def click_text(tab, text, tags="button,a,[role=button],[role=link],input[type=submit]"):
    return tab.click_text(text, tags)


def click_continue(tab):
    """JS-click the «Συνέχεια» button. Returns True if a button was found."""
    return bool(
        tab.js(
            """(()=>{const b=[...document.querySelectorAll('button')]
.find(e=>e.textContent.trim()==='Συνέχεια'&&!e.disabled);
if(!b)return false;b.click();return true})()"""
        )
    )


def click_any(tab, labels):
    """JS-click first matching button text from labels. Returns label or None."""
    js = f"""(()=>{{const labels={json.dumps(labels, ensure_ascii=False)};
const bs=[...document.querySelectorAll('button,input[type=submit],a')];
for(const l of labels){{const b=bs.find(e=>(e.textContent||e.value||'').trim()===l&&!e.disabled);
 if(b){{b.click();return l}}}}return null}})()"""
    return tab.js(js)


def wait_step(tab, substr, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        if substr in url(tab):
            return True
        time.sleep(1)
    return False


def adb_devices():
    out = subprocess.run([ADB, "devices"], capture_output=True, text=True).stdout
    return [ln.split()[0] for ln in out.splitlines() if "\tdevice" in ln]


def sms_otp(sender="GOVGR", digits=6, wait=90):
    """Poll adb SMS inbox for an OTP from sender newer than call start.

    Rows arrive sorted by date DESC, but the newest match could still be a
    stale code from a previous submission — only accept SMS whose `date`
    (epoch millis) is at most 2 minutes older than this call.
    """
    since_ms = int(time.time() * 1000)
    end = time.time() + wait
    while time.time() < end:
        for dev in adb_devices():
            try:
                out = subprocess.run(
                    [
                        ADB,
                        "-s",
                        dev,
                        "shell",
                        "content query --uri content://sms/inbox "
                        "--projection address,body,date --sort 'date DESC'",
                    ],
                    capture_output=True,
                    text=True,
                    timeout=20,
                ).stdout
            except Exception:
                continue
            for row in re.split(r"(?=Row: \d+ )", out):
                if sender not in row:
                    continue
                m_date = re.search(r"\bdate=(\d+)", row)
                if not m_date or int(m_date.group(1)) < since_ms - 120_000:
                    continue
                m = re.search(r"\baddress=([^,\s]+)", row)
                if not m or sender not in m.group(1):
                    continue
                m = re.search(rf"\b(\d{{{digits}}})\b", row)
                if m:
                    return m.group(1)
        time.sleep(5)
    return None


def handle_otp(tab, sender="GOVGR"):
    """If on /otp/, fetch SMS code via adb, fill confirmation_code, confirm."""
    if "/otp/" not in url(tab):
        return False
    print("OTP step — polling SMS via adb for sender", sender)
    code = sms_otp(sender)
    if not code:
        print("!! no OTP SMS received")
        return False
    print("OTP:", code)
    tab.js(
        f"""(()=>{{const e=document.querySelector('[name=confirmation_code]');
if(!e)return 'nf';
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
s.call(e,{json.dumps(code)});
e.dispatchEvent(new Event('input',{{bubbles:true}}));
e.dispatchEvent(new Event('change',{{bubbles:true}}));
return e.value}})()"""
    )
    tab.js(
        """(()=>{const b=[...document.querySelectorAll('button')]
.find(e=>e.textContent.trim()==='Επιβεβαίωση');if(b){b.click();return 'ok'}return 'nf'})()"""
    )
    time.sleep(8)
    return "/done" in url(tab)


def done_receipt(tab, out_pdf):
    """On /done/ page: extract doc code + issue id, download receipt PDF."""
    u = url(tab)
    m = re.search(r"/dilosi/(\d+)/done", u)
    issue = m.group(1) if m else ""
    txt = tab.js("document.body.innerText") or ""
    code = ""
    mc = re.search(r"Κωδικός επαλήθευσης\s*\n\s*([A-Za-z0-9_\-]+)", txt)
    if mc:
        code = mc.group(1)
    issued = ""
    mi = re.search(r"Ημερομηνία έκδοσης εγγράφου gov\.gr\s*\n\s*(\S+ \S+)", txt)
    if mi:
        issued = mi.group(1)
    print(f"DONE issue={issue} code={code} issued={issued}")

    # find the «Αποθήκευση» pdf-download link and pull it as base64
    href = tab.js(
        """(()=>{const a=[...document.querySelectorAll('a')]
.find(e=>(e.textContent||'').trim()==='Αποθήκευση'&&e.href.includes('pdf-download'));
return a?a.href:null})()"""
    )
    if href and out_pdf:
        expr = f"""fetch('{href}',{{credentials:'include'}}).then(async r=>{{
const b=await r.arrayBuffer();const u=new Uint8Array(b);let s='';
for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));
return r.status+'|'+btoa(s)}})"""
        r = tab.cmd(
            "Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True}
        )
        v = r.get("result", {}).get("value", "")
        if "|" in v:
            status, b64 = v.split("|", 1)
            data = base64.b64decode(b64)
            out_dir = os.path.dirname(out_pdf)
            if out_dir:
                os.makedirs(out_dir, exist_ok=True)
            open(out_pdf, "wb").write(data)
            print(f"receipt saved: {out_pdf} ({len(data)} bytes, HTTP {status})")
    return {"issue": issue, "code": code, "issued": issued, "url": u}


def set_fields(tab, mapping):
    """Set input/textarea values via native setters + events. Returns count."""
    js = f"""(()=>{{
const v={json.dumps(mapping, ensure_ascii=False)};let n=0;
for(const[name,val]of Object.entries(v)){{
 const e=document.querySelector('[name="'+name+'"]');
 if(!e)continue;
 const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;
 const s=Object.getOwnPropertyDescriptor(proto.prototype,'value').set;
 s.call(e,val);
 e.dispatchEvent(new Event('input',{{bubbles:true}}));
 e.dispatchEvent(new Event('change',{{bubbles:true}}));
 e.dispatchEvent(new Event('blur',{{bubbles:true}}));
 n++;}}
return n}})()"""
    return tab.js(js)


def attach_files(tab, paths):
    """Attach files to attachment_1..N inputs via DOM.setFileInputFiles."""
    doc = tab.cmd("DOM.getDocument", {"depth": -1})
    root = doc["root"]["nodeId"]
    ok = []
    for i, path in enumerate(paths, 1):
        name = f"attachment_{i}"
        q = tab.cmd("DOM.querySelector", {"nodeId": root, "selector": f'[name="{name}"]'})
        if "nodeId" not in q:
            print(f"  ! {name} input not found")
            continue
        tab.cmd("DOM.setFileInputFiles", {"files": [path], "nodeId": q["nodeId"]})
        ok.append(name)
    time.sleep(2)
    check = tab.js(
        "JSON.stringify(Array.from(document.querySelectorAll('input[type=file]'))"
        ".map(i=>i.files.length?i.files[0].name:'EMPTY'))"
    )
    print("  files:", check)
    return ok


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--submit", action="store_true")
    ap.add_argument("--confirm-submission", action="store_true")
    ap.add_argument(
        "--fresh", action="store_true", help="start a new draft even if on a wizard step"
    )
    ap.add_argument(
        "--receipt-out", default="", help="path to save the issued-document PDF receipt"
    )
    ap.add_argument("--otp-sender", default="GOVGR", help="SMS sender address to poll for OTP")
    args = ap.parse_args()

    cfg = json.load(open(args.config, encoding="utf-8"))
    tab = connect()

    if args.fresh or ("templates/KATHLEG/create" not in url(tab) and "/issue/" not in url(tab)):
        tab.cmd("Page.navigate", {"url": CREATE_URL})
        time.sleep(6)

    print("step:", url(tab))

    # walk the wizard until the kataggelia form or preview.
    # el.click() via JS is used everywhere — CDP mouse clicks proved unreliable
    # on this SPA (they did not advance the identity step in testing).
    for _ in range(8):
        u = url(tab)
        if "/kataggelia/" in u or "/preview/" in u:
            break

        if "templates/KATHLEG/create" in u:
            pass  # identity confirm — plain continue
        elif "/id_verification/" in u:
            # Profile-prefilled fields show values but the framework state is
            # empty («Το πεδίο είναι υποχρεωτικό»). Re-dispatch every editable
            # field's current value through the native setter + events.
            n = tab.js(
                """(()=>{let n=0;
for(const e of document.querySelectorAll('input:not([readonly]):not([disabled])')){
 if(!e.name||!e.value)continue;
 const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
 s.call(e,e.value);
 e.dispatchEvent(new Event('input',{bubbles:true}));
 e.dispatchEvent(new Event('change',{bubbles:true}));
 e.dispatchEvent(new Event('blur',{bubbles:true}));n++;}
return n})()"""
            )
            print("id_verification fields re-dispatched:", n)
        elif "/eidos_kataggelias/" in u:
            label = cfg.get("category_label", "")
            hit = tab.js(
                f"""(()=>{{const want={json.dumps(label, ensure_ascii=False)};
const s=document.querySelector('select[name=complaint_type]')
       ||document.querySelector('select');
if(!s)return 'no-select';
const opt=[...s.options].find(o=>o.textContent.includes(want));
if(!opt)return 'no-option:'+want.slice(0,40);
const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;
set.call(s,opt.value);
s.dispatchEvent(new Event('input',{{bubbles:true}}));
s.dispatchEvent(new Event('change',{{bubbles:true}}));
return opt.value+' '+opt.textContent.trim().slice(0,60)}})()"""
            )
            print("category:", hit)
            if not hit or hit.startswith("no-"):
                sys.exit("category selection failed: " + str(hit))
        # id_verification / contact_info / eidos — just continue

        before = u
        ok = click_continue(tab)
        # id_verification can fail validation on first pass; retry once
        if ok is False or url(tab) == before:
            time.sleep(2)
            ok = click_continue(tab)
        time.sleep(5)
        print("step:", url(tab))
        if url(tab) == before and ok is False:
            print("!! wizard did not advance; body:", body(tab, 500))
            sys.exit(2)

    if "/kataggelia/" not in url(tab):
        print("!! did not reach kataggelia form; current:", url(tab))
        print(body(tab, 800))
        sys.exit(2)

    # 3) fill description + suspect fields
    fields = {"details": cfg["description"]}
    fields.update(cfg.get("suspect", {}))
    n = set_fields(tab, fields)
    print(f"fields set: {n}")

    # optional extra fields (postcode fix etc.) if provided
    if cfg.get("extra_fields"):
        print("extra:", set_fields(tab, cfg["extra_fields"]))

    # 4) attachments
    atts = [p.replace("/", "\\") for p in cfg.get("attachments", [])]
    if atts:
        attach_files(tab, atts)

    # 5) advance to preview
    if not click_continue(tab):
        print("!! no Συνέχεια button on kataggelia form")
        sys.exit(3)
    time.sleep(6)
    print("preview:", url(tab))
    print(body(tab, 2500))

    if "/preview/" not in url(tab):
        print("!! did not reach preview")
        sys.exit(3)

    # 6) submit gate — NEVER without both flags
    if args.submit and args.confirm_submission:
        print("!! SUBMITTING — final legal act")
        click_continue(tab)
        time.sleep(6)
        # preview -> terms -> otp -> done; click through whatever appears
        for _ in range(4):
            u = url(tab)
            if "/done" in u:
                break
            if "/otp/" in u:
                if not handle_otp(tab, args.otp_sender):
                    break
                continue
            clicked = click_any(
                tab, ["Συνέχεια", "Υποβολή", "Καταχώρηση", "Οριστικοποίηση", "Επιβεβαίωση"]
            )
            if not clicked:
                break
            print("clicked", clicked)
            time.sleep(6)
        if "/done" in url(tab):
            out = args.receipt_out or ""
            rec = done_receipt(tab, out)
            print("RECEIPT:", json.dumps(rec, ensure_ascii=False))
        else:
            print("final url:", url(tab))
            print(body(tab, 1500))
    else:
        print("STOPPED at preview — review, then rerun with --submit --confirm-submission")


if __name__ == "__main__":
    main()
