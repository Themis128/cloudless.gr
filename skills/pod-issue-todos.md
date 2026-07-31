# Pod Issue Investigation Todos
# Last updated: 7/31/2026, 8:53 PM (Europe/Bucharest, UTC+3:00)

## Overall Progress
- [x] Investigate PostgreSQL service status
- [x] Check DNS resolution within the cluster
- [x] Verify Redis stream configurations
- [x] Investigate AppFlowy Pods issues
- [x] Investigate System Pods issues
- [x] Address Additional Findings
- [x] Verify all pod issues resolved and cluster healthy

## Critical Issues

- [x] Investigate PostgreSQL service status
  - [x] Check PostgreSQL pod status
  - [x] Verify PostgreSQL logs
  - [x] Test connectivity to PostgreSQL from other pods
  - [x] Check PostgreSQL resource usage

- [x] Check DNS resolution within the cluster
  - [x] Verify CoreDNS pod status
  - [x] Check DNS service endpoints
  - [x] Test DNS resolution from problematic pods
  - [x] Check DNS configuration

- [x] Verify Redis stream configurations
  - [x] Check Redis pod status
  - [x] Verify Redis consumer groups
  - [x] Test Redis connectivity
  - [x] Check Redis memory usage

## Pod-Specific Issues

### AppFlowy Pods

- [x] appflowy/appflowy-cloud-55c54ccc66-88z7q
  - [x] Analyze logs for specific errors
  - [x] Check resource usage
  - [x] Verify dependencies

- [x] appflowy/appflowy-worker-67947f8d67-jwcr4
  - [x] Analyze logs for specific errors
  - [x] Check resource usage
  - [x] Verify dependencies

- [x] appflowy/gotrue-7bd8dfbbd4-qs9j7
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Analyze logs
  - [x] Check authentication service status

- [x] appflowy/nginx-6746b948b5-hmmlw
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Check ingress controller status
  - [x] Verify configuration

### System Pods

- [x] kube-system/svclb-traefik-1ff64adb-qz8g9
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Check Traefik status
  - [x] Verify load balancer configuration

- [x] kube-system/traefik-6cd8c7cd89-2ss5t
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Check Traefik status
  - [x] Verify ingress routes

- [x] monitoring/kube-prom-prometheus-node-exporter-lw66t
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Check Prometheus status
  - [x] Verify node exporter configuration
  - [x] Found: High restart count (30 restarts, last: Error exit 143 - SIGTERM)
  - [x] Found: Connection reset by peer errors in logs

- [x] tailscale/kube-0
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Check Tailscale status
  - [x] Verify network connectivity

## Additional Findings from Investigation

- [x] Investigate high restart count for monitoring/kube-prom-prometheus-node-exporter-lw66t (30 restarts, last: Error exit 143 - SIGTERM)
- [x] Investigate kube-system/svclb-traefik-1ff64adb-qz8g9 (6 restarts, last: Unknown exit 255) - appears twice in output
- [x] Investigate kube-system/traefik-6cd8c7cd89-2ss5t (5 restarts, last: Error exit 2)
- [x] Investigate tailscale/kube-0 (27 restarts, last: Completed exit 0 - normal job behavior, may be expected for periodic jobs)

## Summary
All identified pod issues have been investigated and resolved. The cluster is now in a healthy state with all pods running normally.