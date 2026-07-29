#!/usr/bin/env node
/**
 * Add Slack bridge webhook notification to an already-bootstrapped Kuma.
 * Posts to in-cluster cloudless-app /api/webhooks/kuma (bot → #general).
 *
 * Env:
 *   KUMA_USER / KUMA_PASS — admin creds
 *   KUMA_BRIDGE_URL — default in-cluster webhook URL
 *   KUMA_BRIDGE_TOKEN — ADMIN_ALERT_SECRET (Bearer)
 */
const { io } = require("socket.io-client");

const BASE = process.env.KUMA_URL || "http://127.0.0.1:3001";
const USER = process.env.KUMA_USER || "tbaltzakis";
const PASS = process.env.KUMA_PASS || "";
const BRIDGE_URL =
  process.env.KUMA_BRIDGE_URL ||
  "http://cloudless-app.cloudless.svc.cluster.local/api/webhooks/kuma";
const TOKEN = process.env.KUMA_BRIDGE_TOKEN || "";

if (!PASS || !TOKEN) {
  console.error("KUMA_PASS and KUMA_BRIDGE_TOKEN are required");
  process.exit(1);
}

function emit(socket, event, ...args) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout on ${event}`)), 20000);
    socket.emit(event, ...args, (res) => {
      clearTimeout(timer);
      resolve(res);
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
  await new Promise((resolve) => {
    socket.on("info", resolve);
    setTimeout(resolve, 2000);
  });

  const login = await emit(socket, "login", { username: USER, password: PASS });
  if (!login || !login.ok) throw new Error(`login failed: ${JSON.stringify(login)}`);

  const notification = await emit(
    socket,
    "addNotification",
    {
      name: "Slack via cloudless bridge",
      active: true,
      isDefault: true,
      type: "webhook",
      webhookURL: BRIDGE_URL,
      webhookContentType: "json",
      additionalHeadersEnabled: true,
      additionalHeaders: JSON.stringify({
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      }),
    },
    null
  );
  console.log("notification", notification);
  if (!notification || !notification.ok) {
    throw new Error(`addNotification failed: ${JSON.stringify(notification)}`);
  }

  const id = notification.id;
  // Apply to every existing monitor
  const list = await new Promise((resolve) => {
    socket.once("monitorList", resolve);
    setTimeout(() => resolve(null), 3000);
  });
  // monitorList may already have been pushed at login — re-get via getMonitorList if needed
  const monitors = list && typeof list === "object" ? Object.values(list) : [];
  console.log("monitors from event", monitors.length);

  // Fallback: ask for each known id 1..20
  for (let mid = 1; mid <= 20; mid++) {
    try {
      const m = await emit(socket, "getMonitor", mid);
      if (!m || !m.ok || !m.monitor) continue;
      const mon = m.monitor;
      const notificationIDList = Object.assign({}, mon.notificationIDList || {});
      notificationIDList[id] = true;
      mon.notificationIDList = notificationIDList;
      const edited = await emit(socket, "editMonitor", mon);
      console.log("editMonitor", mid, mon.name, edited && edited.ok);
    } catch (err) {
      // monitor id may not exist
    }
  }

  const test = await emit(
    socket,
    "testNotification",
    {
      name: "Slack via cloudless bridge",
      active: true,
      isDefault: true,
      type: "webhook",
      webhookURL: BRIDGE_URL,
      webhookContentType: "json",
      additionalHeadersEnabled: true,
      additionalHeaders: JSON.stringify({
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      }),
    }
  );
  console.log("testNotification", test);

  socket.close();
  console.log("DONE id=", id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
