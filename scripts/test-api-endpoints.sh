#!/bin/bash
# Test all API endpoints against deployed app

BASE_URL="${1:-https://cloudless.gr}"
echo "Testing API endpoints against: $BASE_URL"
echo "========================================"

# Public GET endpoints
echo -e "\n## Public GET Endpoints:"
for endpoint in "/api/health" "/api/services" "/api/case-studies" "/api/blog" "/api/testimonials" "/api/faqs" "/api/recommendations" "/api/search" "/api/pwa-manifest"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    echo "GET $endpoint -> $status"
done

# Dynamic GET endpoints
echo -e "\n## Dynamic GET Endpoints:"
for endpoint in "/api/blog/hello-world" "/api/case-studies/sample" "/api/docs/getting-started"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    echo "GET $endpoint -> $status"
done

# Public POST endpoints
echo -e "\n## Public POST Endpoints:"
for endpoint in "/api/contact" "/api/subscribe" "/api/calendar/book" "/api/chat" "/api/agent/book"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL$endpoint" 2>/dev/null)
    echo "POST $endpoint -> $status"
done

# Protected endpoints
echo -e "\n## Protected/Admin Endpoints:"
for endpoint in "/api/admin" "/api/admin/auth-audit" "/api/user/profile" "/api/internal" "/api/workflows" "/api/portal/me"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    echo "GET $endpoint -> $status"
done

# Webhook endpoints (GET should fail)
echo -e "\n## Webhook Endpoints (GET should return 404/405):"
for endpoint in "/api/webhooks/stripe" "/api/webhooks/content"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    echo "GET $endpoint -> $status"
done

# Auth endpoints
echo -e "\n## Auth Endpoints:"
for endpoint in "/api/auth/session" "/api/auth/csrf" "/api/auth/providers"; do
    status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null)
    echo "GET $endpoint -> $status"
done

echo -e "\n========================================"
echo "API endpoint testing complete"