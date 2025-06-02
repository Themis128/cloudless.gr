# Cloudless.gr Docker Stack

This project uses Docker Compose to orchestrate all services for development and production. The stack includes:

- **cloudlessgr-app**: Nuxt application (pre-built image)
- **db**: Supabase Postgres (official image: `supabase/postgres:15.1.0.147`)
- **jenkins**: CI/CD automation
- **prometheus**: Monitoring
- **grafana**: Dashboards
- **loki**: Logging
- **portainer**: Docker management UI
- **pgadmin**: Postgres admin UI

## Deployment

Use the provided PowerShell script to deploy the stack:

```powershell
./deploy-all.ps1
```

This script will:
- Stop and remove any existing containers
- Build and start all containers in detached mode
- Show the status of all containers

## Configuration
- Environment variables for the app are set in `.env`.
- Secrets (passwords, etc.) are stored in the `secrets/` directory and referenced in `docker-compose.yml`.
- All services are networked for secure communication.

## Database
- The database uses the official Supabase Postgres image.
- Data is persisted in the `supabase_data` Docker volume.
- Schema and seed data can be managed via SQL files or migrations as needed.

## Stopping the Stack
To stop all containers:

```powershell
docker compose down --remove-orphans
```

## Notes
- Remove or update any old documentation referring to previous Docker Compose or requirements files.
- For advanced configuration, see `docker-compose.yml`.
