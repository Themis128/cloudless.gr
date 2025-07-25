# Development Setup Guide

Complete guide for setting up the local development environment for this Nuxt.js application with all required dependencies and configurations.

## Prerequisites

### System Requirements

- **Node.js**: v18+ (LTS recommended)
- **npm**: v8+ (or yarn v1.22+)
- **Git**: Latest version
- **Operating System**: Windows, macOS, or Linux

### Development Tools (Recommended)

- **IDE**: VS Code with Vue/Nuxt extensions
- **Terminal**: Modern terminal with shell support
- **Browser**: Chrome/Firefox with Vue DevTools extension

## Quick Start

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/cloudless.gr.git
cd cloudless.gr
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your configuration
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# (Optional) Seed database
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

## Detailed Setup

### Environment Configuration

#### Required Environment Variables

Create `.env` file with the following configuration:

```bash
# Database Configuration
DATABASE_URL="file:./dev.db"
DIRECT_URL="file:./dev.db"

# Authentication
JWT_SECRET="your-super-secret-jwt-key-here-make-it-long-and-random"
JWT_EXPIRES_IN="7d"
SESSION_SECRET="your-session-secret-here"

# SMTP Configuration (for contact forms)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="noreply@cloudless.gr"
EMAIL_TO="admin@cloudless.gr"

# LLM Configuration
LLM_API_URL="http://localhost:11434/api/generate"
LLM_MODEL="phind-codellama:34b"
LLM_CONTEXT_LENGTH="4096"
LLM_TEMPERATURE="0.7"

# Optional: External LLM Providers
OPENAI_API_KEY="your-openai-api-key"
ANTHROPIC_API_KEY="your-anthropic-api-key"

# Admin Configuration
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="cloudless2025"

# Security
CSRF_SECRET="your-csrf-secret-here"
RATE_LIMIT_WINDOW="15" # minutes
RATE_LIMIT_MAX="100" # requests per window

# Development
NODE_ENV="development"
NUXT_DEBUG="true"
```

#### Optional Environment Variables

```bash
# Analytics
GOOGLE_ANALYTICS_ID="GA_MEASUREMENT_ID"
PLAUSIBLE_DOMAIN="your-domain.com"

# External Services
CREDLY_USERNAME="your-credly-username"

# File Upload
MAX_FILE_SIZE="10485760" # 10MB
UPLOAD_DIR="./uploads"

# Cache Configuration
REDIS_URL="redis://localhost:6379"
CACHE_TTL="3600" # seconds
```

### Database Setup

#### SQLite (Default)

The project uses SQLite by default for development:

```bash
# Generate Prisma client
npx prisma generate

# Create and migrate database
npx prisma db push

# View database in Prisma Studio
npx prisma studio
```

#### Database Schema

Key models include:

```prisma
// User authentication
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String
  isAdmin   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Contact submissions
model ContactSubmission {
  id        Int      @id @default(autoincrement())
  name      String
  email     String
  subject   String
  message   String
  status    String   @default("new")
  notes     String?
  createdAt DateTime @default(now())
}

// Project management
model Project {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String
  content     String?
  status      String
  category    String
  featured    Boolean  @default(false)
  technologies String[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

#### Seeding Database

Create test data for development:

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Create admin user
  const adminPassword = await bcrypt.hash('cloudless2025', 10);
  await prisma.user.create({
    data: {
      email: 'admin@cloudless.gr',
      name: 'Administrator',
      password: adminPassword,
      isAdmin: true,
    },
  });

  // Create sample projects
  await prisma.project.create({
    data: {
      title: 'Sample Web App',
      slug: 'sample-web-app',
      description: 'A sample web application',
      status: 'active',
      category: 'web-development',
      featured: true,
      technologies: ['Vue.js', 'Nuxt.js', 'TypeScript'],
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Run seeding:

```bash
npx prisma db seed
```

### LLM Integration Setup

#### Local LLM (Ollama)

1. **Install Ollama**:

   ```bash
   # macOS
   brew install ollama

   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh

   # Windows
   # Download from https://ollama.ai/download
   ```

2. **Download Models**:

   ```bash
   # Code generation model
   ollama pull codellama:34b

   # General purpose model
   ollama pull llama2
   ```

3. **Start Ollama Server**:

   ```bash
   ollama serve
   ```

4. **Test Integration**:
   ```bash
   curl http://localhost:11434/api/generate \
     -d '{"model": "codellama:34b", "prompt": "Write a Vue component"}'
   ```

#### External LLM Providers

##### OpenAI Setup

```bash
# Install OpenAI SDK
npm install openai

# Add to .env
OPENAI_API_KEY="sk-your-openai-api-key"
```

##### Anthropic Claude Setup

```bash
# Install Anthropic SDK
npm install @anthropic-ai/sdk

