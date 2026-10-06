import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	worker: {
		name: "cloudless-esp32-proxy",
		compatibilityDate: "2025-05-01",
		compatibilityFlags: [
			"nodejs_compat",
		],
		entrypoint: "src/index.ts",
		env: {
			ALERT_API_URL: bindings.text("http://192.168.1.128:30800"),
			ALLOWED_ORIGIN: bindings.text("http://localhost:4000"),
		},
	},
});
