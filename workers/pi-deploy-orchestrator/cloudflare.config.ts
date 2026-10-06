import { bindings, defineConfig, exports } from "cf/config";

export default defineConfig({
	accountId: "fb7dc7b69b662480cd5961a4d1913c78",
	worker: {
		name: "pi-deploy-orchestrator",
		compatibilityDate: "2026-08-07",
		entrypoint: "src/index.ts",
		workersDev: true,
		env: {
			HEALTH_URL: bindings.text("https://pi-origin.cloudless.gr/api/health"),
			HEALTH_URL_FALLBACK: bindings.text("https://cloudless.gr/api/health"),
			R2_ARTIFACT_PREFIX: bindings.text("releases"),
			RELEASES: bindings.r2({
				name: "cloudless-pi-releases",
			}),
			PI_DEPLOY: bindings.workflow({
				name: "pi-deploy",
				worker: "pi-deploy-orchestrator",
				exportName: "PiDeployWorkflow",
			}),
		},
		exports: {
			PiDeployWorkflow: exports.workflow({
				name: "pi-deploy",
			}),
		},
	},
});
