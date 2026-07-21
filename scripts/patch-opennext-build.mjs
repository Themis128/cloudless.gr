import fs from "node:fs";
import path from "node:path";

const candidates = [
  path.join(process.cwd(), "node_modules", ".pnpm", "@opennextjs+aws@4.0.2_next@16.3.0-preview.6_@babel+core@7.29.7_@opentelemetry+api@1.9.1_4e81d2b1d10f6a417fc124acf2499645", "node_modules", "@opennextjs", "aws", "dist", "build", "buildNextApp.js"),
];

let targetFile = null;
for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    targetFile = candidate;
    break;
  }
}

if (!targetFile) {
  console.error("Could not find @opennextjs/aws/dist/build/buildNextApp.js");
  process.exit(1);
}

let content = fs.readFileSync(targetFile, "utf8");

if (content.includes("Cloudless middleware patch")) {
  console.log("[patch-opennext-build] Already patched");
  process.exit(0);
}

const patch = `
// Cloudless middleware patch: bridge Next.js 16 edge/chunks output to legacy middleware.js path
const { execSync } = await import("node:child_process");
try {
  execSync("node scripts/opennext-middleware-fix.mjs", { cwd: process.cwd(), stdio: "ignore" });
} catch {}
`;

content = content.replace(
  "await execSync(pmRun(`pnpm build`), { ... })",
  `${patch}\n      await execSync(pmRun(` + "`pnpm build`" + `), { ... })`
);

fs.writeFileSync(targetFile, content);
console.log("[patch-opennext-build] Patched", targetFile);