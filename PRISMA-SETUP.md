# Prisma Backend Implementation

This document explains how Prisma has been implemented as a backend for your Cloudless LLM Dev Agent platform.

## Overview

Prisma has been integrated alongside your existing Supabase setup to provide:

- **Type-safe database access** with auto-generated TypeScript types
- **Powerful query capabilities** with relations and aggregations
- **Database migrations** for schema evolution
- **Connection pooling** and performance optimization
- **Multi-database support** (PostgreSQL, MySQL, SQLite, etc.)

## Architecture

```
├── prisma/
│   ├── schema.prisma          # Database schema definition
│   ├── seed.ts               # Sample data seeding script
│   └── migrations/           # Database migration files
├── lib/
│   ├── prisma.ts            # Prisma client configuration
│   └── database.ts          # Database service layer
├── server/api/prisma/       # Prisma API endpoints
│   ├── health.get.ts        # Health check endpoint
│   ├── projects/            # Project management APIs
│   ├── training/            # ML training APIs
│   ├── users/              # User management APIs
│   └── todos/              # Simple CRUD example
├── composables/
│   └── usePrismaApi.ts     # Frontend API composable
└── server/middleware/
    └── prisma.ts           # Database middleware
```

## Database Schema

The Prisma schema includes all major entities from your platform:

### Core Models
- **Profile** - User profiles and authentication
- **Project** - ML projects with type safety
- **TrainingSession** - ML model training sessions
- **ModelVersion** - Versioned ML models
- **Deployment** - Model deployment management

### Analytics & Pipelines
- **AnalyticsPipeline** - Data processing pipelines
- **AnalyticsStep** - Pipeline steps
- **AnalyticsExecution** - Pipeline execution tracking

### Support & Communication
- **ContactMessage** - Contact form submissions
- **SupportRequest** - Support ticket management
- **Bot** - AI assistant configurations

### Enums
- `ProjectType` - classification, nlp, cv, etc.
- `ProjectStatus` - draft, active, training, deployed, etc.
- `TrainingStatus` - pending, running, completed, failed, etc.
- `DeploymentStatus` - pending, active, inactive, etc.

## Getting Started

### Option 1: Quick Setup with Prisma Postgres (Recommended)

For the best experience with built-in connection pooling and caching, use our setup script:

```bash
npm run setup:prisma-postgres
```

This script will guide you through:
1. Creating a Prisma Postgres database in the Platform Console
2. Setting up your environment variables
3. Running migrations and seeding data
4. Testing your connection

### Option 2: Manual Setup

#### 1. Environment Setup

For **Prisma Postgres** (recommended):
```env
# Get these from your Prisma Data Platform Console
DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
DIRECT_URL="postgresql://username:password@host:port/database?sslmode=require"
```

For **regular PostgreSQL**:
```env
DATABASE_URL=postgresql://username:password@host:port/database
```

Optional configurations:
```env
PRISMA_DEBUG=1                    # Enable debug logging
DATABASE_CONNECTION_LIMIT=20      # Connection pool limit
DATABASE_POOL_TIMEOUT=20000       # Pool timeout in ms
```

#### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

This creates the TypeScript client in `generated/prisma/`.

#### 3. Database Migration

For a new database:
```bash
npm run prisma:migrate
```

For production deployment:
```bash
npm run prisma:migrate:deploy
```

#### 4. Seed Sample Data

```bash
npm run prisma:seed
```

This creates sample users, projects, training sessions, and other data for development.

## Why Prisma Postgres?

Prisma Postgres provides several advantages over traditional database setups:

### 🚀 **Built-in Performance Optimization**
- **Connection Pooling**: Automatic connection management via Prisma Accelerate
- **Query Caching**: Built-in caching with configurable TTL and SWR strategies
- **Edge Locations**: Global distribution for low-latency access

### 🔒 **Enterprise-Grade Security**
- **Managed Infrastructure**: No need to manage PostgreSQL servers
- **Automatic Backups**: Point-in-time recovery and automated backups
- **SSL/TLS Encryption**: All connections encrypted by default

### 📊 **Developer Experience**
- **Query Insights**: Built-in query performance monitoring
- **Prisma Studio**: Web-based database browser integrated in the console
- **Zero Configuration**: No complex connection pooling setup required

### 💰 **Cost-Effective Scaling**
- **Pay-per-use**: Only pay for what you actually use
- **Automatic Scaling**: Handles traffic spikes automatically
- **No Infrastructure Management**: Focus on your application, not database ops

## API Endpoints

### Health Check
```http
GET /api/prisma/health
```

### Projects
```http
GET    /api/prisma/projects              # List projects
POST   /api/prisma/projects              # Create project
GET    /api/prisma/projects/{id}         # Get project
PUT    /api/prisma/projects/{id}         # Update project
DELETE /api/prisma/projects/{id}         # Delete project
```

### Training
```http
POST /api/prisma/training                # Start training session
GET  /api/prisma/training                # List training sessions
GET  /api/prisma/training/{id}           # Get training session
```

### Users
```http
GET /api/prisma/users/profiles           # List user profiles
GET /api/prisma/users/profiles/{id}      # Get user profile
```

