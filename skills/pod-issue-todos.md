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

- [ ] appflowy/appflowy-cloud-55c54ccc66-88z7q
  - [ ] Analyze logs for specific errors
  - [ ] Check resource usage
  - [ ] Verify dependencies

- [ ] appflowy/appflowy-worker-67947f8d67-jwcr4
  - [ ] Analyze logs for specific errors
  - [ ] Check resource usage
  - [ ] Verify dependencies

- [ ] appflowy/gotrue-7bd8dfbbd4-qs9j7
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Analyze logs
  - [ ] Check authentication service status

- [ ] appflowy/nginx-6746b948b5-hmmlw
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Check ingress controller status
  - [ ] Verify configuration

### System Pods

- [ ] kube-system/svclb-traefik-1ff64adb-qz8g9
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Check Traefik status
  - [ ] Verify load balancer configuration

- [ ] kube-system/traefik-6cd8c7cd89-2ss5t
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Check Traefik status
  - [ ] Verify ingress routes

- [ ] monitoring/kube-prom-prometheus-node-exporter-lw66t
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Check Prometheus status
  - [ ] Verify node exporter configuration

- [ ] tailscale/kube-0
  - [ ] Investigate using pod-restart-investigator.sh
  - [ ] Check Tailscale status
  - [ ] Verify network connectivity