import { bindings, defineConfig } from "cf/config";

/**
 * This migration needs manual work. Resolve every TODO in this file, then remove the error below.
 */
/**
 * TODO(@cloudflare): cf migrate: An ancestor package.json was found, but it was not modified because it may belong to another project. Install `cf@latest` as a dev dependency in the package that owns this Worker.
 */
throw new Error("Migration incomplete. Resolve every cf migrate TODO in `cloudflare.config.ts`.");

export default defineConfig({
	accountId: "fb7dc7b69b662480cd5961a4d1913c78",
	worker: {
		name: "cloudless-analytics",
		compatibilityDate: "2026-07-05",
		entrypoint: "index-analytics.ts",
		env: {
			ACCOUNT_ID: bindings.text("fb7dc7b69b662480cd5961a4d1913c78"),
			ANALYTICS: bindings.analyticsEngineDataset({
				name: "cloudless_analytics",
			}),
			DATALAKE_BUCKET: bindings.r2({
				name: "datalake-bucket",
			}),
			ANALYTICS_BUCKET: bindings.r2({
				name: "cloudless-analytics",
			}),
		},
	},
});