### Simple CRUD (Todos)
```http
GET    /api/prisma/todos                 # List todos
POST   /api/prisma/todos                 # Create todo
PUT    /api/prisma/todos/{id}            # Update todo
DELETE /api/prisma/todos/{id}            # Delete todo
```

## Frontend Usage

Use the `usePrismaApi` composable in your Vue components:

```vue
<script setup>
const { projects, training, users, todos } = usePrismaApi()

// List projects
const { data: projectList } = await projects.list()

// Create a new project
const newProject = await projects.create({
  name: 'My ML Project',
  description: 'Image classification model',
  type: 'cv',
  framework: 'PyTorch',
  owner_id: 'user-id'
})

// Start training
const trainingSession = await training.create({
  name: 'Training Run #1',
  projectId: newProject.id,
  config: {
    epochs: 10,
    batchSize: 32,
    learningRate: 0.001,
    baseModel: 'ResNet50'
  }
})
</script>
```

## Database Service Layer

The `lib/database.ts` file provides service functions for common operations:

```typescript
import { projectService, trainingService, userService } from '~/lib/database'

// Create a project with relations
const project = await projectService.createProject({
  name: 'New Project',
  owner: { connect: { id: userId } }
})

// Get project with all relations
const fullProject = await projectService.getProject(projectId)
// Returns project with owner, collaborators, training_sessions, etc.

// Paginated listing
const { projects, total, pages } = await projectService.listProjects(
  ownerId, 
  page = 1, 
  limit = 10
)
```

## Database Operations

### Schema Changes

1. Modify `prisma/schema.prisma`
2. Generate migration: `npm run prisma:migrate`
3. Update client: `npm run prisma:generate`

### Data Inspection

Open Prisma Studio to browse your data:
```bash
npm run prisma:studio
```

### Database Introspection

Pull schema from existing database:
```bash
npm run prisma:pull
```

### Schema Validation

Validate your schema:
```bash
npm run prisma:validate
```

## Error Handling

The implementation includes comprehensive error handling:

- **Validation errors** - 400 Bad Request for invalid input
- **Not found errors** - 404 for missing resources  
- **Constraint errors** - 409 Conflict for unique violations
- **Database errors** - 500 Internal Server Error with logging

Example error response:
```json
{
  "statusCode": 400,
  "statusMessage": "Validation failed",
  "data": {
    "error": "Epochs must be between 1 and 100"
  }
}
```

## Performance Considerations

### Connection Pooling
Prisma automatically handles connection pooling. Configure limits in your environment:

```env
DATABASE_CONNECTION_LIMIT=20
DATABASE_POOL_TIMEOUT=20000
```

### Query Optimization
- Use `select` to fetch only needed fields
- Use `include` carefully to avoid N+1 queries
- Implement pagination for large datasets
- Use database indexes for frequently queried fields

### Caching
Consider implementing caching for frequently accessed data:

```typescript
// Example with Redis caching
const getCachedProject = async (id: string) => {
  const cached = await redis.get(`project:${id}`)
  if (cached) return JSON.parse(cached)
  
  const project = await projectService.getProject(id)
  await redis.setex(`project:${id}`, 3600, JSON.stringify(project))
  return project
}
```

## Integration with Supabase

Prisma and Supabase can coexist in your application:

- **Prisma** for complex queries, transactions, and type safety
- **Supabase** for real-time subscriptions, auth, and file storage
- **Shared database** - both can use the same PostgreSQL instance

Example of using both:
```typescript
// Use Prisma for complex data operations
const project = await projectService.getProject(id)

// Use Supabase for real-time updates
const supabase = useSupabaseClient()
supabase
  .channel('project-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'projects',
    filter: `id=eq.${id}`
  }, (payload) => {
    // Handle real-time updates
  })
  .subscribe()
```

## Deployment

### Environment Variables
Ensure production environment has:
- `DATABASE_URL` - Production database connection
- `PRISMA_DEBUG=0` - Disable debug logging
- Connection pool settings

### Migration Deployment
```bash
# In your CI/CD pipeline
npm run prisma:migrate:deploy
npm run prisma:generate
```

### Health Monitoring
Monitor the `/api/prisma/health` endpoint for database connectivity.

## Troubleshooting

### Common Issues

1. **Client generation fails**
   ```bash
   rm -rf generated/prisma
   npm run prisma:generate
   ```

2. **Migration conflicts**
   ```bash
   npm run prisma:migrate:reset
   npm run prisma:seed
   ```

3. **Type errors after schema changes**
   ```bash
   npm run prisma:generate
   # Restart your development server
   ```

### Debug Logging

Enable detailed logging:
```env
PRISMA_DEBUG=1
```

Or programmatically:
```typescript
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})
```

## Next Steps

1. **Add authentication middleware** to protect sensitive endpoints
2. **Implement caching** for frequently accessed data
3. **Add database indexes** for performance optimization
4. **Set up monitoring** for query performance and errors
5. **Create backup strategies** for production data
6. **Add API rate limiting** to prevent abuse

## Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Database Schema Design](https://www.prisma.io/docs/concepts/components/prisma-schema)
- [Error Handling Guide](https://www.prisma.io/docs/reference/api-reference/error-reference)