# Docker & Containerization

This project uses a single `docker-compose.yml` to orchestrate all services:

- **cloudlessgr-app** (Nuxt app)
- **db** (Supabase Postgres, official image)
- **jenkins** (CI/CD)
- **prometheus** (monitoring)
- **grafana** (dashboards)
- **loki** (logging)
- **portainer** (Docker UI)
- **pgadmin** (Postgres admin)

## Usage

- Deploy all containers:
  ```powershell
  ./deploy-all.ps1
  ```
- Stop all containers:
  ```powershell
  docker compose down --remove-orphans
  ```

## Configuration
- App environment: `.env`
- Secrets: `secrets/` directory (referenced in `docker-compose.yml`)
- Data: Docker volumes (see `docker-compose.yml`)

## Database
- Uses `supabase/postgres:15.1.0.147`.
- Data is persisted in the `supabase_data` volume.
- Schema and seed data can be managed via SQL files or migrations if needed.

## Networks
All services are attached to one or more Docker networks for secure, isolated communication.

See `docker-compose.yml` for details.
