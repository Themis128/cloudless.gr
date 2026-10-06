import { bindings, defineConfig } from "cf/config";

export default defineConfig({
	accountId: "fb7dc7b69b662480cd5961a4d1913c78",
	worker: {
		name: "mail-ingest",
		compatibilityDate: "2026-05-01",
		entrypoint: "src/index.ts",
		workersDev: false,
		env: {
			MAIL_INGEST_URL: bindings.text("https://webmail.cloudless.gr/ingest"),
			FALLBACK_FORWARD: bindings.text("themis.baltzakis@gmail.com"),
		},
	},
});
