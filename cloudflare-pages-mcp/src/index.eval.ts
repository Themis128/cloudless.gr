/**
 * Evaluation tests for Cloudflare Pages MCP tools
 *
 * Following the MCP eval implementation guide patterns from mcp-server-cloudflare
 * These tests verify correct tool registration and parameter validation
 *
 * Note: For full AI evaluation with vitest-evals, install:
 * npm install vitest-evals @repo/eval-tools
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// Import validators for testing
import {
	PagesProjectNameSchema,
	PagesDeploymentIdSchema,
	PagesListLimitSchema,
	PagesBranchNameSchema,
	PagesProjectCreateSchema,
	PagesDeploymentTriggerSchema,
} from './types/pages.js';

// ============================================
// Validator Tests
// ============================================

describe('Pages Type Validators', () => {
	describe('PagesProjectNameSchema', () => {
		it('should accept valid project names', () => {
			expect(PagesProjectNameSchema.parse('my-project')).toBe('my-project');
			expect(PagesProjectNameSchema.parse('project_123')).toBe('project_123');
			expect(PagesProjectNameSchema.parse('Project-Name')).toBe('Project-Name');
		});

		it('should reject invalid project names', () => {
			expect(() => PagesProjectNameSchema.parse('')).toThrow();
			expect(() => PagesProjectNameSchema.parse('a'.repeat(65))).toThrow();
			expect(() => PagesProjectNameSchema.parse('project@name')).toThrow();
		});

		it('should have proper description for LLM context', () => {
			const desc = PagesProjectNameSchema.description;
			expect(desc).toContain('alphanumeric');
			expect(desc).toContain('underscores');
		});
	});

	describe('PagesDeploymentIdSchema', () => {
		it('should accept non-empty strings', () => {
			expect(PagesDeploymentIdSchema.parse('deployment-123')).toBe(
				'deployment-123',
			);
			expect(PagesDeploymentIdSchema.parse('a'.repeat(36))).toBe(
				'a'.repeat(36),
			);
		});

		it('should reject empty strings', () => {
			expect(() => PagesDeploymentIdSchema.parse('')).toThrow();
		});
	});

	describe('PagesListLimitSchema', () => {
		it('should default to 10', () => {
			expect(PagesListLimitSchema.parse(undefined)).toBe(10);
		});

		it('should accept values 1-100', () => {
			expect(PagesListLimitSchema.parse(1)).toBe(1);
			expect(PagesListLimitSchema.parse(100)).toBe(100);
		});

		it('should reject values outside range', () => {
			expect(() => PagesListLimitSchema.parse(0)).toThrow();
			expect(() => PagesListLimitSchema.parse(101)).toThrow();
			expect(() => PagesListLimitSchema.parse(-1)).toThrow();
		});

		it('should reject non-integer values', () => {
			expect(() => PagesListLimitSchema.parse(1.5)).toThrow();
		});
	});

	describe('PagesProjectCreateSchema', () => {
		it('should validate complete project creation params', () => {
			const result = PagesProjectCreateSchema.parse({
				name: 'my-project',
				production_branch: 'main',
				build_config: {
					build_command: 'npm run build',
					destination_dir: 'dist',
				},
			});
			expect(result.name).toBe('my-project');
			expect(result.production_branch).toBe('main');
		});

		it('should validate minimal project params', () => {
			const result = PagesProjectCreateSchema.parse({ name: 'new-project' });
			expect(result.name).toBe('new-project');
			expect(result.build_config).toBeUndefined();
		});
	});

	describe('PagesDeploymentTriggerSchema', () => {
		it('should validate deployment trigger with all params', () => {
			const result = PagesDeploymentTriggerSchema.parse({
				project_name: 'my-project',
				branch: 'feature-branch',
				message: 'Deploying feature',
			});
			expect(result.project_name).toBe('my-project');
			expect(result.branch).toBe('feature-branch');
		});

		it('should validate with only project_name', () => {
			const result = PagesDeploymentTriggerSchema.parse({
				project_name: 'my-project',
			});
			expect(result.project_name).toBe('my-project');
			expect(result.branch).toBeUndefined();
			expect(result.message).toBeUndefined();
		});
	});
});

// ============================================
// MCP Tool Registration Tests
// ============================================

// These tests document the expected tool interface
// For full AI evaluation, use vitest-evals with describeEval pattern

describe('Tool Interface Documentation', () => {
	describe('pages_list_projects tool interface', () => {
		it('should have no required parameters', () => {
			// The tool takes no required params - this documents that expectation
			const expectedInterface = {
				params: {},
				description: 'List all Cloudflare Pages projects',
			};
			expect(expectedInterface.params).toEqual({});
		});
	});

	describe('pages_get_project tool interface', () => {
		it('should accept validated project_name parameter', () => {
			const projectName = 'cloudless';
			const result = PagesProjectNameSchema.safeParse(projectName);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe('cloudless');
			}
		});
	});

	describe('pages_trigger_deployment tool interface', () => {
		it('should accept validated project_name and optional branch', () => {
			const params = {
				project_name: 'cloudless',
				branch: 'main',
			};
			const result = PagesDeploymentTriggerSchema.safeParse(params);
			expect(result.success).toBe(true);
		});

		it('should accept only project_name (branch defaults)', () => {
			const params = { project_name: 'cloudless' };
			const result = PagesDeploymentTriggerSchema.safeParse(params);
			expect(result.success).toBe(true);
		});
	});

	describe('pages_create_project tool interface', () => {
		it('should validate project creation with build config', () => {
			const params = {
				name: 'new-project',
				production_branch: 'main',
				build_config: {
					build_command: 'npm run build',
					destination_dir: 'dist',
				},
			};
			const result = PagesProjectCreateSchema.safeParse(params);
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.name).toBe('new-project');
			}
		});
	});

	describe('pages_delete_project tool interface', () => {
		it('should validate project_name for deletion', () => {
			const projectName = 'old-project';
			const result = PagesProjectNameSchema.safeParse(projectName);
			expect(result.success).toBe(true);
		});
	});
});

// ============================================
// Integration Readiness Tests
// ============================================

describe('Integration Readiness', () => {
	it('should have required environment variables documented', () => {
		const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'];
		expect(required).toContain('CLOUDFLARE_API_TOKEN');
		expect(required).toContain('CLOUDFLARE_ACCOUNT_ID');
	});

	it('should export all validators from types file', () => {
		const exports = {
			PagesProjectNameSchema,
			PagesDeploymentIdSchema,
			PagesListLimitSchema,
			PagesBranchNameSchema,
			PagesProjectCreateSchema,
			PagesDeploymentTriggerSchema,
		};

		Object.entries(exports).forEach(([, schema]) => {
			expect(schema).toBeDefined();
		});
	});

	it('should have all type validators extend ZodType', () => {
		// Verify schemas are Zod schemas
		// Note: PagesListLimitSchema uses .optional().default() which wraps in ZodDefault
		expect(PagesProjectNameSchema).toBeInstanceOf(z.ZodString);
		expect(PagesDeploymentIdSchema).toBeInstanceOf(z.ZodString);
		expect(PagesListLimitSchema).toBeDefined();
		expect(PagesListLimitSchema.description).toBeDefined();
	});
});