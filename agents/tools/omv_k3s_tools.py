"""Open Media Vault (OMV) k3s cluster tools for Cline/Kimi model integration.

These tools allow the Kimi model to interact with the omv k3s cluster for:
- Pod status and management
- Service information
- Log access
- Node status
"""
import json
import os
import subprocess
from typing import Any, Dict, List, Optional

# Default Tailscale IP for omv node (Tailscale 100.74.191.58)
OMV_TAILSCALE_IP = "100.74.191.58"


def _run_kubectl(args: List[str], kubeconfig: Optional[str] = None) -> str:
    """Run kubectl command via SSH on omv node."""
    kubeconfig_arg = []
    if kubeconfig:
        kubeconfig_arg = ["--kubeconfig", kubeconfig]
    
    # Check if we have OMV SSH key for remote execution
    omv_key = os.environ.get("OMV_SSH_KEY")
    if omv_key:
        # Use SSH to run on omv node
        ssh_cmd = [
            "ssh", "-i", omv_key, "-o", "StrictHostKeyChecking=no",
            f"root@{OMV_TAILSCALE_IP}",
            "kubectl"] + args + kubeconfig_arg
        try:
            result = subprocess.run(
                ssh_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                return f"Error: {result.stderr}"
            return result.stdout
        except subprocess.TimeoutExpired:
            return "Error: kubectl command timed out"
        except FileNotFoundError:
            # Fall back to local kubectl if SSH not available
            pass
    
    # Local fallback
    cmd = ["kubectl"] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return f"Error: {result.stderr}"
        return result.stdout
    except FileNotFoundError:
        return "Error: kubectl not found. Install kubectl or set OMV_SSH_KEY."


def get_cluster_pods(namespace: Optional[str] = None) -> str:
    """Get pods in the k3s cluster on OMV."""
    args = ["get", "pods"]
    if namespace:
        args.extend(["-n", namespace])
    else:
        args.append("--all-namespaces")
    args.append("-o", "json")
    
    output = _run_kubectl(args)
    try:
        data = json.loads(output)
        pods = []
        for item in data.get("items", []):
            pods.append({
                "name": item["metadata"]["name"],
                "namespace": item["metadata"]["namespace"],
                "phase": item["status"]["phase"],
                "node": item["spec"].get("nodeName", "unknown"),
                "ready": _get_ready_status(item["status"].get("conditions", [])),
            })
        return json.dumps(pods, indent=2)
    except json.JSONDecodeError:
        return output


def _get_ready_status(conditions: List[Dict]) -> str:
    """Extract ready status from pod conditions."""
    for c in conditions:
        if c.get("type") == "Ready":
            return "True" if c.get("status") == "True" else "False"
    return "Unknown"


def get_cluster_services(namespace: Optional[str] = None) -> str:
    """Get services in the k3s cluster on OMV."""
    args = ["get", "services"]
    if namespace:
        args.extend(["-n", namespace])
    else:
        args.append("--all-namespaces")
    args.append("-o", "json")
    
    output = _run_kubectl(args)
    try:
        data = json.loads(output)
        services = []
        for item in data.get("items", []):
            services.append({
                "name": item["metadata"]["name"],
                "namespace": item["metadata"]["namespace"],
                "type": item["spec"]["type"],
                "cluster_ip": item["spec"].get("clusterIP", "None"),
                "ports": [p["port"] for p in item["spec"].get("ports", [])],
                "external_ip": _get_external_ip(item["status"]),
            })
        return json.dumps(services, indent=2)
    except json.JSONDecodeError:
        return output


def _get_external_ip(status: Dict) -> str:
    """Extract external IP from service status."""
    load_balancer = status.get("loadBalancer", {})
    ingress = load_balancer.get("ingress", [])
    if ingress:
        return ingress[0].get("ip", "pending")
    return "None"


def get_cluster_nodes() -> str:
    """Get nodes in the k3s cluster on OMV."""
    output = _run_kubectl(["get", "nodes", "-o", "json"])
    try:
        data = json.loads(output)
        nodes = []
        for item in data.get("items", []):
            ready = "Unknown"
            for addr in item["status"].get("addresses", []):
                if addr.get("type") == "InternalIP":
                    node_ip = addr.get("address")
                    break
            nodes.append({
                "name": item["metadata"]["name"],
                "status": _get_node_status(item["status"].get("conditions", [])),
                "roles": _get_node_roles(item["metadata"]),
                "age": item["metadata"].get("creationTimestamp", "unknown"),
            })
        return json.dumps(nodes, indent=2)
    except json.JSONDecodeError:
        return output


def _get_node_status(conditions: List[Dict]) -> str:
    """Extract Ready status from node conditions."""
    for c in conditions:
        if c.get("type") == "Ready":
            return "Ready" if c.get("status") == "True" else "NotReady"
    return "Unknown"


def _get_node_roles(metadata: Dict) -> List[str]:
    """Get roles (control-plane, worker) from node labels."""
    labels = metadata.get("labels", {})
    roles = []
    for key, value in labels.items():
        if key.startswith("node-role.kubernetes.io/"):
            roles.append(key.split("/")[-1])
    return roles if roles else ["worker"]


def get_pod_logs(pod_name: str, namespace: str = "default", container: Optional[str] = None, lines: int = 100) -> str:
    """Get logs from a pod in the OMV k3s cluster."""
    args = ["logs", pod_name, "-n", namespace, "--tail", str(lines)]
    if container:
        args.extend(["-c", container])
    
    return _run_kubectl(args)


def get_cluster_info() -> str:
    """Get overall cluster health and status information."""
    pods_out = get_cluster_pods()
    nodes_out = get_cluster_nodes()
    
    try:
        pods_data = json.loads(pods_out)
        nodes_data = json.loads(nodes_out)
        
        total_pods = len(pods_data)
        running_pods = sum(1 for p in pods_data if p["phase"] == "Running")
        pending_pods = sum(1 for p in pods_data if p["phase"] == "Pending")
        error_pods = sum(1 for p in pods_data if p["phase"] in ["Failed", "Error", "Unknown"])
        
        total_nodes = len(nodes_data)
        ready_nodes = sum(1 for n in nodes_data if n["status"] == "Ready")
        
        return json.dumps({
            "pods": {
                "total": total_pods,
                "running": running_pods,
                "pending": pending_pods,
                "errors": error_pods,
            },
            "nodes": {
                "total": total_nodes,
                "ready": ready_nodes,
            },
            "health": "healthy" if error_pods == 0 and pending_pods == 0 else "degraded",
        }, indent=2)
    except json.JSONDecodeError:
        return json.dumps({
            "pods_error": pods_out,
            "nodes_error": nodes_out,
        }, indent=2)