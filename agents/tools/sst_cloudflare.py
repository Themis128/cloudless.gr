"""
SST (Serverless Stack) Cloudflare provider tools.

These tools provide programmatic access to SST Cloudflare infrastructure operations
including Worker deployment, D1 database management, R2 bucket operations, and
Cron job scheduling.
"""

import subprocess
import json
import os
from typing import Optional, Dict, Any, List


def sst_deploy_infra(
    config: str = "sst.config.cf-infra.ts", 
    stage: str = "production"
) -> Dict[str, Any]:
    """
    Deploy SST infrastructure configuration.
    
    Args:
        config: Path to SST config file (default: sst.config.cf-infra.ts)
        stage: Deployment stage (production, staging, etc.)
    
    Returns:
        Deployment result with status and outputs
    """
    cmd = ["sst", "deploy", "--config", config, "--stage", stage]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }


def sst_list_resources(
    config: str = "sst.config.cf-infra.ts", 
    stage: str = "production"
) -> Dict[str, Any]:
    """
    List SST-managed Cloudflare resources.
    
    Args:
        config: Path to SST config file
        stage: Deployment stage
    
    Returns:
        JSON output of sst list command
    """
    cmd = ["sst", "list", "--config", config, "--stage", stage]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        return {"success": False, "error": result.stderr}
    
    try:
        return {"success": True, "resources": json.loads(result.stdout)}
    except json.JSONDecodeError:
        return {"success": True, "raw": result.stdout}


def sst_dev(config: str = "sst.config.ts") -> Dict[str, Any]:
    """
    Start SST dev mode for local development.
    
    Args:
        config: Path to SST config file
    
    Returns:
        Dev session status
    """
    cmd = ["sst", "dev", "--config", config]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def sst_remove_infra(
    config: str = "sst.config.cf-infra.ts", 
    stage: str = "production"
) -> Dict[str, Any]:
    """
    Remove SST-managed Cloudflare resources.
    
    Args:
        config: Path to SST config file
        stage: Deployment stage
    
    Returns:
        Removal result
    """
    cmd = ["sst", "remove", "--config", config, "--stage", stage]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "returncode": result.returncode,
    }


def sst_add_provider(provider: str = "cloudflare") -> Dict[str, Any]:
    """
    Add a provider to the SST configuration.
    
    Args:
        provider: Provider name to add
    
    Returns:
        Result of adding the provider
    """
    cmd = ["sst", "add", provider]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "success": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def validate_sst_config(config: str = "sst.config.ts") -> Dict[str, Any]:
    """
    Validate SST configuration file syntax.
    
    Args:
        config: Path to SST config file
    
    Returns:
        Validation result
    """
    cmd = ["sst", "validate", "--config", config]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    return {
        "valid": result.returncode == 0,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }


def get_sst_outputs(
    config: str = "sst.config.cf-infra.ts", 
    stage: str = "production"
) -> Dict[str, Any]:
    """
    Get outputs from SST deployment (e.g., worker URLs, database IDs).
    
    Args:
        config: Path to SST config file
        stage: Deployment stage
    
    Returns:
        JSON outputs from the SST stack
    """
    cmd = ["sst", "outputs", "--config", config, "--stage", stage]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        return {"success": False, "error": result.stderr}
    
    try:
        return {"success": True, "outputs": json.loads(result.stdout)}
    except json.JSONDecodeError:
        return {"success": True, "raw": result.stdout}


# Skill trigger patterns for automatic tool selection
SST_CLOUDFLARE_TRIGGERS = [
    "sst deploy",
    "sst cloudflare",
    "sst worker",
    "sst d1",
    "sst r2",
    "sst bucket",
    "sst queue",
    "sst cron",
    "sst ai",
    "SST config",
    "sst.config",
    "cloudflare provider sst",
    "sst add cloudflare",
    "deploy with sst",
    "list sst resources",
    "remove sst infra",
]


__all__ = [
    "sst_deploy_infra",
    "sst_list_resources",
    "sst_dev",
    "sst_remove_infra",
    "sst_add_provider",
    "validate_sst_config",
    "get_sst_outputs",
    "SST_CLOUDFLARE_TRIGGERS",
]