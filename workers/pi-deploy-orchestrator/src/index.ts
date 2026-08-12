/**
 * pi-deploy-orchestrator — Cloudflare Workflows pull-deploy coordinator.
 *
 * GH Actions builds standalone → uploads to R2 → POST /trigger.
 * This Worker writes desired.json, starts a durable Workflow that polls
 * /api/health until the SHA is live (omv pull agent applies the release).
 *
 * Tracking: every event carries sha / sha12 / artifactKey / workflowInstanceId /
 * githubRunId for correlation across GH, Workflow dashboard, and omv logs.
 */
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

export interface Env {
  RELEASES: R2Bucket;
  PI_DEPLOY: Workflow<DeployParams>;
  DEPLOY_ORCHESTRATOR_TOKEN: string;
  HEALTH_URL: string;
  HEALTH_URL_FALLBACK: string;
  R2_ARTIFACT_PREFIX: string;
  SLACK_WEBHOOK_URL?: string;
  NTFY_URL?: string;
  NTFY_TOKEN?: string;
}

export interface DeployParams {
  sha: string;
  artifactKey: string;
  githubRunId?: string;
  githubRunUrl?: string;
}

export type DesiredState = {
  sha: string;
  sha12: string;
  artifactKey: string;
  createdAt: string;
  workflowInstanceId?: string;
  githubRunId?: string;
  githubRunUrl?: string;
  status: "pending" | "success" | "timeout" | "error";
  lastHealthVersion?: string;
  lastProbeAt?: string;
};

function sha12(sha: string): string {
  return sha.slice(0, 12);
}

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function requireToken(req: Request, env: Env): boolean {
  const hdr = req.headers.get("authorization") || "";
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  return Boolean(env.DEPLOY_ORCHESTRATOR_TOKEN) && token === env.DEPLOY_ORCHESTRATOR_TOKEN;
}

async function notify(
  env: Env,
  text: string,
  fields: Record<string, string>,
): Promise<void> {
  const lines = Object.entries(fields)
    .map(([k, v]) => `*${k}:* \`${v}\``)
    .join("\n");
  const body = `${text}\n${lines}`;

  if (env.SLACK_WEBHOOK_URL) {
    try {
      await fetch(env.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: body },
            },
          ],
        }),
      });
    } catch {
      /* best-effort */
    }
  }

  if (env.NTFY_URL) {
    try {
      const headers: Record<string, string> = {
        "content-type": "text/plain",
        Title: text.slice(0, 80),
      };
      if (env.NTFY_TOKEN) headers.Authorization = `Bearer ${env.NTFY_TOKEN}`;
      await fetch(env.NTFY_URL, { method: "POST", headers, body });
    } catch {
      /* best-effort */
    }
  }
}

