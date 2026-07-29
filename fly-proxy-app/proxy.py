"""Fly.io HA Failover Proxy for cloudless.gr.

Primary: workers.dev thin edge (direct HTTPS, no Bot Fight)
Fallback: Pi k3s NodePort over Tailscale userspace SOCKS5
"""
from __future__ import annotations

import os
import time

import httpx
from fastapi import FastAPI, Request, Response

app = FastAPI()

PRIMARY_BASE = os.getenv(
    "PRIMARY_BASE", "https://cloudless2.baltzakis-themis.workers.dev"
).rstrip("/")
FALLBACK_BASE = os.getenv(
    "FALLBACK_BASE", "http://100.74.191.58:30300"
).rstrip("/")
PUBLIC_HOST = os.getenv("PUBLIC_HOST", "cloudless.gr")
# Set by start.sh when Tailscale userspace SOCKS is listening
TS_SOCKS_PROXY = os.getenv("TS_SOCKS_PROXY", "").strip()

health_cache = {"healthy": True, "timestamp": 0.0}
CACHE_TTL = 30


def backend_headers(extra: dict[str, str] | None = None) -> dict[str, str]:
    headers: dict[str, str] = {
        "user-agent": "cloudless-fly-proxy/1.0",
        "accept": "application/json, text/html, */*",
        "x-forwarded-host": PUBLIC_HOST,
        "x-forwarded-proto": "https",
    }
    if extra:
        headers.update(extra)
    return headers


def client_for(base: str) -> httpx.AsyncClient:
    """Primary = direct; Tailscale fallback = SOCKS5 userspace proxy."""
    kwargs: dict = {"timeout": 30.0, "follow_redirects": False, "trust_env": False}
    if base == FALLBACK_BASE and TS_SOCKS_PROXY:
        kwargs["proxy"] = TS_SOCKS_PROXY
        kwargs["timeout"] = 10.0
    return httpx.AsyncClient(**kwargs)


async def check_primary_health() -> bool:
    now = time.time()
    if now - health_cache["timestamp"] < CACHE_TTL:
        return bool(health_cache["healthy"])

    try:
        async with httpx.AsyncClient(
            timeout=5.0, follow_redirects=True, trust_env=False
        ) as client:
            resp = await client.get(
                f"{PRIMARY_BASE}/api/health",
                headers=backend_headers(),
            )
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


async def proxy_to_backend(request: Request, base: str) -> Response:
    url = f"{base}{request.url.path}"
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
    headers.update(backend_headers())

    async with client_for(base) as client:
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
    fallback_ok = False
    fallback_status = 0
    fallback_error = ""
    try:
        async with client_for(FALLBACK_BASE) as client:
            r = await client.get(
                f"{FALLBACK_BASE}/api/health",
                headers=backend_headers(),
            )
            fallback_status = r.status_code
            fallback_ok = r.status_code == 200
    except Exception as e:
        fallback_ok = False
        fallback_error = type(e).__name__

    return {
        "status": "healthy" if healthy else ("degraded" if fallback_ok else "unhealthy"),
        "primary": PRIMARY_BASE,
        "fallback": FALLBACK_BASE,
        "public_host": PUBLIC_HOST,
        "primary_healthy": healthy,
        "fallback_healthy": fallback_ok,
        "fallback_status": fallback_status,
        "fallback_error": fallback_error or None,
        "socks_configured": bool(TS_SOCKS_PROXY),
    }


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def proxy(request: Request, path: str):
    healthy = await check_primary_health()
    base = PRIMARY_BASE if healthy else FALLBACK_BASE
    return await proxy_to_backend(request, base)
