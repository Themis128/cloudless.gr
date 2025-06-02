# Supabase Database Setup

- The database service uses the official Supabase Postgres image: `supabase/postgres:15.1.0.147`.
- Data is persisted in the `supabase_data` Docker volume.
- The database is automatically started and networked with the app and admin tools (pgAdmin).
- Credentials and connection info are set in `docker-compose.yml` and secrets.
- To connect to the database (from host):
  - Host: `localhost`
  - Port: `54322`
  - User: `postgres`
  - Password: `postgres` (or as set in secrets)
  - Database: `postgres`
- To connect from another container, use the service name `db` as the host.

## Schema & Migrations
- If you need to initialize schema or seed data, use SQL files or a migration tool.
- Place SQL files in a suitable location and run them manually or with a migration container if needed.

## Admin Access
- Use pgAdmin (http://localhost:5050) to manage the database.
- Credentials for pgAdmin are stored in the `secrets/pgadmin_password.txt` file.

See `docker-compose.yml` for all configuration details.
