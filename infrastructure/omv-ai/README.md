# OMV AI Services

Kubernetes-based AI workloads running on omv-main (Pi 5, 8GB RAM, ARM64, CPU-only).

## ⚠️ Important Note on Kimi Models

**Kimi-k2.6 (moonshotai/Kimi-k2.6)** is a 1+ trillion parameter Mixture-of-Experts model.
This is **too large** for a Pi 5 (8GB RAM, no GPU).

For OMV/Pi deployment, we use **Qwen2.5-7B-Instruct Q4_K_M GGUF** which:

- Is a 7B parameter model (~4GB quantized)
- Runs on ARM64 CPU via llama-cpp-python
- Provides OpenAI-compatible `/v1/chat/completions` API
- Suitable for development/testing workloads

## Current Services

| Service | Model | Port | Namespace |
|---------|-------|------|-----------|
| llama-cpp | Qwen2.5-7B-Instruct-Q4_K_M | 30800 | omv-ai |

## Deployment

Build and deploy the ARM64-optimized container:

```bash
# Build ARM64 image on omv-main (Pi 5)
docker buildx build -f infrastructure/omv-ai/Dockerfile.pi5 \
  --platform linux/arm64 \
  -t registry.local/omv-ai/llama-cpp-python:pi5 \
  --push

# Deploy to k3s
kubectl apply -f infrastructure/omv-ai/vllm-kimi.yaml

# Watch the pod start (may take 5-10 minutes for model download)
kubectl -n omv-ai get pods -w
```

### Access

- **OpenAI-compatible endpoint** (cluster): `http://vllm-kimi.omv-ai.svc.cluster.local:8000/v1`
- **NodePort** (Tailscale): `http://omv:30800/v1`
- **Tunnel endpoint**: Add to `infrastructure/cloudflare-tunnels/` for public access

### Model Configuration

- **Model**: Qwen2.5-7B-Instruct-Q4_K_M GGUF (~4GB)
- **Backend**: llama-cpp-python OpenAI-compatible server
- **Context**: 2048 tokens
- **Threads**: 4 (CPU-only)
- **Cache**: 20Gi PVC on local-path SSD (sda1)

## Integration with Vibe-Agent

Update `vibe-env` secret to point to OMV-hosted inference:

```bash
kubectl -n vibe create secret generic vibe-env \
  --from-literal=VLLM_BASE_URL=http://vllm-kimi.omv-ai.svc.cluster.local:8000/v1 \
  --from-literal=VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct-Q4_K_M \
  --from-literal=VLLM_API_KEY=not-needed \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Tools Available

The `agents/tools/omv_k3s_tools.py` provides functions for:

- `get_cluster_pods()` - List pods in k3s cluster
- `get_cluster_services()` - List services
- `get_cluster_nodes()` - Node status
- `get_pod_logs(pod_name, namespace)` - Get pod logs
- `get_cluster_info()` - Overall cluster health

## Performance Notes

- **CPU-only**: No GPU acceleration, ~1-2 tokens/sec
- **Memory**: Model + cache ~5GB RAM, fits in Pi 5's 8GB
- **Storage**: Uses 120GB SSD via local-path (sda1)
- **Alternatives**: Smaller models like Qwen-3B or Llama-3-8B-Q4 work faster
