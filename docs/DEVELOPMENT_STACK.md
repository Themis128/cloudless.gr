# 🚀 Cloudless.gr Development Stack

Complete development environment with all supporting services, UIs, and monitoring tools.

## 📋 Service Overview

| Service               | Port  | URL                    | Description          | Credentials              |
| --------------------- | ----- | ---------------------- | -------------------- | ------------------------ |
| **Main Application**  | 3000  | http://localhost:3000  | Cloudless.gr App     | -                        |
| **Grafana**           | 3001  | http://localhost:3001  | Metrics Dashboard    | admin/admin              |
| **PostgreSQL**        | 5432  | -                      | Database             | cloudless/development    |
| **pgAdmin**           | 8080  | http://localhost:8080  | Database Management  | admin@cloudless.gr/admin |
| **Redis Commander**   | 8081  | http://localhost:8081  | Redis Management     | admin/admin              |
| **Traefik Dashboard** | 8082  | http://localhost:8082  | Reverse Proxy UI     | -                        |
| **Portainer**         | 9000  | http://localhost:9000  | Container Management | -                        |
| **Prometheus**        | 9090  | http://localhost:9090  | Metrics Collection   | -                        |
| **Elasticsearch**     | 9200  | http://localhost:9200  | Search Engine        | -                        |
| **Kibana**            | 5601  | http://localhost:5601  | Log Visualization    | -                        |
| **Jaeger**            | 16686 | http://localhost:16686 | Distributed Tracing  | -                        |
| **MailHog**           | 8025  | http://localhost:8025  | Email Testing        | -                        |

## 🔧 Core Services

### 1. **Main Application** (Port 3000)

- **URL**: http://localhost:3000
- **Description**: Cloudless.gr Nuxt.js application
- **Features**: Hot reload, debugging, API endpoints
- **Debug Port**: 9229 (Node.js inspector)
- **HMR Port**: 24678 (Vite Hot Module Replacement)

### 2. **PostgreSQL Database** (Port 5432)

- **Host**: localhost:5432
- **Database**: cloudless_dev
- **Username**: cloudless
- **Password**: development
- **Description**: Primary database for the application

### 3. **Redis Cache** (Port 6379 - Internal)

- **Host**: redis-dev:6379 (internal)
- **Description**: Caching and session storage
- **Memory Limit**: 128MB
- **Policy**: LRU eviction

## 🖥️ Management UIs

### 4. **pgAdmin** (Port 8080)

- **URL**: http://localhost:8080
- **Email**: admin@cloudless.gr
- **Password**: admin
- **Features**: Database management, query execution, schema visualization

### 5. **Redis Commander** (Port 8081)

- **URL**: http://localhost:8081
- **Username**: admin
- **Password**: admin
- **Features**: Redis key management, monitoring, debugging

### 6. **Portainer** (Port 9000)

- **URL**: http://localhost:9000
- **Features**: Container management, Docker orchestration, resource monitoring

## 📊 Monitoring & Observability

### 7. **Grafana** (Port 3001)

- **URL**: http://localhost:3001
- **Username**: admin
- **Password**: admin
- **Features**: Metrics visualization, dashboards, alerting

### 8. **Prometheus** (Port 9090)

- **URL**: http://localhost:9090
- **Features**: Metrics collection, time-series data, alerting rules

### 9. **Jaeger** (Port 16686)

- **URL**: http://localhost:16686
- **Features**: Distributed tracing, request flow analysis, performance monitoring

## 📝 Logging & Search

### 10. **Elasticsearch** (Port 9200)

- **URL**: http://localhost:9200
- **Features**: Log aggregation, search engine, data indexing

### 11. **Kibana** (Port 5601)

- **URL**: http://localhost:5601
- **Features**: Log visualization, search interface, data exploration

## 🧪 Testing & Development

### 12. **MailHog** (Port 8025)

- **URL**: http://localhost:8025
- **SMTP Port**: 1025
- **Features**: Email testing, message capture, development SMTP server

### 13. **Traefik** (Port 80/8082)

- **Dashboard**: http://localhost:8082
- **Features**: Reverse proxy, load balancing, automatic SSL

## 🚀 Quick Start Commands

### Start the entire stack:

```bash
pnpm run docker:dev:build
```

### Start only core services:

```bash
docker compose -f docker-compose.dev.yml up -d app-dev redis-dev postgres-dev
```

### View logs:

```bash
pnpm run docker:dev:logs
```

### Stop all services:

```bash
pnpm run docker:dev:down
```

### Health check:

```bash
curl http://localhost:3000/api/health
```

## 🔗 Service Dependencies

```
app-dev
├── redis-dev (required)
├── postgres-dev (required)
└── prometheus (optional)

grafana
└── prometheus (required)

kibana
└── elasticsearch (required)

pgadmin
└── postgres-dev (required)

redis-commander
└── redis-dev (required)
```

## 📈 Performance Monitoring

### Application Metrics

- **Health Check**: http://localhost:3000/api/health
- **Performance**: http://localhost:3001 (Grafana)
- **Traces**: http://localhost:16686 (Jaeger)
- **Logs**: http://localhost:5601 (Kibana)

### Container Monitoring

- **Portainer**: http://localhost:9000
- **Resource Usage**: Real-time container metrics
- **Logs**: Centralized log viewing

## 🔧 Development Workflow

1. **Start Stack**: `pnpm run docker:dev:build`
2. **Access App**: http://localhost:3000
3. **Monitor**: http://localhost:3001 (Grafana)
4. **Debug**: http://localhost:16686 (Jaeger)
5. **Database**: http://localhost:8080 (pgAdmin)
6. **Cache**: http://localhost:8081 (Redis Commander)
7. **Logs**: http://localhost:5601 (Kibana)

## 🛠️ Troubleshooting

### Common Issues:

1. **Port Conflicts**: Check if ports are already in use
2. **Memory Issues**: Ensure sufficient RAM (8GB+ recommended)
3. **Database Connection**: Verify PostgreSQL is healthy
4. **Redis Connection**: Check Redis service status

### Useful Commands:

```bash
# Check service status
docker compose -f docker-compose.dev.yml ps

# View specific service logs
docker compose -f docker-compose.dev.yml logs app-dev

# Restart specific service
docker compose -f docker-compose.dev.yml restart app-dev

# Access container shell
docker exec -it cloudlessgr-app-dev sh
```

## 📊 Resource Requirements

- **Minimum RAM**: 8GB
- **Recommended RAM**: 16GB
- **Storage**: 10GB free space
- **CPU**: 4 cores minimum

## 🔐 Security Notes

- All services use default development credentials
- **DO NOT** use these credentials in production
- Services are exposed on localhost only
- Network isolation via Docker bridge network

---

**Last Updated**: January 2025
**Status**: Production Ready Development Stack
