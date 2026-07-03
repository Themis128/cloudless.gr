#!/usr/bin/env python3
"""Test script for Grafana Slack Proxy."""

import json
import requests

# Test payload matching your log-based alerts
test_payload = {
    "alerts": [
        {
            "labels": {
                "app": "n8n",
                "severity": "critical",
                "category": "workflow",
            },
            "annotations": {
                "summary": "n8n workflow error detected",
                "description": "n8n container has recorded workflow errors in the last 5 minutes",
                "runbook_url": "https://docs.cloudless.gr/operations/n8n",
            },
            "startsAt": "2026-07-03T21:45:00Z",
            "status": "firing",
        },
        {
            "labels": {
                "app": "espocrm",
                "severity": "high",
                "category": "database",
            },
            "annotations": {
                "summary": "EspoCRM database error detected",
                "description": "EspoCRM container has recorded database errors",
                "runbook_url": "https://docs.cloudless.gr/operations/espocrm",
            },
            "startsAt": "2026-07-03T21:46:00Z",
            "status": "firing",
        },
        {
            "labels": {
                "app": "meilisearch",
                "severity": "warning",
                "category": "search",
            },
            "annotations": {
                "summary": "Meilisearch indexing error detected",
                "description": "Meilisearch container has recorded indexing errors",
                "runbook_url": "https://docs.cloudless.gr/operations/meilisearch",
            },
            "startsAt": "2026-07-03T21:47:00Z",
            "status": "firing",
        },
    ],
    "groupLabels": {
        "alertname": "LogBasedAlerts",
    },
    "commonLabels": {
        "app": "log-based-alerts",
        "severity": "critical",
    },
    "commonAnnotations": {},
    "externalURL": "http://grafana:3000",
    "version": "1",
    "groupKey": "{}:{alertname=LogBasedAlerts}",
}

# Test the local server
url = "http://localhost:5001/alerts"

print(f"Testing Grafana Slack Proxy at {url}")
print(f"Payload: {json.dumps(test_payload, indent=2)}")

try:
    response = requests.post(url, json=test_payload, timeout=10)
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
    print("\nIs the proxy running? Start it with: python main.py")
