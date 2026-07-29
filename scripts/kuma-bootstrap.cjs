#!/usr/bin/env node
/**
 * Bootstrap Uptime Kuma after first DB setup.
 * Run inside the uptime-kuma pod (CommonJS — matches the image).
 */
const { io } = require("socket.io-client");

const BASE = process.env.KUMA_URL || "http://127.0.0.1:3001";
const USER = process.env.KUMA_USER || "tbaltzakis";
const PASS = process.env.KUMA_PASS || "";
const SLUG = process.env.KUMA_STATUS_SLUG || "cloudless";
const NTFY_BASE = process.env.KUMA_NTFY_BASE || "https://ntfy.cloudless.gr";
const NTFY_TOPIC = process.env.KUMA_NTFY_TOPIC || "cloudless-alerts";
const SLACK_WEBHOOK = process.env.KUMA_SLACK_WEBHOOK || "";

if (!PASS) {
  console.error("KUMA_PASS is required");
  process.exit(1);
}

const MONITORS = [
  { name: "cloudless.gr /api/health", url: "https://cloudless.gr/api/health", accepted_statuscodes: ["200"] },
  { name: "AppFlowy", url: "https://appflowy.cloudless.gr/api/health", accepted_statuscodes: ["200"] },
  { name: "EspoCRM", url: "https://espocrm.cloudless.gr/", accepted_statuscodes: ["200", "302"] },
  { name: "Postiz", url: "https://postiz.cloudless.gr/", accepted_statuscodes: ["200", "307", "308"] },
  { name: "n8n", url: "https://n8n.cloudless.gr/healthz", accepted_statuscodes: ["200"] },
  { name: "Grafana", url: "https://grafana.cloudless.gr/api/health", accepted_statuscodes: ["200"] },
  { name: "ntfy", url: "https://ntfy.cloudless.gr/v1/health", accepted_statuscodes: ["200", "401"] },
  {
    name: "Uptime Kuma",
    url: "http://uptime-kuma.uptime-kuma.svc.cluster.local:3001/",
    accepted_statuscodes: ["200", "302"],
  },
  {
    name: "Pi alert-api (omv)",
    url: "http://pi-alert-api.default.svc.cluster.local:8080/health",
    accepted_statuscodes: ["200"],
  },
  {
    name: "Meilisearch",
    url: "http://meilisearch.meilisearch.svc.cluster.local:7700/health",
    accepted_statuscodes: ["200"],
  },
  { name: "Stripe API surface", url: "https://api.stripe.com/healthcheck", accepted_statuscodes: ["200"] },
  {
    name: "AWS Cognito (global)",
    url: "https://cognito-idp.us-east-1.amazonaws.com/",
    accepted_statuscodes: ["200", "400", "403"],
  },
];

