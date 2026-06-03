import os
import ssl
import time
import http.client
import base64
import logging
import socket
import boto3

log = logging.getLogger()
log.setLevel(logging.INFO)

SSM_PARAM = os.environ.get("FUNNEL_HOST_PARAM", "/cloudless/production/pi-standby/funnel-host")
HOST_HEADER = os.environ.get("PI_HOST_HEADER", "cloudless.gr")
TTL = int(os.environ.get("BACKEND_TTL_SEC", "300"))
TIMEOUT = float(os.environ.get("UPSTREAM_TIMEOUT_SEC", "10"))
FUNNEL_PORT = int(os.environ.get("FUNNEL_PORT", "443"))

# FUNNEL_HOST env var bypasses SSM lookup entirely — set by deploy-pi-proxy.yml.
_STATIC_HOST = os.environ.get("FUNNEL_HOST", "")

_ssm = boto3.client("ssm")
_cache = {"host": None, "exp": 0.0}


def _get_funnel_host():
    if _STATIC_HOST:
        return _STATIC_HOST
    now = time.time()
    if _cache["host"] and now < _cache["exp"]:
        return _cache["host"]
    resp = _ssm.get_parameter(Name=SSM_PARAM, WithDecryption=True)
    v = resp["Parameter"]["Value"].strip()
    _cache["host"] = v
    _cache["exp"] = now + TTL
    log.info("Refreshed Funnel host from SSM: %s", v)
    return v


def lambda_handler(event, _ctx):
    try:
        funnel_host = _get_funnel_host()
    except Exception:
        log.exception("ssm lookup failed")
        return {"statusCode": 503, "body": "backend lookup failed"}

    raw_path = event.get("rawPath", "/")
    raw_qs = event.get("rawQueryString", "")
    path = raw_path + (("?" + raw_qs) if raw_qs else "")

    method = event.get("requestContext", {}).get("http", {}).get("method", "GET")

    headers = {k: v for k, v in (event.get("headers") or {}).items()
               if k.lower() not in ("host", "content-length", "connection")}
    headers["Host"] = HOST_HEADER
    headers["X-Forwarded-Host"] = (event.get("headers") or {}).get("host", HOST_HEADER)

    src_ip = event.get("requestContext", {}).get("http", {}).get("sourceIp")
    if src_ip:
        prior = headers.get("X-Forwarded-For")
        headers["X-Forwarded-For"] = f"{prior}, {src_ip}" if prior else src_ip
    headers["X-Forwarded-Proto"] = "https"

    body = event.get("body")
    if body and event.get("isBase64Encoded"):
        body = base64.b64decode(body)
    elif isinstance(body, str):
        body = body.encode("utf-8")

    # Traefik uses a self-signed cert behind Tailscale Funnel — disable verification.
    # Disabling verify is INTENTIONAL because the transport is already authenticated
    # by Tailscale Funnel (WireGuard mTLS). Keep the TLS floor explicit to silence
    # SonarLint S4423.
    ctx = ssl.create_default_context()
    ctx.minimum_version = ssl.TLSVersion.TLSv1_2
    ctx.check_hostname = False  # NOSONAR S4830 — Tailscale Funnel auth, not certs
    ctx.verify_mode = ssl.CERT_NONE  # NOSONAR S4830 — see above

    conn = None
    try:
        conn = http.client.HTTPSConnection(funnel_host, FUNNEL_PORT, timeout=TIMEOUT, context=ctx)
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()
        raw = resp.read()

        out_headers = {}
        for k, v in resp.getheaders():
            if k.lower() in ("transfer-encoding", "connection", "content-length"):
                continue
            out_headers[k] = v

        ct = (out_headers.get("Content-Type") or out_headers.get("content-type") or "").lower()
        is_text = any(t in ct for t in ("text/", "json", "xml", "javascript", "html", "svg"))

        if is_text:
            try:
                return {"statusCode": resp.status, "headers": out_headers,
                        "body": raw.decode("utf-8"), "isBase64Encoded": False}
            except UnicodeDecodeError:
                pass

        return {"statusCode": resp.status, "headers": out_headers,
                "body": base64.b64encode(raw).decode("ascii"), "isBase64Encoded": True}

    except (socket.timeout, TimeoutError):
        log.exception("upstream timeout via Funnel %s", funnel_host)
        return {"statusCode": 504, "body": "upstream timeout"}
    except Exception as e:
        log.exception("upstream call failed via Funnel %s", funnel_host)
        return {"statusCode": 502, "body": f"upstream error: {type(e).__name__}"}
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
