/** * Workspace server utilities for managing workspaces.
 * Compatibility wrapper for AWS SDK usage in Cloudflare Workers environment.
 */

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  adminEmails?: string[];
  postizGroupId?: string;
  notionTag?: string;
  createdAt: string;
};

export function getActiveWorkspaceId(): string {
  return "default";
}

export function readWorkspaces(): Workspace[] {
  return [];
}

export function writeWorkspaces(workspaces: Workspace[]): void {
  // NOOP for type compatibility
}

export const WORKSPACE_COOKIE = "workspace-id";