#!/usr/bin/env python3
"""Test all API endpoints against deployed app.

Usage: test-api-endpoints.py [BASE_URL]  (default https://cloudless.gr)"""

import sys
import urllib.error
import urllib.request

base_url = (sys.argv[1] if len(sys.argv) > 1 else "https://cloudless.gr").rstrip("/")
print(f"Testing API endpoints against: {base_url}")
print("=" * 40)


def status(method: str, path: str, body: bool = False) -> int:
    req = urllib.request.Request(
        base_url + path,
        data=b"{}" if body else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    try:
        return urllib.request.urlopen(req, timeout=20).status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


GROUPS = [
    (
        "Public GET Endpoints",
        "GET",
        False,
        [
            "/api/health",
            "/api/services",
            "/api/case-studies",
            "/api/blog",
            "/api/testimonials",
            "/api/faqs",
            "/api/recommendations",
            "/api/search",
            "/api/pwa-manifest",
        ],
    ),
    (
        "Dynamic GET Endpoints",
        "GET",
        False,
        ["/api/blog/hello-world", "/api/case-studies/sample", "/api/docs/getting-started"],
    ),
    (
        "Public POST Endpoints",
        "POST",
        True,
        ["/api/contact", "/api/subscribe", "/api/calendar/book", "/api/chat", "/api/agent/book"],
    ),
    (
        "Protected/Admin Endpoints",
        "GET",
        False,
        [
            "/api/admin",
            "/api/admin/auth-audit",
            "/api/user/profile",
            "/api/internal",
            "/api/workflows",
            "/api/portal/me",
        ],
    ),
    (
        "Webhook Endpoints (GET should return 404/405)",
        "GET",
        False,
        ["/api/webhooks/stripe", "/api/webhooks/content"],
    ),
    (
        "Auth Endpoints",
        "GET",
        False,
        ["/api/auth/session", "/api/auth/csrf", "/api/auth/providers"],
    ),
]

for title, method, body, endpoints in GROUPS:
    print(f"\n## {title}:")
    for ep in endpoints:
        print(f"{method} {ep} -> {status(method, ep, body)}")

print("\n" + "=" * 40)
print("API endpoint testing complete")
