import { bindings, defineConfig, triggers } from "cf/config";

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
