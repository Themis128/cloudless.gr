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
		name: "postiz-ai-proxy",
		compatibilityDate: "2026-08-15",
		entrypoint: "src/index.ts",
		observability: {
			enabled: true,
		},
		env: {
			NVIDIA_BASE_URL: bindings.text("https://integrate.api.nvidia.com/v1"),
			NVIDIA_MODEL: bindings.text("nvidia/nemotron-3-super-120b-a12b"),
			NVIDIA_POSTIZ_MODEL: bindings.text("nvidia/nemotron-3-super-120b-a12b"),
			POLLINATIONS_IMAGE_MODEL: bindings.text("flux"),
		},
	},
});
