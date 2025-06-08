# Platform Containers Documentation

This file is automatically updated by Jenkins. Do not edit manually.

## Services Overview

### jenkins
- **Purpose:** CI/CD automation, orchestrates builds, tests, deployments, and monitoring.
- **Ports:** 8080
- **Volumes:** jenkins_home, jenkins_backup, JCasC config, plugins.txt
- **Secrets:** jenkins_email_password
- **Networks:** app-network, cicd-network
- **Healthcheck:** /login endpoint
- **KPIs:** Up status, resource usage, container restarts

### supabase
- **Purpose:** Local Postgres DB and API for the platform (Supabase stack)
- **Ports:** 54322 (Postgres), 54323 (Studio), 8000 (API Gateway)
- **Volumes:** supabase_data
- **Secrets:** supabase_db_password
- **Networks:** app-network, db-network
- **Healthcheck:** pg_isready
- **KPIs:** Up status, DB size, active connections, query performance, error counts, replication lag, backup status

### app
- **Purpose:** Nuxt 3 frontend/backend application
- **Ports:** 3001 (mapped to 3000 in container)
- **Volumes:** source code, node_modules, data
- **Secrets:** All app secrets (see docker-compose)
- **Networks:** app-network, db-network, logging-network
- **Healthcheck:** /api/health endpoint
- **KPIs:** Up status, error rate, latency, CPU/memory/network usage, restarts

### prometheus
- **Purpose:** Metrics collection and monitoring
- **Ports:** 9090
- **Volumes:** prometheus.yml
- **Networks:** app-network, monitoring-network
- **Healthcheck:** /-/healthy
- **KPIs:** Up status, scrape health, resource usage

### grafana
- **Purpose:** Visualization of metrics and logs (dashboards)
- **Ports:** 3002 (mapped to 3000 in container)
- **Volumes:** grafana_data, dashboard and datasource configs, dashboards
- **Networks:** app-network, monitoring-network, logging-network
- **Healthcheck:** /api/health
- **KPIs:** Up status, dashboard provisioning, resource usage

### pgadmin
- **Purpose:** Web UI for managing Supabase/Postgres
- **Ports:** 5050 (mapped to 80 in container)
- **Volumes:** pgadmin_data
- **Secrets:** pgadmin_password
- **Networks:** db-network
- **Healthcheck:** /misc/ping
- **KPIs:** Up status

### loki
- **Purpose:** Centralized log aggregation (for Grafana)
- **Ports:** 3100
- **Volumes:** loki-config.yaml
- **Networks:** logging-network
- **Healthcheck:** /ready
- **KPIs:** Up status, log ingestion rate

### promtail
- **Purpose:** Log shipping agent for Loki
- **Volumes:** promtail-config.yaml, /var/log, ./logs
- **Networks:** logging-network
- **Depends on:** loki
- **KPIs:** Log shipping status

### portainer
- **Purpose:** Secure Docker management UI for platform administrators (admin-only access).
- **Ports:** 9000 (HTTP), 9443 (HTTPS, recommended for production)
- **Volumes:** portainer_data, /var/run/docker.sock (host socket)
- **Secrets:** portainer_admin_password
- **Networks:** app-network
- **Healthcheck:** /api/status endpoint
- **KPIs:** Up status, admin login attempts, container management actions, resource usage
- **Security:**
  - Admin-only access (enforced via Docker secret for password)
  - (Recommended) Restrict access by IP allowlist and/or enable HTTPS (see docker-compose and Portainer docs)
  - No external access to Docker socket except for Portainer
  - Use strong, unique admin password (managed via Docker secret)
  - Regularly update Portainer image for security patches

## Networks
- **app-network:** General app communication
- **db-network:** Database and DB UI
- **monitoring-network:** Monitoring stack
- **cicd-network:** CI/CD orchestration
- **logging-network:** Log aggregation and shipping

## Volumes
- jenkins_home, jenkins_backup, supabase_data, grafana_data, pgadmin_data

## Secrets
- All sensitive values are managed via Docker secrets in the `secrets/` directory.

---

_Last updated automatically by Jenkins on build._
