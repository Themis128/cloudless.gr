import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	accountId: "fb7dc7b69b662480cd5961a4d1913c78",
	worker: {
		name: "espocrm-fanout",
		compatibilityDate: "2026-05-01",
		entrypoint: "src/index.ts",
		triggers: [
			triggers.queue({
				deadLetterQueue: "espocrm-events-dlq",
				maxBatchSize: 10,
				maxRetries: 5,
				name: "espocrm-events",
			}),
		],
		env: {
			ESPOCRM_EVENTS: bindings.queue({
				name: "espocrm-events",
			}),
		},
	},
});
