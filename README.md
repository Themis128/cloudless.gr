# Cloudless.gr – Full Stack Nuxt 3 + Supabase Platform

## Overview
Cloudless.gr is a full-stack Nuxt 3 application with a modern admin dashboard, user workflows, and integrated Supabase/Postgres backend. The stack is containerized for local and production use, and includes CI/CD, monitoring, and developer tooling.

---

## Features
- **Nuxt 3** frontend with Vuetify 3 UI
- **Supabase** (Postgres) for data, auth, and storage
- **Admin dashboard** and user workflows
- **Docker Compose** for orchestration
- **Jenkins, Prometheus, Grafana, Loki, Portainer, pgAdmin** for devops and monitoring
- **Vanta.js** animated backgrounds
- **LLM/AI integration** (Ollama, phind-codellama, etc.)

---

## Quick Start

### 1. Clone and Setup
```sh
git clone https://github.com/your-org/cloudless.gr.git
cd cloudless.gr
cp .env.example .env
```

### 2. Local Development
```sh
npm install
npm run dev
```
App runs at: http://localhost:3000

### 3. Docker Compose (Full Stack)
```sh
pwsh ./deploy-docker.ps1 -Action dev
```
Or manually:
```sh
docker-compose -f docker-compose.dev.yml up --build
```

---

## Supabase Setup

### Test Credentials (for local/dev only)
```
SUPABASE_URL=https://test.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.TESTKEY
```

### Local Postgres (via Docker Compose)
- Host: `localhost`
- Port: `54322`
- User: `postgres`
- Password: `postgres`
- Database: `postgres`

### Schema
See [`supabase-schema.sql`](./supabase-schema.sql) for the full schema. Example table:
```sql
CREATE TABLE IF NOT EXISTS contact_submissions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Row Level Security (RLS)
- Enabled for all tables
- Policies allow public inserts (contact form) and admin read/update/delete (see schema file)

---

## Environment Variables
See `.env.example` for all options. Key variables:
```
# LLM/AI
LLM_API_URL=http://localhost:11434/api/generate
LLM_MODEL=phind-codellama:34b

# Auth0 (optional)
NUXT_AUTH0_DOMAIN=your-auth0-domain.auth0.com
NUXT_AUTH0_CLIENT_ID=your-auth0-client-id
NUXT_AUTH0_AUDIENCE=your-auth0-audience

# Supabase
SUPABASE_URL=https://test.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.TESTKEY

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

---

## Useful Scripts
- `npm run dev` – Start Nuxt in dev mode
- `npm run build` – Build for production
- `npm run lint` – Lint code
- `npm run test` – Run all tests
- `pwsh ./deploy-docker.ps1 -Action dev` – Start full stack in Docker

---

## Monitoring & Admin
- **pgAdmin:** http://localhost:5050 (see `secrets/pgadmin_password.txt`)
- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090
- **Jenkins:** http://localhost:8080
- **Portainer:** http://localhost:9000

---

## Project Structure
- `pages/` – Nuxt pages
- `components/` – Vue components (UI, Admin, Vanta backgrounds, etc.)
- `layouts/` – App and admin layouts
- `server/` – API routes, Prisma, backend logic
- `utils/` – Supabase, helpers
- `assets/` – CSS, images
- `docker-compose.*.yml` – Docker Compose files
- `supabase-schema.sql` – Supabase schema

---

## Testing
- Run all tests: `npm run test`
- Python platform tests: `npm run test:platform`

---

## Security Notes
- Test credentials are for local/dev only. **Never use in production!**
- Update RLS policies and secrets before deploying to production.

---

## Credits
- Built with Nuxt 3, Vuetify, Supabase, Docker, and more.
- See individual files for further documentation.
