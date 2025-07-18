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
# Deploy using PowerShell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1

# Deploy using Bash
bash scripts/deploy.sh
```

📚 **See [docs/DOCKER.md](./docs/DOCKER.md) for deployment guide**

## 🧪 Testing & CI/CD

The project includes comprehensive testing and CI/CD:

- ✅ **Linting & Type Checking** - ESLint, Prettier, TypeScript
- ✅ **Security Scanning** - npm audit, audit-ci, vulnerability detection
- ✅ **E2E Testing** - Playwright browser automation
- ✅ **Accessibility Testing** - WCAG compliance checks
- ✅ **Performance Testing** - Bundle size analysis
- ✅ **Integration Testing** - Server startup and connectivity
- ✅ **PR Preview** - Automated preview deployments

📚 **See [docs/TESTING.md](./docs/TESTING.md) for detailed testing documentation**

## 🏗️ Architecture

### Frontend

- **Nuxt 3** - Vue.js framework
- **Vuetify 3** - Material Design components
- **Pinia** - State management
- **TypeScript** - Type safety

### Backend

- **Nuxt Server Routes** - API endpoints
- **Supabase** - Database and authentication
- **Nitro** - Server engine

### DevOps

- **Docker** - Containerization
- **GitHub Actions** - CI/CD pipeline
- **Playwright** - E2E testing

## 📚 Documentation

- 📖 **[Project Structure](./PROJECT_STRUCTURE.md)** - Detailed file organization
- 🐳 **[Docker Development](./docs/DOCKER-DEV.md)** - Development environment guide
- 🐳 **[Docker Deployment](./docs/DOCKER.md)** - Production deployment guide
- 🧪 **[Testing Guide](./docs/TESTING.md)** - Testing and CI/CD documentation
- 🔧 **[Scripts Documentation](./scripts/README.md)** - Automation scripts guide
- 🧪 **[Tests Documentation](./tests/README.md)** - Testing structure guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📚 **[Documentation](./docs/support.md)** - Comprehensive support guide
- 🐛 **[Issues](https://github.com/Themis128/cloudless.gr/issues)** - Report bugs
- 💬 **[Discussions](https://github.com/Themis128/cloudless.gr/discussions)** - Ask questions

---

**Built with ❤️ by the Cloudless team**
