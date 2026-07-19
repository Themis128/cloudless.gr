#!/usr/bin/env node
/**
 * fast-markdown-mcp - Fast Markdown File MCP Server
 *
 * Provides MCP tools for reading and searching markdown files in DevDocs storage.
 * Integrates with the DevDocs markdown storage path for quick documentation access.
 *
 * Following MCP tool implementation guide patterns:
 * - Robust error handling with isError flag
 * - Clear tool descriptions for LLM consumption
 * - Typed parameters with Zod validators
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { z } from 'zod';

// Configuration
const STORAGE_PATH = process.env.DEVDOCS_STORAGE_PATH || '/home/tbaltzakis/DevDocs/storage/markdown';
const WATCH_ENABLED = process.env.DEVDOCS_WATCH !== 'false';

// Validate storage path exists
if (!existsSync(STORAGE_PATH)) {
	console.error(`DevDocs storage path not found: ${STORAGE_PATH}`);
	console.error('Set DEVDOCS_STORAGE_PATH environment variable to the correct path.');
	process.exit(1);
}

// Create MCP server
const server = new McpServer({
	name: 'fast-markdown-mcp',
	version: '1.0.0',
});

// Tool schemas
const ReadFileSchema = z.object({
	filepath: z.string().describe('Path to the markdown file relative to storage path'),
});

const SearchFilesSchema = z.object({
	query: z.string().describe('Search query string'),
	file_pattern: z.string().optional().default('*.md'),
});

const ListFilesSchema = z.object({
	directory: z.string().optional().default('.').describe('Directory path relative to storage'),
});

/**
 * List all markdown files in the DevDocs storage
 */
server.tool(
	'list_files',
	'List all markdown files in the DevDocs storage directory. Returns file names and paths for discovery.',
	ListFilesSchema.shape,
	async ({ directory }) => {
		try {
			const targetDir = resolve(STORAGE_PATH, directory);
			const files = readdirSync(targetDir)
				.filter((f) => f.endsWith('.md') || f.endsWith('.json'))
				.map((f) => {
					const fullPath = join(targetDir, f);
					const relPath = relative(STORAGE_PATH, fullPath);
					try {
						const stats = statSync(fullPath);
						return {
							name: f,
							path: relPath,
							size: stats.size,
							modified: stats.mtime.toISOString(),
						};
					} catch {
						return { name: f, path: relPath };
					}
				});

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(files, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error listing files: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Read a markdown file from DevDocs storage
 */
server.tool(
	'read_file',
	'Read the contents of a markdown file from DevDocs storage. Provide the file path relative to the storage directory.',
	ReadFileSchema.shape,
	async ({ filepath }) => {
		try {
			const fullPath = resolve(STORAGE_PATH, filepath);

			if (!existsSync(fullPath)) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `File not found: ${filepath}`,
						},
					],
					isError: true,
				};
			}

			const content = readFileSync(fullPath, 'utf-8');

			return {
				content: [
					{
						type: 'text' as const,
						text: content,
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error reading file "${filepath}": ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Search across markdown files in DevDocs storage
 */
server.tool(
	'search_files',
	'Search for text across all markdown files in DevDocs storage. Returns matching files with context snippets.',
	SearchFilesSchema.shape,
	async ({ query, file_pattern }) => {
		try {
			const results: Array<{
				file: string;
				line: number;
				content: string;
				matches?: number;
			}> = [];

			function searchInFile(filePath: string) {
				const content = readFileSync(filePath, 'utf-8');
				const lines = content.split('\n');
				const lowerQuery = query.toLowerCase();

				for (let i = 0; i < lines.length; i++) {
					if (lines[i].toLowerCase().includes(lowerQuery)) {
						results.push({
							file: relative(STORAGE_PATH, filePath),
							line: i + 1,
							content: lines[i].slice(0, 200),
							matches: (lines[i].toLowerCase().match(new RegExp(query, 'gi')) || []).length,
						});
					}
				}
			}

			function searchDirectory(dir: string) {
				const entries = readdirSync(dir);
				for (const entry of entries) {
					const fullPath = join(dir, entry);
					const stat = statSync(fullPath);
					if (stat.isDirectory()) {
						searchDirectory(fullPath);
					} else if (entry.match(file_pattern.replace('*', '.*').replace('.', '\\.'))) {
						searchInFile(fullPath);
					}
				}
			}

			searchDirectory(STORAGE_PATH);

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(
							{
								query,
								results,
								count: results.length,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error searching files: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

/**
 * Get table of contents for a markdown file
 */
server.tool(
	'get_toc',
	'Get the table of contents (headings) for a markdown file. Returns heading hierarchy with levels.',
	ReadFileSchema.shape,
	async ({ filepath }) => {
		try {
			const fullPath = resolve(STORAGE_PATH, filepath);

			if (!existsSync(fullPath)) {
				return {
					content: [
						{
							type: 'text' as const,
							text: `File not found: ${filepath}`,
						},
					],
					isError: true,
				};
			}

			const content = readFileSync(fullPath, 'utf-8');
			const lines = content.split('\n');
			const toc: Array<{ level: number; text: string; line: number }> = [];

			for (let i = 0; i < lines.length; i++) {
				const headingMatch = lines[i].match(/^(#{1,6})\s+(.+)$/);
				if (headingMatch) {
					toc.push({
						level: headingMatch[1].length,
						text: headingMatch[2].trim(),
						line: i + 1,
					});
				}
			}

			return {
				content: [
					{
						type: 'text' as const,
						text: JSON.stringify(toc, null, 2),
					},
				],
			};
		} catch (error) {
			return {
				content: [
					{
						type: 'text' as const,
						text: `Error getting TOC: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// Start the server
const run_main = async () => {
	try {
		const transport = new StdioServerTransport();
		await server.connect(transport);
		console.error(`fast-markdown-mcp server started (storage: ${STORAGE_PATH})`);

		// Graceful shutdown
		const shutdown = () => {
			console.error('Shutting down fast-markdown-mcp server...');
			process.exit(0);
		};

		process.on('SIGTERM', shutdown);
		process.on('SIGINT', shutdown);
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
};

run_main();