import { bindings, defineConfig } from "cf/config";

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
