"""Fly.io HA Failover Proxy for cloudless.gr.

Primary: Cloudflare Workers thin edge (cloudless.gr → Pi)
Fallback: pi-origin.cloudless.gr (Tunnel → k3s NodePort, bypasses Workers)
"""
import os
import time

import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI()

PRIMARY_HOST = os.getenv("PRIMARY_HOST", "cloudless.gr")
FALLBACK_HOST = os.getenv("FALLBACK_HOST", "pi-origin.cloudless.gr")

health_cache = {"healthy": True, "timestamp": 0.0}
CACHE_TTL = 30


async def check_primary_health() -> bool:
    now = time.time()
    if now - health_cache["timestamp"] < CACHE_TTL:
        return bool(health_cache["healthy"])

    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
            resp = await client.get(f"https://{PRIMARY_HOST}/api/health")
            healthy = resp.status_code == 200
            if healthy:
                try:
                    data = resp.json()
                    if isinstance(data, dict) and data.get("origin") == "down":
                        healthy = False
                except Exception:
                    pass
    except Exception:
        healthy = False

    health_cache["healthy"] = healthy
    health_cache["timestamp"] = now
    return healthy


async def proxy_to_backend(request: Request, backend_host: str) -> Response:
    url = f"https://{backend_host}{request.url.path}"
    if request.url.query:
        url += f"?{request.url.query}"

    headers = dict(request.headers)
    for h in [
        "host",
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailers",
        "transfer-encoding",
        "upgrade",
    ]:
        headers.pop(h, None)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
        body = await request.body()
        resp = await client.request(
            request.method,
            url,
            headers=headers,
            content=body,
        )

    out_headers = {
        k: v
        for k, v in resp.headers.items()
        if k.lower() not in {"content-encoding", "transfer-encoding", "connection"}
    }
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers=out_headers,
        media_type=resp.headers.get("content-type"),
    )


@app.get("/health")
async def health():
    healthy = await check_primary_health()
    return {
        "status": "healthy" if healthy else "degraded",
        "primary": PRIMARY_HOST,
        "fallback": FALLBACK_HOST,
        "primary_healthy": healthy,
    }


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy(request: Request, path: str):
    healthy = await check_primary_health()
    backend = PRIMARY_HOST if healthy else FALLBACK_HOST
    return await proxy_to_backend(request, backend)
