import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";

const origin = "http://127.0.0.1:4010";
const recordDir = "/tmp/tiktok-demo-video";
const outFile = "/out/tiktok-demo.mp4";

fs.mkdirSync(recordDir, { recursive: true });
fs.mkdirSync("/out", { recursive: true });

async function waitForServer(url, maxTries = 300) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server not ready after ${maxTries}s`);
}

await waitForServer(`${origin}/`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: "/workspace/e2e/.auth/admin.json",
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: recordDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

const pause = (ms) => page.waitForTimeout(ms);

await page.goto(`${origin}/admin`, { waitUntil: "networkidle" });
await pause(1500);

await page.goto(`${origin}/admin/campaigns`, { waitUntil: "networkidle" });
await pause(1500);

await page.goto(`${origin}/admin/campaigns/tiktok`, { waitUntil: "networkidle" });
await pause(2500);

await page.goto(`${origin}/admin/integrations`, { waitUntil: "networkidle" });
await pause(2500);

await context.close();
await browser.close();

const webm = fs.readdirSync(recordDir).find((f) => f.endsWith(".webm"));
if (!webm) throw new Error("No recorded video found");

const webmPath = `${recordDir}/${webm}`;

// Try ffmpeg in PATH; fall back to Playwright's bundled ffmpeg
let ffmpeg = "ffmpeg";
const bundled = "/ms-playwright/ffmpeg-1011/ffmpeg-linux";
if (!fs.existsSync("/usr/bin/ffmpeg") && !fs.existsSync("/bin/ffmpeg") && fs.existsSync(bundled)) {
  ffmpeg = bundled;
}

execSync(
  `${ffmpeg} -y -i ${webmPath} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -movflags +faststart ${outFile}`,
  { stdio: "inherit" }
);

console.log(`Demo video saved: ${outFile}`);
