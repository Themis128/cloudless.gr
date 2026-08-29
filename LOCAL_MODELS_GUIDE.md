# Local Models Guide for Image and Text Generation

This guide provides information about free local models you can download and run for image and text generation tasks, with a focus on CPU-friendly options.

## At-a-glance Comparison

| Model | Type | Where to Get | Approx Size | CPU-friendly Options | Notes |
|-------|------|--------------|-------------|----------------------|-------|
| Stable Diffusion 1.5 | Image (text→image) | Hugging Face; Stability | ~4–8 GB (weights) | 4-bit/8-bit quantized checkpoints; diffusers + CPU | Mature, many checkpoints, ComfyUI support |
| Stable Diffusion 2.1 | Image | Hugging Face; Stability | ~4–8 GB | Quantized variants; use smaller VAE or low-res settings | Better fidelity for some prompts; check license |
| Stable Diffusion XL (SDXL) | Image (higher quality) | Stability / Hugging Face | 10–20+ GB | Not ideal on CPU; smaller distilled variants exist | Best quality but heavier; prefer GPU |
| Llama 2 (7B) | LLM (chat/assistant) | Meta (Hugging Face mirrors) | ~13–14 GB (FP16); smaller quantized | 4-bit/8-bit quantized weights (GGML, AWQ) for CPU | Good local chat model; licensing requires acceptance |
| Mistral 7B | LLM | Hugging Face / Mistral | ~14 GB (FP16) | GGML/4-bit quantized builds for CPU | Strong open‑weight 7B model; good quality/efficiency |
| Vicuna 7B | LLM (instruction tuned) | Hugging Face community checkpoints | ~13–14 GB | Quantized GGML builds exist | Instruction-tuned Llama derivative; check license/source |
| Stable Audio / Audio LLMs | Audio generation/processing | Hugging Face | varies | Smaller models exist; CPU possible for light tasks | Use for TTS or audio tasks; check model pages |

## Where to Download (Direct, Reliable Sources)

### Hugging Face Model Hub
- Central place for many Stable Diffusion checkpoints, Llama 2 mirrors, Mistral, Vicuna community uploads, and quantized variants
- Use [huggingface.co/models](https://huggingface.co/models) and check the model's README for license and usage instructions

### Stability.ai / SDXL Pages
- Official pages and links for Stable Diffusion and SDXL models
- Often point to Hugging Face or direct downloads

### GGML / Community Builds
- For CPU-friendly LLMs (Llama 2, Mistral, Vicuna), look for GGML-converted weights and quantized builds (4-bit/8-bit) on Hugging Face or community repos
- These are optimized for local CPU inference

## Practical Recommendations by Use Case

### Image Generation with ComfyUI (Fastest Path)
1. Start with **Stable Diffusion 1.5** (smallest ecosystem friction)
2. Download the `sd-v1-5` checkpoint from Hugging Face or a Stability release page
3. Use ComfyUI's SD nodes or diffusers backend
4. For CPU: use lower resolution (512×512) and enable attention optimizations or quantized weights
5. Upgrade to SDXL only if you have GPU or plan to use a cloud GPU (much better quality but heavier)

### Local Chat/Assistant (LLMs)
1. **Llama 2 7B** - Good balance of quality and resource needs
   - Get the model from Meta/Hugging Face
   - Use a GGML or 4-bit quantized build for CPU
   - Accept Meta's license if required
   
2. **Mistral 7B** - Strong open model
   - Similar workflow: download FP16 then convert/quantize for CPU inference
   
3. **Vicuna** - Instruction-tuned variant for chat
   - Often requires a base Llama checkpoint plus Vicuna weights
   - Use community GGML conversions for CPU

### Very Small, Low-Resource Models for CPU-only
- Look for distilled or quantized variants (4-bit AWQ, GGML) on Hugging Face
- These let you run 7B-class models on a decent CPU with ~16–32 GB RAM

## Quick Setup Notes (Image + LLM Local)

### ComfyUI
- Supports Stable Diffusion checkpoints directly
- Drop `.ckpt` or `.safetensors` files into the models folder and restart UI
- Use ComfyUI community nodes for SDXL or specialized models

### LLM Runtimes
- Use `llama.cpp/ggml` for CPU inference
- Use `transformers + bitsandbytes` for GPU/FP16
- For best CPU performance: use GGML-converted and quantized weights

### Quantization
- 4-bit/8-bit quantization reduces memory and speeds up inference
- Check each model's conversion instructions and community tools (e.g., ggml, llama.cpp, gguf converters)

## Licensing and Safety
- Check each model's license on its Hugging Face or official page before using it in production
- Some models require accepting terms (e.g., Llama 2)
- Avoid copyrighted checkpoints that are not cleared for redistribution
- Prefer official releases or community uploads that include license information

## Notes on Specific Models

### Stable Diffusion Variants
- **SD 1.5**: Most widely supported, largest community, many fine-tuned versions available
- **SD 2.1**: Improved architecture but different licensing; check if your use case is permitted
- **SDXL**: Significantly better quality but requires more resources; consider using distilled versions like SDXL-Turbo for faster generation

### LLM Variants
- **Llama 2**: Requires accepting Meta's license; available in 7B, 13B, and 70B sizes
- **Mistral 7B**: Fully open-source (Apache 2.0), no usage restrictions
- **Vicuna**: Based on Llama, requires checking the base model license; instruction-tuned for better chat performance

## Hardware Considerations

### For Image Generation:
- **Minimum CPU**: Modern quad-core CPU
- **Recommended RAM**: 16GB+ for SD 1.5/SD 2.1, 32GB+ for SDXL
- **Storage**: 10-20GB+ depending on model variants
- **Optimization**: Use CPU-specific builds, quantized VAE, attention slicing

### For Text Generation (LLMs):
- **Minimum CPU**: Modern CPU with AVX2 support
- **RAM Requirements**: 
  - 7B model (4-bit quantized): ~4-6GB RAM
  - 7B model (8-bit quantized): ~6-8GB RAM
  - 7B model (FP16): ~14GB+ RAM
- **Storage**: 4-15GB+ depending on quantization level

## Community Resources
- **ComfyUI**: https://github.com/comfyanonymous/ComfyUI
- **llama.cpp**: https://github.com/ggerganov/llama.cpp
- **text-generation-webui**: https://github.com/oobabooga/text-generation-webui
- **Automatic1111 WebUI**: https://github.com/AUTOMATIC1111/stable-diffusion-webui

This guide is based on current community practices and may evolve as new models and optimization techniques emerge.