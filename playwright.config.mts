1 | // playwright.config.mts
2 | import { defineConfig, devices } from '@playwright/test';
3 |
4 | /**
5 |  * Playwright configuration for Cloudless.gr project
6 |  * This configuration is used for end-to-end testing
7 |  * and integrates with the project's CI/CD pipeline.
8 |  */
9 | export default defineConfig({
10 |   // Base URL for tests
11 |   baseURL: process.env.PLAYWRIGHT_BASE_URL || 'https://cloudless.gr',
12 |
13 |   // Timeout for individual tests
14 |   timeout: 30_000,
15 |
16 |   // Retry failed tests
17 |   retries: 1,
18 |
19 |   // Reporter for test results
20 |   reporter: [
21 |     ['html', { open: 'never' }],
22 |     ['line'],
23 |     process.env.CI ? ['github'] : undefined,
24 |   ].filter(Boolean),
25 |
26 |   // Test projects
27 |   projects: [
28 |     {
29 |       name: 'chromium',
30 |       use: { ...devices['Desktop Chrome'] },
31 |     },
32 |     {
33 |       name: 'chromium-user',
34 |       use: {
35 |         ...devices['Desktop Chrome'],
36 |         userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
37 |       },
38 |     },
39 |     {
40 |       name: 'chromium-admin',
41 |       use: {
42 |         ...devices['Desktop Chrome'],
43 |         userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
44 |       },
45 |     },
46 |     {
47 |       name: 'firefox',
48 |       use: { ...devices['Desktop Firefox'] },
49 |     },
50 |     {
51 |       name: 'webkit',
52 |       use: { ...devices['Desktop Safari'] },
53 |     },
54 |   ],
55 |
56 |   // Web server configuration
57 |   webServer: {
58 |     command: 'npm run dev',
59 |     url: 'http://localhost:4000',
60 |     timeout: 60_000,
61 |     reuseExistingServer: !process.env.CI,
62 |   },
63 |
64 |   // Global setup and teardown
65 |   globalSetup: './e2e/setup/global-setup.ts',
66 |   globalTeardown: './e2e/setup/global-teardown.ts',
67 |
68 |   // Test directory
69 |   testDir: './e2e',
70 |
71 |   // Test ignore patterns
72 |   testIgnore: [
73 |     '**/node_modules/**',
74 |     '**/dist/**',
75 |     '**/.next/**',
76 |     '**/coverage/**',
77 |     '**/e2e/setup/**',
78 |   ],
79 |
80 |   // Test match patterns
81 |   testMatch: '**/*.spec.ts',
82 |
83 |   // Environment variables
84 |   env: {
85 |     BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'https://cloudless.gr',
86 |     CF_WORKERS_URL: process.env.CF_WORKERS_URL || 'https://cloudless.gr',
87 |   },
88 |
89 |   // Expect options
90 |   expect: {
91 |     timeout: 5_000,
92 |   },
93 |
94 |   // Screenshot options
95 |   snapshot: {
96 |     threshold: 0.1,
97 |   },
98 |
99 |   // Video options
100 |   video: process.env.CI ? 'retain-on-failure' : 'off',
101 |
102 |   // Trace options
103 |   trace: process.env.CI ? 'retain-on-failure' : 'off',
104 |
105 |   // Coverage options
106 |   coverage: {
107 |     enabled: !!process.env.COVERAGE,
108 |     include: ['src/**/*.{ts,tsx}'],
109 |     exclude: ['**/*.test.*', '**/*.spec.*', '**/__mocks__/**', '**/node_modules/**'],
110 |     debug: true,
111 |   },
112 | });