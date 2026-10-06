import { bindings, defineConfig } from "cf/config";

/**
 * This migration needs manual work. Resolve every TODO in this file, then remove the error below.
 */
/**
 * TODO(@cloudflare): cf migrate: config.routes.0: Custom-domain route options require manual review.
 */
/**
 * TODO(@cloudflare): cf migrate: config.routes.1: Custom-domain route options require manual review.
 */
/**
 * TODO(@cloudflare): cf migrate: An ancestor package.json was found, but it was not modified because it may belong to another project. Install `cf@latest` as a dev dependency in the package that owns this Worker.
 */
throw new Error("Migration incomplete. Resolve every cf migrate TODO in `cloudflare.config.ts`.");

export default defineConfig({
	accountId: "fb7dc7b69b662480cd5961a4d1913c78",
	worker: {
		name: "cloudless2",
		compatibilityDate: "2026-08-07",
		entrypoint: "src/index.ts",
		domains: [
			"cloudless.gr",
			"www.cloudless.gr",
		],
		env: {
			PI_ORIGIN_HOST: bindings.text("pi-origin.cloudless.gr"),
			PI_TIMEOUT_MS: bindings.text("30000"),
			ANALYTICS: bindings.analyticsEngineDataset({
				name: "cloudless_analytics",
			}),
		},
		/**
		 * TODO(@cloudflare): cf migrate: Custom-domain route options require manual review.
		 */
		/**
		 * TODO(@cloudflare): cf migrate: Custom-domain route options require manual review.
		 */
	},
});
