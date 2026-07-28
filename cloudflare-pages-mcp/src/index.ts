#!/usr/bin/env node
/**
 * cloudflare-pages-mcp - Cloudflare Pages MCP Server
 *
 * Provides MCP tools for managing Cloudflare Pages deployments for cloudless.gr.
 * Integrates with the Cloudflare API for project and deployment management.
 *
 * Following MCP tool implementation guide patterns:
 * - Robust error handling with isError flag
 * - Clear tool descriptions for LLM consumption
 * - Typed parameters with Zod validators
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
	PagesProjectNameSchema,
	PagesDeploymentIdSchema,
	PagesListLimitSchema,
	PagesProjectCreateSchema,
	PagesDeploymentTriggerSchema,
} from './types/pages.js';
import { cfApi } from './utils/api.js';

// Validate required environment variables
const requiredEnvVars = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const;
for (const envVar of requiredEnvVars) {
	if (!process.env[envVar]) {
		console.error(`Missing required environment variable: ${envVar}`);
		process.exit(1);
	}
}

// Create MCP server
const server = new McpServer({
	name: 'cloudflare-pages-mcp',
	version: '2.0.0',
});

// ============================================
// Cloudflare Pages Tools
// ============================================

/**
 * List all Cloudflare Pages projects in the account
 * Use this when: user asks to see all Pages projects; checking project existence;
 * discovering available projects for deployment management.
 */
server.tool(
	'pages_list_projects',
	'List all Cloudflare Pages projects in the account. Use this tool when: a user asks to see all Pages projects, check project existence, or discover available projects for deployment management. Returns a list of project objects containing name, account_id, created_at, and production_branch.',
	{},
	async () => {
		const result = await cfApi<{
			result: Array<{
				name: string;
				account_id: string;
				created_at: string;
				production_branch: string;
				subdomain: string;
			}>;
		}>('/pages/projects');

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error listing Pages projects: ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data.result, null, 2),
				},
			],
		};
	},
);

/**
 * Get details for a specific Cloudflare Pages project
 * Use this tool when: user needs project details; checking configuration;
 * before performing operations like trigger deployment or delete.
 */
