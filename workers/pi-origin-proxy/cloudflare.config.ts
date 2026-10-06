import { bindings, defineConfig } from "cf/config";

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
		// routes reviewed: `domains` above == the two custom_domain routes from
		// wrangler.jsonc (apex + www). manage.cloudless.gr stays off this Worker
		// (served directly by the Cloudflare Tunnel) — do not add it here.
		// No cron triggers: the cf DSL omits `triggers` when no scheduled
		// triggers are declared. wrangler.jsonc keeps an explicit `crons: []`;
		// verified via CF API that cloudless2 has 0 attached schedules, so
		// nothing is orphaned by the omission.
	},
});
