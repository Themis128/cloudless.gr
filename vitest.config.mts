import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // jose lives in the pnpm content-addressable store; the stub symlink at
    // node_modules/jose is missing its package.json, so Vite can't resolve it
    // via normal package resolution. Alias it to the real store location.
    alias: {
      "@": path.resolve(__dirname, "src"),
      // jose — point to the installed package's webapi dist (works for both v5 and v6)
      jose: path.resolve(__dirname, "node_modules/jose/dist/webapi/index.js"),
      // next-intl/middleware (v4) imports next/server via ESM bare specifier,
      // which Vitest/JSDOM cannot resolve. Tests only need the proxy `config`
      // export, so we provide a no-op factory stub here.
      "next-intl/middleware": path.resolve(
        __dirname,
        "__tests__/stubs/next-intl-middleware-stub.js"
      ),
      // next-auth imports next/server as a bare ESM specifier. Vitest can't
      // resolve the CJS file. This ESM stub re-exports the real classes.
      "next/server": path.resolve(__dirname, "__tests__/stubs/next-server-stub.js"),
      // next-intl's react-client navigation helpers import `next/navigation`
      // as a bare ESM specifier which Vitest can't resolve from the CJS dist.
      // This stub provides no-op hook implementations for component tests.
      "next/navigation": path.resolve(__dirname, "__tests__/stubs/next-navigation-stub.js"),
      // @aws-sdk/client-cognito-identity-provider is not installed; tests that
      // need it supply their own vi.mock() — the stub prevents Vite's import
      // analysis from failing when the route file is dynamically imported.
      "@aws-sdk/client-cognito-identity-provider": path.resolve(
        __dirname,
        "__tests__/stubs/aws-cognito-stub.js"
      ),
      // @aws-sdk/client-ssm (and its transitive dep @aws-sdk/util-endpoints) crash
      // under JSDOM during module init. All SSM tests mock @/lib/ssm-config directly.
      "@aws-sdk/client-ssm": path.resolve(__dirname, "__tests__/stubs/aws-ssm-stub.js"),
      // @aws-sdk/client-dynamodb crashes via @smithy/core subpath under JSDOM.
      // Tests mock stripe-transactions.ts directly; the stub satisfies imports.
      "@aws-sdk/client-dynamodb": path.resolve(__dirname, "__tests__/stubs/aws-dynamodb-stub.js"),
      // @aws-sdk/client-bedrock-runtime shares the same @aws-sdk/util-endpoints
      // crash under JSDOM. Tests mock bedrock-chat.ts directly.
      "@aws-sdk/client-bedrock-runtime": path.resolve(
        __dirname,
        "__tests__/stubs/aws-bedrock-runtime-stub.js"
      ),
      // @aws-sdk/client-sesv2 shares the same crash. Tests mock email.ts directly.
      "@aws-sdk/client-sesv2": path.resolve(__dirname, "__tests__/stubs/aws-sesv2-stub.js"),
    },
  },
  define: {
    // Don't override NODE_ENV — setup.ts relies on it being "test"
  },
  test: {
    environment: "jsdom",
    pool: "forks",
    server: {
      deps: {
        // next-auth imports next/server as bare ESM specifier. Inlining lets
        // Vitest pre-transform the import through its alias map.
        inline: ["next-auth", "@auth/core", "next-intl"],
      },
    },
    maxWorkers: 2,
    testTimeout: 15000,
    include: ["__tests__/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
    // etl-aws-cost-to-lake imports @dsnp/parquetjs from scripts/etl/'s
    // separate npm project. Vitest's root resolver can't see it, and
    // adding it at root would duplicate a heavy native-build dep. Skip
    // here; the script is exercised by the live ETL workflow run.
    //
    // Orphaned suites: Notion CMS APIs removed (AppFlowy is live); agent tests
    // need optional `redis` which is not a root dependency. Exclude leftovers.
    exclude: [
      "__tests__/etl-aws-cost-to-lake.test.ts",
      "__tests__/admin-ops-api.test.ts",
      "__tests__/remaining-api-routes.test.ts",
      "tests/BaseAgent.test.ts",
      "tests/Orchestrator.test.ts",
    ],
    reporters: ["default"],
    setupFiles: ["./__tests__/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "./coverage/vitest",
      clean: false,
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/app/**/loading.tsx",
        "src/app/**/error.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/layout.tsx",
        "src/**/types.ts",
        "src/**/index.ts",
      ],
      // Ratchet thresholds: set a few points below the current measured
      // coverage so CI fails on a regression but tolerates normal variance.
      // Measured 2026-06-09: lines 49.98 / stmts 48.51 / funcs 39.01 / branches 39.27.
      // Raise these as coverage improves; never lower them.
      thresholds: {
        lines: 47,
        functions: 37,
        branches: 37,
        statements: 46,
      },
    },
  },
});
