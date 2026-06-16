import { SlackClient } from "@/lib/slack-notify";
import type { Workspace } from "@/lib/workspace-server";

/**
 * Workspace administration is a blast-radius event — creating, editing, or
 * deleting a workspace can affect every downstream surface that scopes by it.
 * Audit each mutation to Slack so there's a paper trail.
 *
 * Silent no-op when Slack isn't configured (SlackClient handles that).
 */
type WorkspaceEvent = "created" | "updated" | "deleted";

const EMOJI: Record<WorkspaceEvent, string> = {
  created: ":sparkles:",
  updated: ":pencil2:",
  deleted: ":wastebasket:",
};

export async function auditWorkspaceEvent(
  event: WorkspaceEvent,
  workspace: Pick<Workspace, "id" | "name" | "slug">,
  actorEmail: string | null | undefined
): Promise<void> {
  const client = new SlackClient();
  const actor = actorEmail ?? "unknown";
  await client.post({
    text: `Workspace ${event}: ${workspace.name}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `${EMOJI[event]} *Workspace ${event}* — *${workspace.name}* ` +
            `(\`${workspace.slug}\`)\n` +
            `> id: \`${workspace.id}\`\n` +
            `> actor: \`${actor}\``,
        },
      },
    ],
    icon_emoji: ":office:",
    username: "Workspace Admin",
  });
}
