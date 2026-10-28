"""Cloudflare Workers AI model defaults optimized for the free neuron pool.

All Workers AI models share the same daily free allocation (10,000 Neurons).
There is no unlimited "free model" — these IDs are free-*tier eligible* and
low neuron cost so a carousel run is more likely to fit in the daily budget.

Pricing reference: https://developers.cloudflare.com/workers-ai/platform/pricing/

Neuron costs (measured 2026-08-31 on account fb7dc7b69b662480cd5961a4d1913c78):
  llama-4-scout-17b-16e-instruct  0.6 neurons  (text + vision, function calling)
  llama-3.2-3b-instruct           0.3 neurons  (tiny text fallback)
  llama-3.3-70b-instruct-fp8-fast 1.5 neurons  (best quality text)
  moondream3.1-9B-A2B            24.0 neurons  (dedicated vision fallback)
  flux-1-schnell                172.8 neurons  (txt2img, 4 steps)
  bge-m3                          0.0 neurons  (multilingual embeddings)
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Text / LLM models
# ---------------------------------------------------------------------------

# High-quality structured-output model (70B fp8 — free tier eligible, fast).
# Best for carousel copy, NLP plain-English rewrite, prompt enhancement.
CF_TEXT_FREE = "@cf/meta/llama-3.3-70b-instruct-fp8-fast"

# Multimodal model (17B MoE, 0.6 neurons) — cheapest text model, also does vision.
# Best for short-form content, tag generation, and cost-sensitive workloads.
CF_TEXT_CHEAP = "@cf/meta/llama-4-scout-17b-16e-instruct"

# Lightweight fallback when 70B is capacity-limited (3B ~ 1/10 the cost).
CF_TEXT_FREE_SMALL = "@cf/meta/llama-3.2-3b-instruct"
# Tiny emergency fallback
CF_TEXT_FREE_TINY = "@cf/meta/llama-3.2-1b-instruct"

# ---------------------------------------------------------------------------
# Vision models (image-to-text)
# ---------------------------------------------------------------------------

# Primary vision model: llama-4-scout (0.6 neurons, multimodal, function calling).
# 40x cheaper than moondream and handles captioning + VQA via chat format.
CF_VISION_PRIMARY = "@cf/meta/llama-4-scout-17b-16e-instruct"
# Fallback: moondream (24 neurons, dedicated vision tasks: caption/query/point/detect)
CF_VISION_FALLBACK = "@cf/moondream/moondream3.1-9B-A2B"

# ---------------------------------------------------------------------------
# Image generation models
# ---------------------------------------------------------------------------

# Fast txt2img — FLUX.1-schnell (4-8 steps, free tier, 172.8 neurons/image)
CF_TXT2IMG_FREE = "@cf/black-forest-labs/flux-1-schnell"

# img2img enhancement — SD v1.5 img2img (free tier; far cheaper than FLUX.2)
CF_IMG2IMG_FREE = "@cf/runwayml/stable-diffusion-v1-5-img2img"

# ---------------------------------------------------------------------------
# Per-task model map (paid plan 2026-10-28+ — quality over neuron cost)
# ---------------------------------------------------------------------------
# Every media pipeline should pick from this map, not a single default.
# Video has no Workers AI model — ComfyUI Wan/LTX stays the only path.
CF_TASK_MODELS = {
    # carousel backgrounds + static images — schnell: 4 steps, proven
    "carousel_bg":  CF_TXT2IMG_FREE,
    "static_image": CF_TXT2IMG_FREE,
    # infographics / posters — same schnell; sharper prompts matter more
    "infographic":  CF_TXT2IMG_FREE,
    "poster":       CF_TXT2IMG_FREE,
    # image enhancement (resize/style-transfer of existing art)
    "img2img":      CF_IMG2IMG_FREE,
    # video — no Workers AI model; ComfyUI Wan2.2/LTX is the only path
    "video":        None,
    # text for each task
    "copy":         CF_TEXT_FREE,
    "nlp_short":    CF_TEXT_CHEAP,
    "caption":      CF_TEXT_CHEAP,
    "embeddings":   CF_EMBEDDING_MULTILINGUAL,
    "vision":       CF_VISION_PRIMARY,
}

# Avoid as default on free tier (higher neuron cost):
#   @cf/black-forest-labs/flux-2-klein-4b / flux-2-klein-9b (require multipart API)
#   @cf/meta/llama-3.1-8b-instruct (non-fp8)
# Paid-only frontier models (403 on free): kimi-k2.6, glm-5.2/5.3, deepseek-v4, etc.

# ---------------------------------------------------------------------------
# Embedding models (for Chroma semantic search)
# ---------------------------------------------------------------------------

# Multilingual embeddings (supports Greek + 100 languages, 0 neurons)
CF_EMBEDDING_MULTILINGUAL = "@cf/baai/bge-m3"
# Lightweight English embeddings (0 neurons)
CF_EMBEDDING_EN = "@cf/baai/bge-base-en-v1.5"

# ---------------------------------------------------------------------------
# Groq — primary text fallback (free tier: 14.4K req/day, 30 RPM)
# ---------------------------------------------------------------------------
# OpenAI-compatible API, no credit card required.
# https://console.groq.com/docs/rate-limits

GROQ_API_BASE = "https://api.groq.com/openai/v1"
GROQ_TEXT_FALLBACK = "qwen/qwen3.8-27b"

# ---------------------------------------------------------------------------
# Pixazo — primary image fallback (FLUX Schnell free, 60 RPM, no daily cap)
# ---------------------------------------------------------------------------
# Free FLUX Schnell, no credit card required, returns image URL.
# https://api-console.pixazo.ai/

PIXAZO_TXT2IMG_URL = "https://gateway.pixazo.ai/flux-1-schnell/v1/getData"

# ---------------------------------------------------------------------------
# Together AI — secondary image fallback (FLUX.1-schnell, $25 signup credits)
# ---------------------------------------------------------------------------

TOGETHER_API_BASE = "https://api.together.xyz/v1"
TOGETHER_TXT2IMG_FALLBACK = "black-forest-labs/FLUX.1-schnell-Free"
TOGETHER_TEXT_FALLBACK = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

# ---------------------------------------------------------------------------
# Hugging Face Inference Providers — tertiary failover
# ---------------------------------------------------------------------------
# HF migrated to router.huggingface.co with credit-based billing.
# Free tier: $0.10/month — exhausts quickly, kept as last cloud fallback.

HF_API_BASE = "https://router.huggingface.co"
HF_TEXT_FALLBACK = "Qwen/Qwen2.5-72B-Instruct"
HF_TXT2IMG_FALLBACK = "black-forest-labs/FLUX.1-schnell"
HF_IMG2IMG_FALLBACK = "timbrooks/instruct-pix2pix"

# ---------------------------------------------------------------------------
# Carousel pipeline defaults
# ---------------------------------------------------------------------------

CF_CAROUSEL_DEFAULTS: dict[str, str | int] = {
    "text_model": CF_TEXT_FREE,
    "txt2img_model": CF_TXT2IMG_FREE,
    "txt2img_steps": 4,
}

# ---------------------------------------------------------------------------
# Per-content-type workflow configs
# Fallback chain: CF → Groq/Together → HF → Ollama
# ---------------------------------------------------------------------------

CONTENT_WORKFLOW_CONFIGS: dict[str, dict] = {
    "carousel": {
        "content_type": "carousel",
        "name": "Carousel Generator",
        "description": "AI-powered LinkedIn carousel with FLUX txt2img backgrounds, CF→Groq→Ollama text / CF→Together txt2img fallback",
        "text_model": CF_TEXT_FREE,
        "txt2img_model": CF_TXT2IMG_FREE,
        "groq_text_fallback": GROQ_TEXT_FALLBACK,
        "together_txt2img_fallback": TOGETHER_TXT2IMG_FALLBACK,
        "hf_text_fallback": HF_TEXT_FALLBACK,
        "hf_txt2img_fallback": HF_TXT2IMG_FALLBACK,
        "txt2img_steps": 4,
    },
    "post": {
        "content_type": "post",
        "name": "Social Post Generator",
        "description": "AI-generated posts for LinkedIn, Twitter, Instagram and Facebook",
        "text_model": CF_TEXT_FREE,
        "groq_text_fallback": GROQ_TEXT_FALLBACK,
        "hf_text_fallback": HF_TEXT_FALLBACK,
    },
    "thread": {
        "content_type": "thread",
        "name": "Thread Generator",
        "description": "Multi-tweet Twitter/X and Threads content split to platform limits",
        "text_model": CF_TEXT_FREE,
        "groq_text_fallback": GROQ_TEXT_FALLBACK,
        "hf_text_fallback": HF_TEXT_FALLBACK,
    },
    "story": {
        "content_type": "story",
        "name": "Story Creator",
        "description": "Instagram and Facebook story images generated with FLUX",
        "txt2img_model": CF_TXT2IMG_FREE,
        "together_txt2img_fallback": TOGETHER_TXT2IMG_FALLBACK,
        "hf_txt2img_fallback": HF_TXT2IMG_FALLBACK,
        "txt2img_steps": 4,
    },
    "poll": {
        "content_type": "poll",
        "name": "Poll Generator",
        "description": "Engaging polls with AI-generated question and options",
        "text_model": CF_TEXT_FREE,
        "groq_text_fallback": GROQ_TEXT_FALLBACK,
        "hf_text_fallback": HF_TEXT_FALLBACK,
    },
    "article": {
        "content_type": "article",
        "name": "Article Publisher",
        "description": "Long-form LinkedIn articles with AI-structured content",
        "text_model": CF_TEXT_FREE,
        "groq_text_fallback": GROQ_TEXT_FALLBACK,
        "hf_text_fallback": HF_TEXT_FALLBACK,
    },
}
