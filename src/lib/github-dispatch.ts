/**
 * GitHub Actions workflow dispatcher.
 *
 * Posts to the REST `workflow_dispatch` endpoint to trigger a workflow
 * run on demand. Used by the Slack interactions and slash command routes
 * so an operator can re-run e.g. `weekly-article-draft.yml` from Slack
 * without opening the Actions tab.
 *
 * Auth: prefers GITHUB_DISPATCH_TOKEN (least-privilege, fine-grained PAT
 * with Actions = Read and write on this single repo). Falls back to
 * GITHUB_TOKEN so a single broader PAT also works. Both are resolved from
 * SSM at runtime, never bundled into the client.
 *
 * @see https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
 */

import { getConfig } from "@/lib/ssm-config";

/**
 * The repo to dispatch against. Override via env if the project is forked
 * or renamed — the SSM value is read inside the Lambda runtime only.
 */
const REPO = process.env.GITHUB_DISPATCH_REPO || "Themis128/cloudless.gr";

export type DispatchResult = { ok: true } | { ok: false; status: number; error: string };

/**
 * Trigger a workflow_dispatch event on the given workflow file.
 *
 * @param workflowFile  Filename inside .github/workflows/, e.g. "weekly-article-draft.yml"
 * @param ref           Git ref to run the workflow against. Defaults to "main".
 * @param inputs        Optional inputs map matching the workflow's `workflow_dispatch.inputs`.
 */
export async function dispatchWorkflow(
  workflowFile: string,
  ref: string = "main",
  inputs?: Record<string, string>
): Promise<DispatchResult> {
  const config = await getConfig();
  const token = config.GITHUB_DISPATCH_TOKEN || config.GITHUB_TOKEN;
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: "GITHUB_DISPATCH_TOKEN / GITHUB_TOKEN not configured in SSM",
    };
  }

  const body: Record<string, unknown> = { ref };
  if (inputs && Object.keys(inputs).length > 0) {
    body.inputs = inputs;
  }

  let res: Response;
  try {
    res = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${encodeURIComponent(
        workflowFile
      )}/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "cloudless.gr-slack-bot",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000),
      }
    );
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "FetchError";
    return { ok: false, status: 0, error: name };
  }

  // GitHub returns 204 No Content on success — the run appears in the
  // Actions tab within a couple of seconds.
  if (res.status === 204) return { ok: true };

  const text = await res.text().catch(() => "");
  return { ok: false, status: res.status, error: text.slice(0, 300) };
}