function emit(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout on ${event}`)), 20000);
    socket.emit(event, ...args, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

function httpMonitor(partial) {
  return {
    type: "http",
    name: partial.name,
    url: partial.url,
    method: "GET",
    interval: 60,
    retryInterval: 60,
    resendInterval: 0,
    maxretries: 2,
    upsideDown: false,
    ignoreTls: false,
    maxredirects: 5,
    accepted_statuscodes: partial.accepted_statuscodes,
    dns_resolve_type: "A",
    dns_resolve_server: "1.1.1.1",
    notificationIDList: {},
    conditions: [],
    kafkaProducerBrokers: [],
    kafkaProducerSaslOptions: {},
    rabbitmqNodes: [],
    active: true,
  };
}

function waitForInfo(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for info")), 15000);
    socket.on("info", (info) => {
      clearTimeout(timer);
      resolve(info);
    });
  });
}

async function main() {
  const socket = io(BASE, { transports: ["websocket"] });
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 10000);
  });
  // Server pushes `info` before needSetup/login acks are reliable on cold connect.
  await waitForInfo(socket);

  let needSetup = false;
  try {
    needSetup = Boolean(await emit(socket, "needSetup"));
  } catch (err) {
    console.warn("needSetup probe failed, continuing to login:", err.message);
  }
  if (needSetup) {
    const setup = await emit(socket, "setup", USER, PASS);
    console.log("setup", setup);
    if (!setup || !setup.ok) throw new Error(`setup failed: ${setup && setup.msg}`);
  }

  const login = await emit(socket, "login", { username: USER, password: PASS });
  console.log("login", login && login.ok ? "ok" : login);
  if (!login || !login.ok) throw new Error(`login failed: ${login && login.msg}`);

  const notificationIDList = {};

  const ntfy = await emit(
    socket,
    "addNotification",
    {
      name: "ntfy cloudless-alerts",
      active: true,
      isDefault: true,
      type: "ntfy",
      ntfyserverurl: NTFY_BASE,
      ntfytopic: NTFY_TOPIC,
      ntfypriority: 3,
    },
    null
  );
  console.log("ntfy notification", ntfy);
  if (ntfy && ntfy.ok && ntfy.id != null) notificationIDList[ntfy.id] = true;

  if (SLACK_WEBHOOK) {
    const slack = await emit(
      socket,
      "addNotification",
      {
        name: "Slack alerts",
        active: true,
        isDefault: true,
        type: "slack",
        slackwebhookURL: SLACK_WEBHOOK,
        slackchannel: "#alerts",
        slackusername: "Uptime Kuma",
      },
      null
    );
    console.log("slack notification", slack);
    if (slack && slack.ok && slack.id != null) notificationIDList[slack.id] = true;
  }

  // Preferred when Incoming Webhook is unavailable: bot-token bridge in the app.
  const BRIDGE_URL = process.env.KUMA_BRIDGE_URL || "";
  const BRIDGE_TOKEN = process.env.KUMA_BRIDGE_TOKEN || "";
  if (BRIDGE_URL && BRIDGE_TOKEN) {
    const bridge = await emit(
      socket,
      "addNotification",
      {
        name: "Slack via cloudless bridge",
        active: true,
        isDefault: true,
        type: "webhook",
        webhookURL: BRIDGE_URL,
        webhookContentType: "json",
        webhookAdditionalHeaders: JSON.stringify({
          Authorization: `Bearer ${BRIDGE_TOKEN}`,
        }),
      },
      null
    );
    console.log("slack bridge notification", bridge);
    if (bridge && bridge.ok && bridge.id != null) notificationIDList[bridge.id] = true;
  }

  const monitorIds = [];
  for (const m of MONITORS) {
    const payload = httpMonitor(m);
    payload.notificationIDList = Object.assign({}, notificationIDList);
    const res = await emit(socket, "add", payload);
    console.log("monitor", m.name, res && res.ok ? `id=${res.monitorID}` : res);
    if (res && res.ok) monitorIds.push({ id: res.monitorID, name: m.name });
  }

  const page = await emit(socket, "addStatusPage", "cloudless", SLUG);
  console.log("status page", page);

  const config = {
    slug: SLUG,
    title: "cloudless",
    description: "cloudless.gr + self-hosted stack status",
    theme: "dark",
    published: true,
    showTags: false,
    footerText: "cloudless.gr",
    customCSS: "",
    showPoweredBy: false,
    icon: "",
    logo: "",
    autoRefreshInterval: 60,
    domainNameList: [],
    googleAnalyticsId: null,
    analyticsId: null,
    analyticsScriptUrl: null,
    analyticsType: null,
    rssTitle: "cloudless status",
    showOnlyLastHeartbeat: false,
    showCertificateExpiry: true,
  };

  const byName = (names) => monitorIds.filter((m) => names.includes(m.name));
  const publicGroupList = [
    {
      name: "Public",
      weight: 1,
      monitorList: byName(["cloudless.gr /api/health", "Stripe API surface", "AWS Cognito (global)"]),
    },
    {
      name: "Self-hosted",
      weight: 2,
      monitorList: byName([
        "AppFlowy",
        "EspoCRM",
        "Postiz",
        "n8n",
        "Grafana",
        "ntfy",
        "Uptime Kuma",
        "Meilisearch",
      ]),
    },
    { name: "Cluster", weight: 3, monitorList: byName(["Pi alert-api (omv)"]) },
  ];

  const saved = await emit(socket, "saveStatusPage", SLUG, config, "", publicGroupList);
  console.log("saveStatusPage", saved);

  const verify = await fetch(`${BASE}/api/status-page/${SLUG}`);
  const body = await verify.json();
  const count = (body.publicGroupList || []).reduce((n, g) => n + ((g.monitorList && g.monitorList.length) || 0), 0);
  console.log(`VERIFY slug=${SLUG} http=${verify.status} monitors=${count}`);

  socket.close();
  if (!verify.ok || count < 1) process.exit(2);
  console.log("DONE");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
