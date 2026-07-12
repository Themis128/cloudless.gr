"""Fly.io HA Failover Proxy for cloudless.gr.

Primary: Cloudflare Workers (cloudless.gr)
Fallback: Pi k3s via Tailscale (omv.tail8eb71.ts.net)
"""
import os

import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI()

# Backend configuration
PRIMARY_HOST = os.getenv("PRIMARY_HOST", "cloudless.gr")
FALLBACK_HOST = os.getenv("FALLBACK_HOST", "github-omv.tail4ecae1.ts.net")

# Health cache with 30s TTL
health_cache = {"healthy": True, "timestamp": 0}
CACHE_TTL = 30  # seconds


async def check_primary_health() -> bool:
    """Check if primary backend is healthy."""
    import time
    now = time.time()

    if now - health_cache["timestamp"] < CACHE_TTL:
        return health_cache["healthy"]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"https://{PRIMARY_HOST}/api/health")
            healthy = resp.status_code == 200
    except Exception:
        healthy = False

    health_cache["healthy"] = healthy
    health_cache["timestamp"] = now
    return healthy


async def proxy_to_backend(request: Request, backend_host: str) -> Response:
    """Proxy request to specified backend."""
    url = f"https://{backend_host}{request.url.path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    # Remove hop-by-hop headers
    for h in ["host", "connection", "keep-alive", "proxy-authenticate",
              "proxy-authorization", "te", "trailers", "transfer-encoding", "upgrade"]:
        headers.pop(h, None)

    async with httpx.AsyncClient(timeout=30.0) as client:
        body = await request.body()
        resp = await client.request(
            request.method,
            url,
            headers=headers,
            content=body,
            params=request.query_params
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=dict(resp.headers),
        media_type=resp.headers.get("content-type")
    )


@app.get("/health")
async def health():
    """Health check endpoint for Fly.io."""
    healthy = await check_primary_health()
    status = "healthy" if healthy else "degraded"

    return {
        "status": status,
        "primary": PRIMARY_HOST,
        "fallback": FALLBACK_HOST,
        "primary_healthy": healthy
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def proxy(request: Request, path: str):
    """Main proxy handler with automatic failover."""
    healthy = await check_primary_health()
    backend = PRIMARY_HOST if healthy else FALLBACK_HOST

    return await proxy_to_backend(request, backend)
