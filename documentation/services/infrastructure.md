# Infrastructure & Docker Service Documentation

![Docker](https://img.shields.io/badge/docker-compose-2496ED?style=flat-square&logo=docker)
![Infrastructure](https://img.shields.io/badge/infrastructure-containerized-blue?style=flat-square&logo=server)
![Services](https://img.shields.io/badge/services-microservices-green?style=flat-square&logo=microservices)
![Monitoring](https://img.shields.io/badge/monitoring-enabled-yellow?style=flat-square&logo=monitoring)
![Production](https://img.shields.io/badge/production-ready-brightgreen?style=flat-square&logo=check)
![Scaling](https://img.shields.io/badge/scaling-horizontal-purple?style=flat-square&logo=scaling)

This document consolidates all infrastructure and Docker-related documentation for the CloudlessGR application.

## Overview

The infrastructure service manages Docker containerization, Supabase integration, and development environment setup. It provides a complete containerized development environment with PostgreSQL database, Supabase services, and application runtime.

## Docker Architecture

### Container Structure

The application uses Docker Compose to orchestrate multiple services:

#### Core Services
1. **Application Container** - Nuxt.js application
2. **Database Container** - PostgreSQL database
3. **Supabase Services** - Auth, API, and Dashboard
4. **Storage Service** - File storage and management

#### Development Services
1. **Studio Dashboard** - Supabase Studio for database management
2. **Auth Service** - Authentication and user management
3. **API Gateway** - RESTful API endpoints
4. **Edge Functions** - Serverless function runtime

### Container Configuration

#### Docker Compose Files
- **`docker-compose.yml`** - Main production configuration
- **`docker/docker-compose.s3.yml`** - S3 storage configuration
- **`docker/dev/docker-compose.dev.yml`** - Development-specific overrides

#### Volume Management
- **Database Volumes**: Persistent PostgreSQL data
- **Application Volumes**: Source code mounting for development
- **Storage Volumes**: File upload and asset storage

### Network Configuration

#### Port Mapping
- **3000**: Nuxt.js application
- **54321**: Supabase API Gateway
- **54323**: Supabase Studio Dashboard
- **5432**: PostgreSQL database (internal)
- **8000**: Supabase Auth (internal)

#### Service Discovery
- Internal Docker network for service communication
- External access through mapped ports
- Load balancing for production deployments

## Environment Setup

### Prerequisites

#### System Requirements
- Docker 20.10+ and Docker Compose V2
- Node.js 18+ and NPM
- PowerShell 7+ (for Windows users)
- Git for version control

#### Resource Requirements
- **Memory**: Minimum 4GB RAM, recommended 8GB+
- **Storage**: Minimum 10GB free space
- **CPU**: Multi-core processor recommended

### Environment Configuration

#### Environment Variables
```env
# Supabase Configuration
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database Configuration
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password

# Application Configuration
NUXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NUXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

#### Configuration Files
- **`.env`** - Environment-specific variables
- **`nuxt.config.ts`** - Nuxt.js configuration
- **`docker/.env.example`** - Example environment file

## Deployment Strategies

### Development Deployment

#### Local Development
```bash
# Start development environment
docker-compose up -d

# With specific services
docker-compose up -d db auth studio
```

#### Development with Live Reload
```bash
# Start with volume mounting
docker-compose -f docker-compose.yml -f docker/dev/docker-compose.dev.yml up -d
```

### Production Deployment

#### Production Build
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

#### Staging Environment
```bash
# Deploy to staging
docker-compose -f docker-compose.staging.yml up -d
```

## Service Management

### Container Lifecycle

#### Starting Services
```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d db

# Start with rebuild
docker-compose up -d --build
```

#### Stopping Services
```bash
# Stop all services
docker-compose down

# Stop with volume cleanup
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all
```

#### Service Monitoring
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs -f app

# Monitor resource usage
docker stats
```

### Health Checks

#### Service Health Monitoring
- Automatic health checks for critical services
- Restart policies for failed containers
- Monitoring endpoints for external monitoring

#### Custom Health Checks
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

## Database Infrastructure

### PostgreSQL Configuration

#### Database Setup
- PostgreSQL 15 with optimized configuration
- Persistent volume storage
- Automatic backup configuration

#### Connection Management
- Connection pooling with PgBouncer
- Read replica configuration for scaling
- SSL/TLS encryption for security

### Supabase Integration

#### Supabase Services
1. **Kong API Gateway** - Request routing and rate limiting
2. **PostgREST** - Automatic REST API generation
3. **GoTrue** - Authentication and user management
4. **Realtime** - WebSocket connections and subscriptions

#### Studio Dashboard
- Web-based database management
- Real-time data editing
- API documentation and testing

## Storage & Assets

### File Storage Configuration

#### Local Storage
```yaml
# docker-compose.yml
volumes:
  - ./storage:/var/lib/storage
```

#### S3-Compatible Storage
```yaml
# docker-compose.s3.yml
minio:
  image: minio/minio
  ports:
    - "9000:9000"
    - "9001:9001"
```

### Asset Management
- Static asset serving through Nuxt.js
- CDN integration for production
- Image optimization and resizing

## Security Configuration

### Container Security

#### Security Best Practices
- Non-root user execution
- Minimal base images
- Regular security updates
- Secrets management

#### Network Security
- Internal network isolation
- TLS encryption between services
- Firewall configuration
- Access control lists

### Data Security

#### Database Security
- Encrypted connections
- Row-level security (RLS)
- Regular security audits
- Backup encryption

#### Application Security
- Environment variable protection
- CORS configuration
- Rate limiting
- Input validation

## Performance Optimization

### Container Performance

#### Resource Allocation
```yaml
# docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
```

#### Caching Strategies
- Redis caching layer
- Database query caching
- Static asset caching
- CDN integration

### Database Performance

#### Connection Optimization
- Connection pooling configuration
- Query optimization
- Index management
- Partitioning strategies

#### Monitoring & Metrics
- Performance monitoring tools
- Query analysis
- Resource usage tracking
- Alert configuration

## Backup & Recovery

### Automated Backups

#### Database Backups
```bash
# Automated backup script
docker exec postgres pg_dump -U postgres postgres > backup.sql

# Restore from backup
docker exec -i postgres psql -U postgres postgres < backup.sql
```

#### Application Backups
- Source code versioning with Git
- Configuration backup
- Asset and media backup
- Complete environment snapshots

### Disaster Recovery

#### Recovery Procedures
1. **Data Recovery**: Restore from database backups
2. **Service Recovery**: Restart failed containers
3. **Complete Recovery**: Full environment restoration
4. **Failover**: Switch to backup infrastructure

#### Recovery Testing
- Regular recovery drills
- Backup validation
- Recovery time testing
- Documentation updates

## Monitoring & Logging

### Service Monitoring

#### Container Monitoring
```bash
# Monitor all containers
docker stats

# Detailed container info
docker inspect container_name

# Container logs
docker-compose logs -f service_name
```

#### Application Monitoring
- Health check endpoints
- Performance metrics
- Error tracking
- User analytics

### Logging Strategy

#### Log Aggregation
- Centralized logging with ELK stack
- Structured logging format
- Log retention policies
- Log analysis tools

#### Log Management
```yaml
# docker-compose.yml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## Development Workflow

### Development Environment

#### Local Development Setup
1. Clone repository
2. Copy environment configuration
3. Start Docker services
4. Run development server
5. Access application and tools

#### Hot Reload Configuration
- Volume mounting for live code updates
- Automatic container restart
- Fast rebuild optimization
- Development tool integration

### CI/CD Integration

#### Continuous Integration
```yaml
# CI pipeline
build:
  script:
    - docker build -t app:$CI_COMMIT_SHA .
    - docker run --rm app:$CI_COMMIT_SHA npm test
```

#### Continuous Deployment
- Automated deployment to staging
- Production deployment workflows
- Rollback procedures
- Blue-green deployments

## Troubleshooting

### Common Issues

#### Container Startup Issues
- Port conflicts resolution
- Volume mounting problems
- Environment variable issues
- Service dependency problems

#### Network Connectivity
- Service discovery issues
- Port accessibility problems
- Firewall configuration
- DNS resolution issues

#### Performance Issues
- Resource constraint identification
- Memory leak detection
- CPU usage optimization
- Disk I/O bottlenecks

### Debug Tools

#### Container Debugging
```bash
# Interactive container access
docker exec -it container_name /bin/bash

# Container resource usage
docker stats container_name

# Network inspection
docker network ls
docker network inspect network_name
```

#### Service Debugging
```bash
# Service logs
docker-compose logs -f service_name

# Service configuration
docker-compose config

# Service dependencies
docker-compose ps
```

## API Reference

### Docker Compose Commands

#### Basic Operations
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f
```

#### Advanced Operations
```bash
# Scale services
docker-compose up -d --scale app=3

# Update services
docker-compose pull && docker-compose up -d

# Clean up
docker-compose down -v --remove-orphans
```

### Container Management

#### Container Inspection
```bash
# Container details
docker inspect container_name

# Container processes
docker top container_name

# Container changes
docker diff container_name
```

## Best Practices

### Development Best Practices
- Use multi-stage Docker builds
- Optimize Docker images for size
- Use .dockerignore files
- Version control Docker configurations

### Security Best Practices
- Regular security updates
- Secrets management
- Network segmentation
- Access control implementation

### Performance Best Practices
- Resource optimization
- Caching strategies
- Monitoring implementation
- Capacity planning

## Related Files

- `docker/README.md` (source)
- `docker-compose.yml` and related compose files
- Dockerfile configurations
- Environment configuration files
