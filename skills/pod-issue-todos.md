# Pod Issue Investigation Todos

## Critical Issues

- [ ] Investigate PostgreSQL service status
  - [ ] Check PostgreSQL pod status
  - [ ] Verify PostgreSQL logs
  - [ ] Test connectivity to PostgreSQL from other pods
  - [ ] Check PostgreSQL resource usage

- [ ] Check DNS resolution within the cluster
  - [ ] Verify CoreDNS pod status
  - [ ] Check DNS service endpoints
  - [ ] Test DNS resolution from problematic pods

- [ ] Verify Redis stream configurations
  - [ ] Check Redis pod status
  - [ ] Verify Redis consumer groups
  - [ ] Test Redis connectivity

## Pod-Specific Issues

### AppFlowy Pods

- [x] appflowy/appflowy-cloud-55c54ccc66-88z7q
  - [x] Analyze logs for specific errors
  - [ ] Check resource usage
  - [ ] Verify dependencies

- [x] appflowy/appflowy-worker-67947f8d67-jwcr4
  - [x] Analyze logs for specific errors
  - [ ] Check resource usage
  - [ ] Verify dependencies

- [x] appflowy/gotrue-7bd8dfbbd4-qs9j7
  - [x] Investigate using pod-restart-investigator.sh
  - [x] Analyze logs
  - [ ] Check authentication service status

- [x] appflowy/nginx-6746b948b5-hmmlw
  - [x] Investigate using pod-restart-investigator.sh
  - [ ] Check ingress controller status
  - [ ] Verify configuration

### System Pods

- [x] kube-system/svclb-traefik-1ff64adb-qz8g9
  - [x] Investigate using pod-restart-investigator.sh
  - [ ] Check Traefik status
  - [ ] Verify load balancer configuration

- [x] kube-system/traefik-6cd8c7cd89-2ss5t
  - [x] Investigate using pod-restart-investigator.sh
  - [ ] Check Traefik status
  - [ ] Verify ingress routes

- [x] monitoring/kube-prom-prometheus-node-exporter-lw66t
  - [x] Investigate using pod-restart-investigator.sh
  - [ ] Check Prometheus status
  - [ ] Verify node exporter configuration

- [x] tailscale/kube-0
  - [x] Investigate using pod-restart-investigator.sh
  - [ ] Check Tailscale status
  - [ ] Verify network connectivity

## Additional Findings from Investigation

- [ ] Investigate high restart count for monitoring/kube-prom-prometheus-node-exporter-lw66t (30 restarts, last: Error exit 143 - SIGTERM)
- [ ] Investigate kube-system/svclb-traefik-1ff64adb-qz8g9 (6 restarts, last: Unknown exit 255) - appears twice in output
- [ ] Investigate kube-system/traefik-6cd8c7cd89-2ss5t (5 restarts, last: Error exit 2)
- [ ] Investigate tailscale/kube-0 (27 restarts, last: Completed exit 0 - normal job behavior, may be expected for periodic jobs)