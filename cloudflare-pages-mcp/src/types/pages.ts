/**
 * Cloudflare Pages Type Validators
 *
 * Following the MCP tool implementation guide patterns:
 * - Individual validators per field for LLM clarity
 * - SDK-linked types where applicable
 * - Extensive .describe() usage for LLM context
 */

import { z } from 'zod';

// Based on Cloudflare SDK types for Pages projects
// Project name: alphanumeric, underscores, hyphens, 1-64 chars
export const PagesProjectNameSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(/^[a-zA-Z0-9_-]+$/)
	.describe('The name of the Pages project (alphanumeric, underscores, hyphens only)');

// Deployment ID: UUID format
export const PagesDeploymentIdSchema = z
	.string()
	.min(1)
	.describe('The deployment ID (usually a UUID or unique identifier)');

// Account ID: UUID format
export const PagesAccountIdSchema = z
	.string()
	.uuid()
	.describe('The Cloudflare account ID');

// Limit parameter for pagination
export const PagesListLimitSchema = z
	.number()
	.int()
	.positive()
	.max(100)
	.optional()
	.default(10)
	.describe('Maximum number of results to return (1-100, default 10)');

// Branch name for deployments
export const PagesBranchNameSchema = z
	.string()
	.min(1)
	.describe('The git branch to deploy (e.g., "main", "production", "preview")');

// Environment for project creation
export type PagesEnvironment = 'production' | 'preview';
export const PagesEnvironmentSchema = z
	.enum(['production', 'preview'])
	.optional()
	.default('production')
	.describe('The environment to deploy to (production or preview, default: production)');

// Domain name for Pages project
export const PagesDomainNameSchema = z
	.string()
	.min(1)
	.describe('Custom domain name to configure for the Pages project');

// Project creation parameters
export const PagesProjectCreateSchema = z.object({
	name: PagesProjectNameSchema,
	production_branch: PagesBranchNameSchema.optional(),
	build_config: z
		.object({
			build_command: z.string().optional().describe('Build command to run'),
			destination_dir: z.string().optional().describe('Output directory for build artifacts'),
			root_dir: z.string().optional().describe('Root directory containing source files'),
			web_analytics: z.boolean().optional().describe('Enable web analytics'),
		})
		.optional()
		.describe('Build configuration for the Pages project'),
});

// Deployment trigger parameters
export const PagesDeploymentTriggerSchema = z.object({
	project_name: PagesProjectNameSchema,
	branch: PagesBranchNameSchema.optional().describe('Branch to deploy (defaults to production branch)'),
	message: z.string().optional().describe('Optional deployment message'),
});