server.tool(
	'pages_get_project',
	'Get details for a specific Cloudflare Pages project. Use this tool when: you need project details, check configuration, or before performing operations like trigger deployment or delete. Returns project details including name, account_id, created_at, production_branch, and subdomain.',
	{
		project_name: PagesProjectNameSchema.describe('The name of the Pages project to get details for'),
	},
	async ({ project_name }) => {
		const result = await cfApi(`/pages/projects/${project_name}`);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error getting Pages project "${project_name}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

/**
 * List deployments for a Cloudflare Pages project
 * Use this tool when: checking deployment history; monitoring recent changes;
 * finding deployment IDs for log retrieval.
 */
server.tool(
	'pages_list_deployments',
	'List deployments for a Cloudflare Pages project. Use this tool when: checking deployment history, monitoring recent changes, or finding deployment IDs for log retrieval. Returns deployment objects with status, created_at, and URLs. Use limit to control pagination.',
	{
		project_name: PagesProjectNameSchema.describe('The name of the Pages project to list deployments for'),
		limit: PagesListLimitSchema.describe('Maximum number of deployments to return (1-100)'),
	},
	async ({ project_name, limit }) => {
		const result = await cfApi(
			`/pages/projects/${project_name}/deployments?limit=${limit}`,
		);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error listing deployments for "${project_name}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

/**
 * Get logs for a specific Pages deployment
 * Use this tool when: debugging failed deployments; checking build output;
 * viewing deployment status and errors.
 */
server.tool(
	'pages_get_deployment_logs',
	'Get logs for a specific Cloudflare Pages deployment. Use this tool when: debugging failed deployments, checking build output, or viewing deployment status and errors. Requires both the project name and deployment ID. Returns build logs and status information.',
	{
		project_name: PagesProjectNameSchema.describe('The name of the Pages project containing the deployment'),
		deployment_id: PagesDeploymentIdSchema.describe(
			'The deployment ID (usually a UUID or unique identifier)',
		),
	},
	async ({ project_name, deployment_id }) => {
		const result = await cfApi(
			`/pages/projects/${project_name}/deployments/${deployment_id}/logs`,
		);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error getting logs for deployment "${deployment_id}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

/**
 * Create a new Cloudflare Pages project
 * Use this tool when: user wants to create a new Pages project; setting up new deployments;
 * configuring project build settings. Consider using pages_list_projects first to check existence.
 */
server.tool(
	'pages_create_project',
	'Create a new Cloudflare Pages project. Use this tool when: a user wants to create a new Pages project, set up new deployments, or configure project build settings. Returns the created project details. Consider using pages_list_projects first to ensure the project does not already exist.',
	PagesProjectCreateSchema.shape,
	async (params) => {
		const body = JSON.stringify({
			name: params.name,
			production_branch: params.production_branch || 'main',
			build_config: params.build_config || {},
		});

		const result = await cfApi('/pages/projects', 'POST', body);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error creating Pages project "${params.name}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

/**
 * Delete a Cloudflare Pages project
 * Use this tool when: removing unused projects; cleaning up test deployments;
 * user explicitly requests project deletion. Warning: destructive operation requiring confirmation.
 */
server.tool(
	'pages_delete_project',
	'Delete a Cloudflare Pages project. Use this tool when: removing unused projects, cleaning up test deployments, or user explicitly requests project deletion. Warning: This is a destructive operation that permanently removes the project and all its deployments. Returns success confirmation.',
	{
		project_name: PagesProjectNameSchema.describe('The name of the Pages project to delete'),
	},
	async ({ project_name }) => {
		const result = await cfApi(`/pages/projects/${project_name}`, 'DELETE');

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error deleting Pages project "${project_name}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify({ success: true, message: `Project "${project_name}" deleted` }, null, 2),
				},
			],
		};
	},
);

/**
 * Trigger a new deployment for a Cloudflare Pages project
 * Use this tool when: user requests a new build; manual deployment trigger;
 * after updating project configuration.
 */
server.tool(
	'pages_trigger_deployment',
	'Trigger a new deployment for a Cloudflare Pages project. Use this tool when: a user requests a new build, manual deployment trigger, or after updating project configuration. Returns deployment details including the new deployment ID. Specify branch if deploying something other than the production branch.',
	PagesDeploymentTriggerSchema.shape,
	async (params) => {
		const body = JSON.stringify({
			branch: params.branch,
		});

		const result = await cfApi(
			`/pages/projects/${params.project_name}/deployments`,
			'POST',
			body || '{}',
		);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error triggering deployment for "${params.project_name}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

/**
 * Get details for a specific deployment
 * Use this tool when: checking deployment status; viewing deployment metadata;
 * before getting logs or comparing deployments.
 */
server.tool(
	'pages_get_deployment',
	'Get details for a specific Cloudflare Pages deployment. Use this tool when: checking deployment status, viewing deployment metadata, or before getting logs. Returns deployment details including status, created_at, and deployment URLs.',
	{
		project_name: PagesProjectNameSchema.describe('The name of the Pages project containing the deployment'),
		deployment_id: PagesDeploymentIdSchema.describe(
			'The deployment ID to get details for',
		),
	},
	async ({ project_name, deployment_id }) => {
		const result = await cfApi(
			`/pages/projects/${project_name}/deployments/${deployment_id}`,
		);

		if (!result.success) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error getting deployment "${deployment_id}": ${result.error}`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [
				{
					type: 'text' as const,
					text: JSON.stringify(result.data, null, 2),
				},
			],
		};
	},
);

// Start the server using IIFE pattern for top-level await support
(async () => {
	try {
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error('Cloudflare Pages MCP server v2.0.0 started');
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
})();