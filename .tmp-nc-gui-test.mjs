import { chromium } from "playwright";

const SHOTS = "/home/tbaltzakis/cloudless.gr/gui-test-screenshots";
const results = [];
const log = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// T1: /en/contact renders the Talk link with safe attrs
await page.goto("https://cloudless.gr/en/contact", { waitUntil: "domcontentloaded", timeout: 45000 });
const talk = page.getByRole("link", { name: /join a talk call/i });
await talk.waitFor({ timeout: 20000 });
const href = await talk.getAttribute("href");
const target = await talk.getAttribute("target");
const rel = (await talk.getAttribute("rel")) ?? "";
log("T1 contact Talk link href", href === "https://cloud.cloudless.gr/call/zsykkx97", href);
log("T1 target/rel safe", target === "_blank" && rel.includes("noopener") && rel.includes("noreferrer"), `target=${target} rel=${rel}`);
await page.screenshot({ path: `${SHOTS}/t1_contact_desktop.png`, fullPage: false });

// T2: click-through opens the Nextcloud Talk room
const [room] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 20000 }),
  talk.click(),
]);
await room.waitForLoadState("domcontentloaded");
await room.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
log("T2 room URL", room.url().startsWith("https://cloud.cloudless.gr/call/"), room.url());
const roomTitle = await room.title();
const bodyText = (await room.locator("body").innerText().catch(() => "")).slice(0, 400);
const notFound = /does not exist|not found|404/i.test(roomTitle + " " + bodyText);
log("T2 room loads (no not-found)", !notFound, `title="${roomTitle}"`);
await room.screenshot({ path: `${SHOTS}/t2_talk_room_desktop.png` });
await room.close();
await page.close();

// T3: /links page lists both Nextcloud surfaces
const p2 = await ctx.newPage();
await p2.goto("https://cloudless.gr/links", { waitUntil: "domcontentloaded", timeout: 45000 });
const consult = p2.getByRole("link", { name: /book a free video consult/i });
const workspace = p2.getByRole("link", { name: /client workspace/i });
await consult.waitFor({ timeout: 20000 });
log("T3 links page consult href", (await consult.getAttribute("href")) === "https://cloud.cloudless.gr/call/zsykkx97");
log("T3 links page workspace href", (await workspace.getAttribute("href")) === "https://cloud.cloudless.gr");
await p2.screenshot({ path: `${SHOTS}/t3_links_page.png`, fullPage: true });

// T4: click consult → Talk room again (from links platform)
const [room2] = await Promise.all([
  ctx.waitForEvent("page", { timeout: 20000 }),
  consult.click(),
]);
await room2.waitForLoadState("domcontentloaded");
const t2ok = room2.url().startsWith("https://cloud.cloudless.gr/call/");
log("T4 links→room navigation", t2ok, room2.url());
await room2.close();
await p2.close();

// T5: workspace login page renders a real form
const p3 = await ctx.newPage();
await p3.goto("https://cloud.cloudless.gr/login", { waitUntil: "domcontentloaded", timeout: 45000 });
await p3.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
const hasUser = await p3.locator("#user, input[name=user], input[name=user_id]").first().isVisible().catch(() => false);
log("T5 workspace login form", hasUser, "input[name=user] visible");
await p3.screenshot({ path: `${SHOTS}/t5_workspace_login.png` });
await p3.close();
await ctx.close();

// T6: mobile viewport — contact link present & room reachable
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto("https://cloudless.gr/en/contact", { waitUntil: "domcontentloaded", timeout: 45000 });
const mtalk = mp.getByRole("link", { name: /join a talk call/i });
await mtalk.waitFor({ timeout: 20000 });
const box = await mtalk.boundingBox();
log("T6 mobile Talk link visible", !!box && box.height >= 20, box ? `${Math.round(box.width)}x${Math.round(box.height)} @ y=${Math.round(box.y)}` : "not visible");
await mp.screenshot({ path: `${SHOTS}/t6_contact_mobile.png`, fullPage: false });
const [mroom] = await Promise.all([
  mctx.waitForEvent("page", { timeout: 20000 }),
  mtalk.click(),
]);
await mroom.waitForLoadState("domcontentloaded");
const mbody = (await mroom.locator("body").innerText().catch(() => "")).slice(0, 300);
log("T6 mobile room loads", mroom.url().startsWith("https://cloud.cloudless.gr/call/") && !/does not exist/i.test(mbody), mroom.url());
await mroom.screenshot({ path: `${SHOTS}/t6_talk_room_mobile.png` });
await mctx.close();

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
