# Cloudless Wizard 🧙‍♂️

A low-code platform for building AI-powered data pipelines, analytics, and intelligent applications.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- PowerShell 7+ (Windows) or Bash (Linux/Mac)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/Themis128/cloudless.gr.git
cd cloudless.gr

# Start development environment
npm run docker:dev:start

# Access the application
open http://localhost:3000
```

## 📁 Project Structure

```
cloudless.gr/
├── 📚 docs/                    # Documentation
├── 🐳 docker/                  # Docker configuration
├── 🔧 scripts/                 # Automation scripts
├── 🧪 tests/                   # Testing files
├── 🎨 assets/                  # Static assets
├── 🌐 public/                  # Public files
├── 📄 pages/                   # Nuxt pages
├── 🧩 components/              # Vue components
├── 🔌 composables/             # Nuxt composables
├── 🗄️ stores/                  # Pinia stores
├── 📝 types/                   # TypeScript types
├── 🎨 layouts/                 # Nuxt layouts
├── 🔌 plugins/                 # Nuxt plugins
├── 🖥️ server/                  # Server-side code
└── 📋 Configuration files
```

📖 **See [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) for detailed structure**

## 🛠️ Development

### Docker Development Environment

```bash
# Start development
npm run docker:dev:start

# View logs
npm run docker:dev:logs

# Access container shell
npm run docker:dev:shell

# Stop development
npm run docker:dev:stop
```

📚 **See [docs/DOCKER-DEV.md](./docs/DOCKER-DEV.md) for detailed guide**

### Testing

```bash
# Run E2E tests
npm test

# Run integration tests
chmod +x tests/test-integration.sh
./tests/test-integration.sh

# Run tests with UI
npx playwright test --headed
```

📚 **See [docs/TESTING.md](./docs/TESTING.md) for testing guide**

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🐳 Deployment

### Docker Deployment

```bash
# Build and deploy
npm run docker:build

# Deploy to production
npm run prod:deploy

# Check status
npm run prod:status
```

📚 **See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for deployment guide**

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="file:./dev.db"

# Authentication
JWT_SECRET="your-secret-key-change-in-production"
NUXT_JWT_SECRET="your-secret-key-change-in-production"

# Redis
REDIS_URL="redis://localhost:6379"

# API Keys
BOT_API_KEY="your-bot-api-key"
PIPELINE_API_URL="http://localhost:3002"

# Development
NODE_ENV="development"
NUXT_PORT=3000
```

### Docker Configuration

The project uses Docker Compose for development and production:

- `docker-compose.dev.yml` - Development environment
- `docker-compose.prod.yml` - Production environment

## 🧪 Testing

### Test Structure

```
tests/
├── e2e/                    # End-to-end tests
├── integration/            # Integration tests
├── unit/                   # Unit tests
├── visual/                 # Visual regression tests
└── fixtures/               # Test data
```

### Running Tests

```bash
# All tests
npm test

# Specific test types
npm run test:e2e
npm run test:integration
npm run test:unit

# Visual tests
npm run test:visual
```

## 📚 Documentation

### Core Documentation

- [Project Structure](./docs/PROJECT_STRUCTURE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Testing Guide](./docs/TESTING.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Reference](./docs/API.md)

### Component Documentation

- [Authentication System](./docs/AUTH.md)
- [Database Schema](./docs/DATABASE.md)
- [Docker Setup](./docs/DOCKER.md)
- [Security Guide](./docs/SECURITY.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](./docs/)
- 🐛 [Issues](https://github.com/Themis128/cloudless.gr/issues)
- 💬 [Discussions](https://github.com/Themis128/cloudless.gr/discussions)

## 🏗️ Architecture

### Frontend (Nuxt 3)

- **Framework**: Nuxt 3 with Vue 3
- **Styling**: Tailwind CSS
- **State Management**: Pinia
- **TypeScript**: Full type safety
- **Testing**: Playwright for E2E, Vitest for unit tests

### Backend (Nitro)

- **Runtime**: Nitro (Nuxt's server engine)
- **Database**: Prisma with SQLite
- **Authentication**: JWT with HTTP-only cookies
- **Caching**: Redis
- **API**: RESTful endpoints

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **Development**: Hot reload with Docker volumes
- **Production**: Multi-stage builds
- **Monitoring**: Built-in health checks

## 🔐 Security

- JWT-based authentication
- HTTP-only cookies
- Rate limiting
- Input validation
- SQL injection protection
- XSS protection

## 📊 Performance

- Server-side rendering (SSR)
- Static site generation (SSG)
- Image optimization
- Code splitting
- Lazy loading
- Caching strategies

## 🌟 Features

### Core Features

- 🔐 **Authentication System** - Secure user management
- 📊 **Dashboard** - Analytics and monitoring
- 🤖 **Bot Builder** - AI-powered chatbots
- 🧠 **Model Management** - ML model deployment
- 🔄 **Pipeline Builder** - Data processing workflows
- 📝 **Project Management** - Portfolio showcase
- 👥 **User Management** - Admin controls

### Development Features

- 🐳 **Docker Integration** - Containerized development
- 🧪 **Testing Suite** - Comprehensive test coverage
- 📚 **Documentation** - Extensive guides and references
- 🔧 **Automation** - CI/CD pipelines
- 🎨 **UI Components** - Reusable design system
- 📱 **Responsive Design** - Mobile-first approach

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/Themis128/cloudless.gr.git
   cd cloudless.gr
   ```

2. **Start development environment**
   ```bash
   npm run docker:dev:start
   ```

3. **Access the application**
   ```
   http://localhost:3000
   ```

4. **Explore the features**
   - Create an account at `/auth/signup`
   - Build your first bot at `/bots/builder`
   - Deploy a model at `/models/deploy`
   - Create a pipeline at `/pipelines/create`

## 📈 Roadmap

- [ ] Enhanced AI capabilities
- [ ] Real-time collaboration
- [ ] Advanced analytics
- [ ] Mobile applications
- [ ] Enterprise features
- [ ] API marketplace

---

**Built with ❤️ by the Cloudless team**
