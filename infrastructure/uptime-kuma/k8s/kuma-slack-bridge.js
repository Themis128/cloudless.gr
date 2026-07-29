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
 */
const http = require("http");

const SECRET = process.env.ADMIN_ALERT_SECRET || "";
const BOT = process.env.SLACK_BOT_TOKEN || "";
const CHANNEL = process.env.SLACK_CHANNEL || "#general";

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
    const title = "Kuma " + status + ": " + name;
    const text = j.msg || name + " is " + status;
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
    const out = await r.json();
    res.writeHead(out.ok ? 200 : 502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: !!out.ok, error: out.error || null }));
  })
  .listen(8080, () => console.log("kuma-slack-bridge on :8080"));
