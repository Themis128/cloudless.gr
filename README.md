# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Supabase Setup

This project uses Supabase for authentication and database management.

### Quick Start

1. **Start Supabase services:**
   ```bash
   cd docker
   docker-compose up -d
   ```

2. **Reset and seed database (if needed):**
   ```bash
   # PowerShell
   .\scripts\reset-and-seed.ps1
   
   # Bash
   cd docker && ./reset.sh --seed
   ```

### Access Points

- **🌐 Supabase Studio**: [http://localhost:54323](http://localhost:54323)
  - Web UI for database management, authentication, storage, etc.
- **🔗 API Endpoint**: [http://localhost:8000](http://localhost:8000)
  - Main API gateway for all Supabase services
- **🗄️ Database**: `postgresql://postgres:postgres@localhost:5432/postgres`
  - Direct PostgreSQL database connection
- **📊 Analytics**: [http://localhost:4000](http://localhost:4000)
  - Supabase Analytics dashboard

### Test User Account

- **Email:** baltzakis.themis@gmail.com
- **Password:** TH!123789th!
- **Role:** user

### Useful Scripts

- `node scripts/show-access-points.js` - Show all access points and test connectivity
- `node scripts/test-studio-access.js` - Test Studio accessibility
- `node scripts/debug-user-login.js` - Test user authentication
- `node scripts/verify-user-setup.js` - Verify user profile setup
