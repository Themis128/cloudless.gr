# PostgreSQL Database Setup Guide

This guide will help you connect your Cloudless platform to a PostgreSQL database using Prisma ORM.

## 🗄️ Prerequisites

1. **PostgreSQL Database** - You need a PostgreSQL database running locally or in the cloud
2. **Node.js** - Version 16 or higher
3. **npm** - For package management

## 📋 Database Connection Options

### Option 1: Local PostgreSQL (Recommended for Development)

1. **Install PostgreSQL locally:**
   - **Windows**: Download from [postgresql.org](https://www.postgresql.org/download/windows/)
   - **macOS**: `brew install postgresql`
   - **Linux**: `sudo apt-get install postgresql postgresql-contrib`

2. **Start PostgreSQL service:**
   ```bash
   # Windows (if installed as service)
   net start postgresql
   
   # macOS
   brew services start postgresql
   
   # Linux
   sudo systemctl start postgresql
   ```

3. **Create database and user:**
   ```sql
   CREATE DATABASE cloudless_dev;
   CREATE USER cloudless WITH PASSWORD 'development';
   GRANT ALL PRIVILEGES ON DATABASE cloudless_dev TO cloudless;
   ```

### Option 2: Cloud PostgreSQL (Recommended for Production)

Popular cloud options:
- **Supabase** (PostgreSQL hosting)
- **Neon** (Serverless PostgreSQL)
- **Railway** (PostgreSQL hosting)
- **AWS RDS** (Amazon's managed PostgreSQL)
- **Google Cloud SQL** (Google's managed PostgreSQL)

## 🔧 Configuration

### 1. Environment Variables

Copy the environment template and configure your database:

```bash
cp env.example .env
```

Update the database configuration in `.env`:

```env
# For local PostgreSQL
DATABASE_URL="postgresql://cloudless:development@localhost:5432/cloudless_dev?schema=public"
DIRECT_URL="postgresql://cloudless:development@localhost:5432/cloudless_dev?schema=public"

# For cloud PostgreSQL (example with Supabase)
# DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
# DIRECT_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres?schema=public"
```

### 2. Database Schema

The Prisma schema is already configured in `prisma/schema.prisma` with all the necessary models:

- **Users & Profiles** - User management and authentication
- **Projects** - Project organization
- **Bots** - AI bot configurations
- **Pipelines** - Data processing pipelines
- **Training Sessions** - ML model training
- **Deployments** - Model deployments
- **Analytics** - Execution tracking and metrics

### 3. Generate Prisma Client

```bash
npm run db:generate
```

This creates the TypeScript client based on your schema.

## 🚀 Database Operations

### Initialize Database

```bash
# Push schema to database (creates tables)
npm run db:push

# Or use migrations for production
npm run db:migrate
```

### Seed Database (Optional)

```bash
# Run seed script to populate with sample data
npm run db:seed
```

### Database Management

```bash
# Open Prisma Studio (database GUI)
npm run db:studio

# Reset database (development only)
npm run db:reset

# Check database health
npm run db:health
```

## 🔍 Testing the Connection

### 1. Health Check Endpoint

Visit: `http://localhost:3000/api/health/database`

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "postgresql",
    "connected": true,
    "responseTime": "15ms",
    "stats": {
      "bots": 0,
      "projects": 0,
      "users": 0
    },
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### 2. API Endpoints

Test the bot endpoints:

```bash
# List bots
curl http://localhost:3000/api/v1/bots

# Create a bot
curl -X POST http://localhost:3000/api/v1/bots \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Test Bot",
    "model": "gpt-4",
    "prompt": "You are a helpful assistant"
  }'
```

## 🛠️ Development Workflow

### 1. Schema Changes

When you modify the Prisma schema:

```bash
# Generate new client
npm run db:generate

# Apply changes to database
npm run db:push
```

### 2. Using the Database in Code

```typescript
// In server API routes
import { usePrisma } from '~/composables/usePrisma'

export default defineEventHandler(async (event) => {
  const prisma = usePrisma()
  
  // Create a bot
  const bot = await prisma.bot.create({
    data: {
      name: 'My Bot',
      model: 'gpt-4',
      prompt: 'You are helpful'
    }
  })
  
  return { bot }
})
```

```typescript
// In Vue components
import { useDatabase } from '~/composables/usePrisma'

const { bot } = useDatabase()

// List bots
const bots = await bot.findMany({
  orderBy: { created_at: 'desc' }
})
```

## 🔒 Security Considerations

### 1. Environment Variables

- Never commit `.env` files to version control
- Use different databases for development and production
- Rotate database passwords regularly

### 2. Connection Security

- Use SSL connections in production
- Implement connection pooling for high traffic
- Set up proper database user permissions

### 3. Data Validation

- Always validate input data before database operations
- Use Prisma's built-in validation features
- Implement proper error handling

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check if PostgreSQL is running
   - Verify port 5432 is accessible
   - Check firewall settings

2. **Authentication Failed**
   - Verify username and password
   - Check database user permissions
   - Ensure database exists

3. **Schema Errors**
   - Run `npm run db:generate` after schema changes
   - Check for syntax errors in `prisma/schema.prisma`
   - Verify database URL format

### Debug Commands

```bash
# Check Prisma client generation
npm run db:generate

# Test database connection
npm run db:health

# View database in GUI
npm run db:studio

# Reset everything (development only)
npm run db:reset
```

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Database Connection URLs](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

## ✅ Next Steps

1. **Set up your PostgreSQL database**
2. **Configure environment variables**
3. **Run database initialization**
4. **Test the connection**
5. **Start building your application!**

Your Cloudless platform is now ready to use PostgreSQL with full TypeScript support! 🎉 