import { bindings, defineConfig } from "cf/config";

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
