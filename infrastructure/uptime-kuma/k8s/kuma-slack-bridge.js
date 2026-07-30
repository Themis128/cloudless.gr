/**
 * Temporary in-cluster Kuma → Slack bridge.
 *
 * Needed while the Pi hostpath standalone build does not yet include
 * POST /api/webhooks/kuma (cloudless-app currently 404s that path).
 * Once the standalone is rebuilt from a SHA that includes the route,
 * point Kuma at http://cloudless-app.cloudless.svc.cluster.local/api/webhooks/kuma
 * and scale this Deployment to 0.
 *
 * Env: ADMIN_ALERT_SECRET, SLACK_BOT_TOKEN, SLACK_CHANNEL (default #general)
 * Optional: DNS_COALESCE_MS (default 90000) — group getaddrinfo EAI_AGAIN bursts.
 */
const http = require("http");

const SECRET = process.env.ADMIN_ALERT_SECRET || "";
const BOT = process.env.SLACK_BOT_TOKEN || "";
const CHANNEL = process.env.SLACK_CHANNEL || "#general";
const DNS_COALESCE_MS = Number(process.env.DNS_COALESCE_MS || 90000);
const DNS_FAILURE_RE =
  /EAI_AGAIN|ENOTFOUND|getaddrinfo|NXDOMAIN|SERVFAIL|name resolution|DNS_PROBE/i;

function statusLabel(raw) {
  if (raw === 0 || raw === "0") return "DOWN";
  if (raw === 1 || raw === "1") return "UP";
  if (raw === 2 || raw === "2") return "PENDING";
  if (raw === 3 || raw === "3") return "MAINTENANCE";
  return "UNKNOWN";
}

function auth(req) {
  const h = req.headers.authorization || "";
  if (h.toLowerCase().startsWith("bearer ")) {
    return h.slice(7).trim() === SECRET;
  }
  const q = new URL(req.url, "http://x").searchParams.get("token");
  return q === SECRET;
}

async function postSlack(title, text) {
  const r = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + BOT,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: CHANNEL,
      text: title,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: title.slice(0, 150), emoji: true },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: String(text).slice(0, 2000) },
        },
      ],
    }),
  });
  return r.json();
}

/** Simple DNS-flap coalescer (mirrors src/lib/kuma-dns-coalesce.ts). */
const dnsState = {
  batch: null,
  recentDown: new Set(),
  recentTimer: null,
};

function flushDnsBatch() {
  if (!dnsState.batch) return null;
  const { status, names, sampleMsg, timer } = dnsState.batch;
  clearTimeout(timer);
  dnsState.batch = null;
  const list = [...names].sort();
  if (status === "DOWN") {
    for (const n of list) dnsState.recentDown.add(n);
    if (dnsState.recentTimer) clearTimeout(dnsState.recentTimer);
    dnsState.recentTimer = setTimeout(() => {
      dnsState.recentDown.clear();
      dnsState.recentTimer = null;
    }, DNS_COALESCE_MS * 4);
  } else {
    for (const n of list) dnsState.recentDown.delete(n);
  }
  const n = list.length;
  if (status === "DOWN") {
    return {
      title: "Kuma DOWN: DNS flap (" + n + " monitor" + (n === 1 ? "" : "s") + ")",
      text:
        "DNS resolution failed across " +
        n +
        " probe" +
        (n === 1 ? "" : "s") +
        " (likely CoreDNS / node resolver stall, not app outages).\n\n" +
        list.map((name) => "• " + name).join("\n") +
        "\n\nSample: " +
        (sampleMsg || "getaddrinfo EAI_AGAIN"),
    };
  }
  return {
    title: "Kuma UP: DNS recovered (" + n + " monitor" + (n === 1 ? "" : "s") + ")",
    text:
      "DNS resolution recovered for " +
      n +
      " probe" +
      (n === 1 ? "" : "s") +
      ".\n\n" +
      list.map((name) => "• " + name).join("\n"),
  };
}

function bufferDns(status, name, msg) {
  if (dnsState.batch && dnsState.batch.status !== status) {
    const early = flushDnsBatch();
    if (early) postSlack(early.title, early.text).catch(() => {});
  }
  if (!dnsState.batch) {
    dnsState.batch = {
      status,
      names: new Set([name]),
      sampleMsg: msg,
      timer: setTimeout(() => {
        const flushed = flushDnsBatch();
        if (flushed) postSlack(flushed.title, flushed.text).catch(() => {});
      }, DNS_COALESCE_MS),
    };
    return;
  }
  dnsState.batch.names.add(name);
  if (msg) dnsState.batch.sampleMsg = msg;
  clearTimeout(dnsState.batch.timer);
  dnsState.batch.timer = setTimeout(() => {
    const flushed = flushDnsBatch();
    if (flushed) postSlack(flushed.title, flushed.text).catch(() => {});
  }, DNS_COALESCE_MS);
}

http
  .createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(405);
      return res.end("method");
    }
    if (!SECRET || !auth(req)) {
      res.writeHead(401);
      return res.end("unauthorized");
    }
    let body = "";
    for await (const c of req) body += c;
    let j = {};
    try {
      j = JSON.parse(body || "{}");
    } catch {
      res.writeHead(400);
      return res.end("json");
    }
    const monitor = j.monitor || {};
    const heartbeat = j.heartbeat || {};
    const name = monitor.name || "monitor";
    const status = statusLabel(heartbeat.status);
    const text = j.msg || name + " is " + status;

    const dnsDown = status === "DOWN" && DNS_FAILURE_RE.test(text);
    const dnsUp =
      status === "UP" && (DNS_FAILURE_RE.test(text) || dnsState.recentDown.has(name));
    if (dnsDown || dnsUp) {
      bufferDns(dnsDown ? "DOWN" : "UP", name, text);
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: true, coalesced: true }));
    }

    const title = "Kuma " + status + ": " + name;
    const out = await postSlack(title, text);
    res.writeHead(out.ok ? 200 : 502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: !!out.ok, error: out.error || null }));
  })
  .listen(8080, () => console.log("kuma-slack-bridge on :8080"));
