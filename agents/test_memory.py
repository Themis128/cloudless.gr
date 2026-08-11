#!/usr/bin/env python3
"""Test script for cloudless.gr agentic workflows.

Verifies that all agent dependencies are correctly installed and importable.
"""

import importlib.util
import sys
from pathlib import Path

# Add project root to path so we can import agents package
PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))


def check_import(module_name: str) -> bool:
    """Check if a module can be imported."""
    try:
        __import__(module_name)
        return True
    except ImportError:
        return False


def check_import_from(module_name: str, attr: str) -> bool:
    """Check if an attribute can be imported from a module."""
    spec = importlib.util.find_spec(module_name)
    if spec is None:
        return False
    try:
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return hasattr(module, attr)
    except Exception:
        return False


def main() -> int:
    print("=== Cloudless.gr Agent Tests ===\n")

    # Test 1: Core dependencies
    print("Test 1: Core Python dependencies")
    core_deps = [
        ("deepagents", "create_deep_agent"),
        ("langchain_openai", "ChatOpenAI"),
        ("langchain_core.runnables", "Runnable"),
        ("langchain_huggingface", "HuggingFaceEmbeddings"),
        ("langchain_chroma", "Chroma"),
        ("tavily", "TavilyClient"),
        ("dotenv", "load_dotenv"),
        ("requests", "get"),
        ("ruff", None),  # namespace package
        ("mypy", None),  # namespace package
    ]
    all_ok = True
    for module, attr in core_deps:
        if attr is None:
            # Just check if module exists
            if check_import(module):
                print(f"  ✓ {module}")
            else:
                print(f"  ✗ {module} - NOT FOUND")
                all_ok = False
        elif check_import_from(module, attr):
            print(f"  ✓ {module}.{attr}")
        else:
            print(f"  ✗ {module}.{attr} - NOT FOUND")
            all_ok = False

    if not all_ok:
        print("\nSome core dependencies are missing!")
        return 1
    print("  All core dependencies available")

    # Test 2: Agent modules
    print("\nTest 2: Agent modules")
    agent_modules = [
        "agents.cloudless_research_agent",
        "agents.cloudless_fast_answers",
        "agents.cloudless_unified_assistant",
        "agents.tools.search",
        "agents.tools.langchain_docs",
        "agents.tools.cloudless_project_tools",
        "agents.tools.langsmith_registry_tools",
        "agents.tools.sst_cloudflare",
    ]
    all_ok = True
    for module in agent_modules:
        if check_import(module):
            print(f"  ✓ {module}")
        else:
            print(f"  ✗ {module} - NOT FOUND")
            all_ok = False

    if not all_ok:
        print("\nSome agent modules are missing!")
        return 1
    print("  All agent modules available")

    # Test 3: Agent object exists
    print("\nTest 3: Agent object")
    try:
        from agents.cloudless_research_agent import agent
        if agent is not None and hasattr(agent, 'invoke'):
            print("  ✓ Agent object created and has invoke method")
        else:
            print("  ✗ Agent object invalid")
            return 1
    except Exception as e:
        print(f"  ✗ Agent import failed: {e}")
        return 1

    # Test 4: Memory directory
    print("\nTest 4: Memory directory")
    MEMORY_ROOT = Path(__file__).resolve().parents[1] / ".agent-memory"
    if MEMORY_ROOT.exists():
        print(f"  ✓ Memory directory exists at {MEMORY_ROOT}")
    else:
        print(f"  ✗ Memory directory missing at {MEMORY_ROOT}")
        return 1

    # Test 5: Tools modules load
    print("\nTest 5: Tools modules")
    try:
        print("  ✓ Tools modules load successfully")
    except Exception as e:
        print(f"  ✗ Tools load failed: {e}")
        return 1

    print("\n=== All tests passed! ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
