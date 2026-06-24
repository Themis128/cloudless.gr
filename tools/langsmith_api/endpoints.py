from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict


REGISTRY_PATH = Path(__file__).with_name("endpoints.json")


def load_endpoint_registry() -> Dict[str, Dict[str, Any]]:
    return json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))


def list_endpoints() -> Dict[str, Dict[str, Any]]:
    return load_endpoint_registry()


def get_endpoint(name: str) -> Dict[str, Any]:
    registry = load_endpoint_registry()

    if name not in registry:
        available = ", ".join(sorted(registry))
        raise KeyError(f"Unknown endpoint: {name}. Available endpoints: {available}")

    return registry[name]
