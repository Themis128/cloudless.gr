"""Minimal CDP helper for chrome-debug-profile (:9229).
Real Input.dispatchMouseEvent clicks (Google ignores el.click()).
"""

import json
import time
import urllib.request

import websocket

CDP = "http://127.0.0.1:9229"


def pages():
    return [
        t
        for t in json.loads(urllib.request.urlopen(CDP + "/json/list", timeout=10).read())
        if t.get("type") == "page"
    ]


def find_page(substr):
    for t in pages():
        if substr in t.get("url", ""):
            return t
    return None


def open_tab(url):
    req = urllib.request.Request(
        CDP + "/json/new?" + urllib.parse.quote(url, safe=""), method="PUT"
    )
    return json.loads(urllib.request.urlopen(req, timeout=10).read())


class Tab:
    def __init__(self, ws_url):
        self.ws = websocket.create_connection(ws_url, timeout=30, suppress_origin=True)
        self.mid = 0

    def cmd(self, method, params=None):
        self.mid += 1
        self.ws.send(json.dumps({"id": self.mid, "method": method, "params": params or {}}))
        deadline = time.time() + 30
        while time.time() < deadline:
            m = json.loads(self.ws.recv())
            if m.get("id") == self.mid:
                return m.get("result", {})
        raise TimeoutError(method)

    def js(self, expr):
        r = self.cmd("Runtime.evaluate", {"expression": expr, "returnByValue": True})
        return r.get("result", {}).get("value")

    def click_xy(self, x, y):
        for t in ("mousePressed", "mouseReleased"):
            self.cmd(
                "Input.dispatchMouseEvent",
                {"type": t, "x": x, "y": y, "button": "left", "clickCount": 1},
            )

    def click_text(self, text, tags="button,li,a,[role=button],[role=link],span,div"):
        """Click first VISIBLE element whose innerText contains text. Returns info or None."""
        expr = """(()=>{
 const vis=e=>!!(e.offsetWidth||e.offsetHeight)&&e.getClientRects().length;
 const want=@WANT@;
 const els=[...document.querySelectorAll(@TAGS@)];
 for(const e of els){
   const t=(e.innerText||'').trim();
   if(vis(e)&&t&&t.includes(want)){
     const r=e.getBoundingClientRect();
     return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2,t:t.slice(0,80)});
   }}
 return null})()""".replace("@WANT@", json.dumps(text)).replace("@TAGS@", json.dumps(tags))
        hit = self.js(expr)
        if not hit:
            return None
        info = json.loads(hit)
        self.click_xy(info["x"], info["y"])
        return info

    def click_selector_center(self, selector):
        expr = """(()=>{const e=document.querySelector(@SEL@);
 if(!e)return null;const r=e.getBoundingClientRect();
 return JSON.stringify({x:r.x+r.width/2,y:r.y+r.height/2})})()""".replace(
            "@SEL@", json.dumps(selector)
        )
        hit = self.js(expr)
        if not hit:
            return None
        info = json.loads(hit)
        self.click_xy(info["x"], info["y"])
        return info

    def close(self):
        try:
            self.ws.close()
        except Exception:
            pass


def for_url(substr):
    t = find_page(substr)
    return Tab(t["webSocketDebuggerUrl"]) if t else None