# Add to .env
ANTHROPIC_API_KEY="sk-ant-your-anthropic-key"
```

### Development Workflow

#### Available Scripts

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "lint": "eslint . --ext .ts,.vue",
    "lint:fix": "eslint . --ext .ts,.vue --fix",
    "type-check": "vue-tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "e2e": "cypress open",
    "e2e:headless": "cypress run",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "prisma:studio": "prisma studio",
    "prisma:seed": "prisma db seed"
  }
}
```

#### Development Server

```bash
# Start development server with hot reload
npm run dev

# Start with custom port
PORT=3001 npm run dev

# Enable debug mode
DEBUG=nuxt:* npm run dev
```

#### Code Quality Tools

##### ESLint Configuration

The project includes ESLint for code quality:

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
  },
  extends: [
    '@nuxtjs/eslint-config-typescript',
    'plugin:vue/vue3-recommended',
    '@vue/typescript/recommended',
  ],
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
```

##### Prettier Configuration

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "none",
  "printWidth": 80,
  "endOfLine": "auto"
}
```

##### TypeScript Configuration

```json
// tsconfig.json
{
  "extends": "./.nuxt/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### IDE Setup

#### VS Code Extensions

Install recommended extensions:

```json
// .vscode/extensions.json
{
  "recommendations": [
    "vue.volar",
    "nuxt.mdc",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

#### VS Code Settings

```json
// .vscode/settings.json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "vue.codeActions.enabled": true,
  "tailwindCSS.includeLanguages": {
    "vue": "html"
  }
}
```

## Testing Setup

### Unit Testing (Vitest)

```bash
# Install testing dependencies (already included)
npm install -D vitest @vue/test-utils happy-dom

# Run tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### E2E Testing (Cypress)

```bash
# Open Cypress interface
npm run e2e

# Run headless tests
npm run e2e:headless
```

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '~': './src',
      '@': './src',
    },
  },
});
```

## Debugging

### Server-Side Debugging

```bash
# Enable Nitro debugging
DEBUG=nitro:* npm run dev

# Enable Nuxt debugging
DEBUG=nuxt:* npm run dev

# Debug specific components
DEBUG=nuxt:components npm run dev
```

### Client-Side Debugging

```typescript
// Enable Vue devtools in production
app.config.globalProperties.$nuxt.options.dev = true;

// Debug reactive state
import { debug } from 'vue';
debug(reactiveObject);
```

### Database Debugging

```bash
# View database with Prisma Studio
npx prisma studio

# Enable query logging
DATABASE_URL="file:./dev.db?connection_limit=1&socket_timeout=3&pool_timeout=300&logs=query"
```

## Performance Monitoring

### Development Performance

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  devtools: { enabled: true },

  // Enable source maps
  sourcemap: {
    server: true,
    client: true,
  },

  // Optimize development build
  vite: {
    build: {
      sourcemap: true,
    },
  },
});
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build -- --analyze

# Generate build report
npm run generate -- --analyze
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**

   ```bash
   # Kill process using port 3000
   lsof -ti:3000 | xargs kill -9

   # Or use different port
   PORT=3001 npm run dev
   ```

2. **Database Connection Issues**

   ```bash
   # Reset database
   rm prisma/dev.db
   npx prisma db push
   npx prisma db seed
   ```

3. **Node Modules Issues**

   ```bash
   # Clear cache and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **TypeScript Errors**

   ```bash
   # Regenerate types
   npm run build

   # Check types manually
   npm run type-check
   ```

5. **LLM Connection Failed**

   ```bash
   # Check Ollama status
   curl http://localhost:11434/api/version

   # Restart Ollama
   ollama serve
   ```

### Debug Logs

Enable comprehensive logging:

```bash
# Full debug mode
DEBUG=* npm run dev

# Specific debug categories
DEBUG=nuxt:*,nitro:*,prisma:* npm run dev
```

### Performance Issues

```bash
# Profile build time
NODE_OPTIONS="--max-old-space-size=4096" npm run build

# Clear Nuxt cache
rm -rf .nuxt .output

# Clear npm cache
npm cache clean --force
```

## Production Considerations

### Environment Differences

- SQLite in development, PostgreSQL/MySQL in production
- Different SMTP providers for production emails
- External LLM providers instead of local Ollama
- Enhanced security settings and secrets

### Build Optimization

```bash
# Production build
NODE_ENV=production npm run build

# Static generation
npm run generate
```

## Related Documentation

- [API Reference](api-reference.md) - Backend API endpoints
- [Deployment Guide](deployment.md) - Production deployment
- [Testing Guide](testing-complete.md) - Testing procedures
- [LLM Integration](llm-integration.md) - LLM setup details

---

**Last Updated**: December 2024