async function probeHealth(
  env: Env,
): Promise<{ ok: boolean; version: string; url: string }> {
  for (const url of [env.HEALTH_URL, env.HEALTH_URL_FALLBACK]) {
    try {
      const res = await fetch(url, {
        cf: { cacheTtl: 0, cacheEverything: false },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { status?: string; version?: string };
      if (data?.status === "ok" && data.version) {
        return { ok: true, version: String(data.version), url };
      }
    } catch {
      /* try fallback */
    }
  }
  return { ok: false, version: "", url: env.HEALTH_URL };
}

export class PiDeployWorkflow extends WorkflowEntrypoint<Env, DeployParams> {
  async run(event: WorkflowEvent<DeployParams>, step: WorkflowStep) {
    const { sha, artifactKey, githubRunId, githubRunUrl } = event.payload;
    const instanceId = event.instanceId;
    const s12 = sha12(sha);

    await step.do("write-desired", async () => {
      const desired: DesiredState = {
        sha,
        sha12: s12,
        artifactKey,
        createdAt: new Date().toISOString(),
        workflowInstanceId: instanceId,
        githubRunId,
        githubRunUrl,
        status: "pending",
      };
      await this.env.RELEASES.put(
        "desired.json",
        JSON.stringify(desired, null, 2),
        { httpMetadata: { contentType: "application/json" } },
      );
      return desired;
    });

    const deadlineMs = 45 * 60 * 1000;
    const started = Date.now();
    let attempt = 0;
    let lastVersion = "";

    while (Date.now() - started < deadlineMs) {
      attempt += 1;
      const sleepName = `backoff-${attempt}`;
      const sleepSec = Math.min(120, 20 + attempt * 10);
      await step.sleep(sleepName, `${sleepSec} seconds`);

      const probe = await step.do(`health-${attempt}`, async () => {
        return probeHealth(this.env);
      });

      lastVersion = probe.version;
      const match =
        probe.ok &&
        (probe.version === sha ||
          probe.version.startsWith(s12) ||
          sha.startsWith(probe.version));

      await step.do(`track-probe-${attempt}`, async () => {
        const raw = await this.env.RELEASES.get("desired.json");
        const cur = raw
          ? (JSON.parse(await raw.text()) as DesiredState)
          : ({} as DesiredState);
        const next: DesiredState = {
          ...cur,
          sha,
          sha12: s12,
          artifactKey,
          workflowInstanceId: instanceId,
          githubRunId,
          githubRunUrl,
          status: match ? "success" : "pending",
          lastHealthVersion: probe.version || undefined,
          lastProbeAt: new Date().toISOString(),
        };
        await this.env.RELEASES.put(
          "desired.json",
          JSON.stringify(next, null, 2),
          { httpMetadata: { contentType: "application/json" } },
        );
        return {
          attempt,
          match,
          version: probe.version,
          healthUrl: probe.url,
        };
      });

      if (match) {
        await step.do("notify-success", async () => {
          await notify(this.env, `Pi deploy success ${s12}`, {
            sha,
            sha12: s12,
            artifactKey,
            workflowInstanceId: instanceId,
            githubRunId: githubRunId || "",
            liveVersion: lastVersion,
          });
        });
        return { ok: true, sha, version: lastVersion, attempts: attempt };
      }
    }

    await step.do("mark-timeout", async () => {
      const raw = await this.env.RELEASES.get("desired.json");
      const cur = raw
        ? (JSON.parse(await raw.text()) as DesiredState)
        : ({} as DesiredState);
      const next: DesiredState = {
        ...cur,
        sha,
        sha12: s12,
        artifactKey,
        workflowInstanceId: instanceId,
        githubRunId,
        githubRunUrl,
        status: "timeout",
        lastHealthVersion: lastVersion || undefined,
        lastProbeAt: new Date().toISOString(),
      };
      await this.env.RELEASES.put(
        "desired.json",
        JSON.stringify(next, null, 2),
        { httpMetadata: { contentType: "application/json" } },
      );
      await notify(this.env, `Pi deploy TIMEOUT ${s12}`, {
        sha,
        sha12: s12,
        artifactKey,
        workflowInstanceId: instanceId,
        githubRunId: githubRunId || "",
        lastHealthVersion: lastVersion || "none",
      });
      return next;
    });

    throw new Error(
      `Deploy timeout: want ${s12}, last health version=${lastVersion || "none"}`,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "pi-deploy-orchestrator" });
    }

    // omv agent + operators: read desired release (auth required)
    if (url.pathname === "/desired" && request.method === "GET") {
      if (!requireToken(request, env)) return unauthorized();
      const obj = await env.RELEASES.get("desired.json");
      if (!obj) {
        return Response.json({ error: "no desired release" }, { status: 404 });
      }
      return new Response(await obj.text(), {
        headers: { "content-type": "application/json" },
      });
    }

    // GH Actions: start durable deploy wait
    if (url.pathname === "/trigger" && request.method === "POST") {
      if (!requireToken(request, env)) return unauthorized();
      let body: DeployParams;
      try {
        body = (await request.json()) as DeployParams;
      } catch {
        return Response.json({ error: "invalid json" }, { status: 400 });
      }
      if (!body?.sha || !body?.artifactKey) {
        return Response.json(
          { error: "sha and artifactKey required" },
          { status: 400 },
        );
      }
      // Ensure object exists before starting wait loop
      const head = await env.RELEASES.head(body.artifactKey);
      if (!head) {
        return Response.json(
          { error: `artifact missing in R2: ${body.artifactKey}` },
          { status: 404 },
        );
      }

      const instance = await env.PI_DEPLOY.create({
        id: `pi-deploy-${body.sha.slice(0, 12)}-${Date.now()}`,
        params: {
          sha: body.sha,
          artifactKey: body.artifactKey,
          githubRunId: body.githubRunId,
          githubRunUrl: body.githubRunUrl,
        },
      });

      await notify(env, `Pi deploy triggered ${sha12(body.sha)}`, {
        sha: body.sha,
        sha12: sha12(body.sha),
        artifactKey: body.artifactKey,
        workflowInstanceId: instance.id,
        githubRunId: body.githubRunId || "",
      });

      return Response.json({
        ok: true,
        workflowInstanceId: instance.id,
        sha: body.sha,
        sha12: sha12(body.sha),
        artifactKey: body.artifactKey,
        githubRunId: body.githubRunId || null,
      });
    }

    // Agent reports local events (optional tracking mirror into desired.json meta)
    if (url.pathname === "/agent-event" && request.method === "POST") {
      if (!requireToken(request, env)) return unauthorized();
      const evt = (await request.json()) as Record<string, unknown>;
      console.log(
        JSON.stringify({
          type: "agent-event",
          ...evt,
          receivedAt: new Date().toISOString(),
        }),
      );
      return Response.json({ ok: true });
    }

    return Response.json(
      {
        service: "pi-deploy-orchestrator",
        routes: ["GET /health", "GET /desired", "POST /trigger", "POST /agent-event"],
      },
      { status: 404 },
    );
  },
};
