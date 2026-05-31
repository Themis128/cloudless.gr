/**
 * GitHub self-hosted runner health — verifies the runner is online,
 * accepting jobs, and no stuck runs exist.
 *
 * Catches: runner daemon crash, runner de-registered, labels misconfigured.
 * Requires GH_TOKEN with repo scope.
 */
import { test, expect } from "../coverage";

const REPO = "Themis128/cloudless.gr";
const runInfra = !!process.env.INFRA_SMOKE;

test.describe("GitHub self-hosted runner", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");
  test.skip(!process.env.GH_TOKEN, "Requires GH_TOKEN with repo scope");

  const headers = {
    Authorization: `token ${process.env.GH_TOKEN}`,
    Accept: "application/vnd.github+json",
  };

  test("at least one self-hosted runner is online", async ({ request }) => {
    const r = await request.get(
      `https://api.github.com/repos/${REPO}/actions/runners`,
      { headers, failOnStatusCode: false },
    );
    expect(r.status()).toBe(200);
    const body = await r.json();
    const online = body.runners?.filter(
      (runner: { status: string }) => runner.status === "online",
    );
    expect(online?.length, `No online self-hosted runners. Total: ${body.total_count}`).toBeGreaterThan(0);
  });

  test("runner has expected labels", async ({ request }) => {
    const r = await request.get(
      `https://api.github.com/repos/${REPO}/actions/runners`,
      { headers },
    );
    const body = await r.json();
    const runner = body.runners?.[0];
    if (!runner) { test.skip(true, "No runners found"); return; }
    const labelNames = runner.labels.map((l: { name: string }) => l.name);
    expect(labelNames).toContain("self-hosted");
  });

  test("no stuck workflow runs on self-hosted runners (>30 min in_progress)", async ({ request }) => {
    const r = await request.get(
      `https://api.github.com/repos/${REPO}/actions/runs?status=in_progress&per_page=10`,
      { headers, failOnStatusCode: false },
    );
    expect(r.status()).toBe(200);
    const body = await r.json();
    const now = Date.now();
    const stuckRuns = (body.workflow_runs ?? []).filter((run: { created_at: string }) => {
      const age = now - new Date(run.created_at).getTime();
      return age > 30 * 60 * 1000;
    });
    expect(stuckRuns.length, `${stuckRuns.length} runs stuck >30 min`).toBe(0);
  });
});
