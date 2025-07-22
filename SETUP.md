# 🚀 Cloudless LLM Dev Agent - Setup Guide

This guide will help you set up and run the Cloudless LLM Dev Agent platform.

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**

### Optional Dependencies
- **Redis** (for caching and session management)
- **Docker** (for containerized development)

## 🛠️ Quick Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd cloudless.gr
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables

#### Option A: Interactive Setup (Recommended)
```bash
npm run setup
```
This will guide you through setting up all required environment variables.

#### Option B: Manual Setup
1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```
2. Edit `.env` and fill in your values (see [Environment Variables](#environment-variables) below)

### 4. Start Development Server
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 🔧 Environment Variables

### Required Variables

#### Supabase Configuration
Get these from your [Supabase project dashboard](https://supabase.com/dashboard):

```env
NUXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

### Optional Variables

#### Redis Configuration
```env
# Set to true to disable Redis and use in-memory storage
SKIP_REDIS=false

# Redis connection settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

#### Build Configuration
```env
# Set to false to disable prerendering (useful when Redis is not available)
NUXT_PRERENDER=true
```

## 🐳 Docker Setup (Optional)

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Manual Redis Setup
```bash
# Start Redis with Docker
docker run -d -p 6379:6379 --name redis-dev redis:alpine

# Or install Redis locally
# macOS: brew install redis && brew services start redis
# Ubuntu: sudo apt-get install redis-server && sudo systemctl start redis
```

## 🔍 Troubleshooting

### Redis Connection Issues

If you encounter Redis connection errors during build:

1. **Disable Redis** (Recommended for development):
   ```env
   SKIP_REDIS=true
   ```

2. **Or ensure Redis is running**:
   ```bash
   # Check if Redis is running
   redis-cli ping
   
   # Start Redis if needed
   docker run -d -p 6379:6379 redis:alpine
   ```

### Build Failures

If the build fails due to prerendering issues:

1. **Disable prerendering**:
   ```env
   NUXT_PRERENDER=false
   ```

2. **Or skip Redis**:
   ```env
   SKIP_REDIS=true
   ```

### Supabase Connection Issues

1. **Verify your Supabase credentials** in the `.env` file
2. **Check your Supabase project** is active and accessible
3. **Ensure your IP is whitelisted** in Supabase dashboard

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Quick Tests
```bash
npm run test:quick
```

### Run Linting
```bash
# Lint all files
npm run lint

# Lint specific directories
npm run lint:pages
npm run lint:components
npm run lint:server

# Fix linting issues
npm run lint:fix
```

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

### Environment Variables for Production
Make sure to set these in your production environment:

```env
NODE_ENV=production
NUXT_PUBLIC_SUPABASE_URL=your-production-supabase-url
NUXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-key
REDIS_URL=your-production-redis-url
```

## 📁 Project Structure

```
cloudless.gr/
├── components/          # Vue components
│   ├── bots/           # Bot-related components
│   ├── models/         # Model-related components
│   ├── pipelines/      # Pipeline-related components
│   └── step-guides/    # Setup guides
├── pages/              # Application pages
│   ├── models/         # Model management
│   ├── llm/           # LLM management
│   ├── bots/          # Bot management
│   ├── pipelines/     # Pipeline management
│   └── projects/      # Project management
├── server/             # Server-side code
│   └── api/           # API endpoints
├── stores/             # Pinia stores
├── types/              # TypeScript type definitions
├── scripts/            # Utility scripts
└── env.example         # Environment variables template
```

## 🆘 Getting Help

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Review the logs** for error messages
3. **Verify your environment variables** are correctly set
4. **Ensure all dependencies** are installed

## 📝 Development Notes

- The application uses **Nuxt 3** with **Vue 3** and **TypeScript**
- **Pinia** is used for state management
- **Supabase** provides the backend database and authentication
- **Redis** is optional and can be replaced with in-memory storage
- **Vuetify** provides the UI components

## 🔄 Updates

To update the application:

```bash
# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Rebuild if needed
npm run build
``` 