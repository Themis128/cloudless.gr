import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['**/*.{test,spec,eval}.ts'],
		globals: true,
		environment: 'node',
	},
	define: {
		// Evals mode configuration
		__EVALS_MODE__: 'false',
	},
	resolve: {
		alias: {
			// Add aliases for cleaner imports in evals
			'@types': './src/types',
		},
	},
});