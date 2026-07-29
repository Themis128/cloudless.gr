/**
 * Regression check for the multi-stage-Dockerfile APP_VERSION leak we hit
 * on b3ad7e14: ARG declared in the builder stage doesn't propagate to the
 * runner stage. Without the runner-stage ARG + ENV, /api/health.version
 * silently falls back to the "0.1.0" default and the SHA drift detector
 * always reports the Pi as drifted.
 *
 * This test enforces:
 *   1. ARG APP_VERSION is declared in the runner stage (not just builder).
 *   2. ENV APP_VERSION=${APP_VERSION} is set in the runner stage.
 *
 * build-pi-image.yml was removed with the hostpath Pi path — there is no
 * remaining CI workflow that passes APP_VERSION as a docker build-arg.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DOCKERFILE = resolve(__dirname, "../Dockerfile");

describe("Dockerfile multi-stage APP_VERSION wiring", () => {
  const dockerfile = readFileSync(DOCKERFILE, "utf-8");

  // Find the runner stage: everything from `FROM ... AS runner` to EOF
  // (or to the next `FROM`, but runner is the last stage in this Dockerfile).
  const runnerStart = dockerfile.indexOf("FROM");
  const runnerStageMatch = dockerfile.match(/FROM[^\n]+AS runner[\s\S]*$/);

  it("has a runner stage", () => {
    expect(runnerStart).toBeGreaterThanOrEqual(0);
    expect(runnerStageMatch, "no `FROM ... AS runner` in Dockerfile").toBeTruthy();
  });

  const runner = runnerStageMatch![0];

  it("re-declares ARG APP_VERSION in the runner stage", () => {
    expect(
      runner,
      "runner stage MUST re-declare ARG APP_VERSION — multi-stage builds don't inherit ARGs across FROM"
    ).toMatch(/ARG\s+APP_VERSION/);
  });

  it("sets ENV APP_VERSION in the runner stage", () => {
    // Match either inline `ENV APP_VERSION=...` or a multi-line ENV block
    // that includes APP_VERSION=...
    expect(
      runner,
      "runner stage MUST set ENV APP_VERSION=${APP_VERSION} so process.env.APP_VERSION is populated at runtime"
    ).toMatch(/APP_VERSION=\$\{APP_VERSION\}|APP_VERSION=\$APP_VERSION/);
  });
});
