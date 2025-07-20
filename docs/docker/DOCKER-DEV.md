# Docker Development Guide

This guide covers how to develop your Cloudless application using Docker containers with hot reloading and live code changes.

## 🚀 Quick Start

### Prerequisites

- Docker Desktop for Windows
- PowerShell 7+ (recommended)
- At least 4GB RAM available for Docker

### First Time Setup

1. **Clone and navigate to your project:**

   ```powershell
   cd "D:\Nuxt Projects\llm-dev-agent\cloudless.gr"
   ```

2. **Start the development environment:**

   ```powershell
   npm run docker:dev:start
   ```

3. **Access your application:**
   - Open http://localhost:3000 in your browser
   - The app will automatically reload when you make code changes

## 📋 Development Workflow

### Starting Development

```powershell
# Start the development environment
npm run docker:dev:start

# Or use the script directly
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 start
```

### Stopping Development

```powershell
# Stop the development environment
npm run docker:dev:stop

# Or use the script directly
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 stop
```

### Viewing Logs

```powershell
# View real-time logs
npm run docker:dev:logs

# Or follow logs for a specific service
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 logs app-dev
```

### Accessing Container Shell

```powershell
# Open a shell inside the development container
npm run docker:dev:shell

# Useful for running commands like:
# npm install new-package
# npm run build
# npx playwright install
```

### Restarting Services

```powershell
# Restart the entire development environment
npm run docker:dev:restart

# Or restart just the app service
docker-compose -f docker-compose.dev.yml restart app-dev
```

## 🔧 Development Features

### Hot Reloading

- **File Changes**: Any changes to your source code will automatically trigger a rebuild and reload
- **Vue Components**: Vue components update instantly without full page refresh
- **API Routes**: Server-side API routes restart automatically
- **Configuration**: Nuxt config changes trigger full restart

### Volume Mounting

The development container mounts your local source code:

- `.:/app` - Your entire project directory
- `/app/node_modules` - Container's node_modules (excluded from host)
- `/app/.nuxt` - Build cache (excluded from host)
- `/app/.output` - Output directory (excluded from host)

### Environment Variables

- Uses `.env` file from your project root
- Development-specific variables are set in `docker-compose.dev.yml`
- File watching is enabled with polling for Windows compatibility

## 🛠️ Common Development Tasks

### Installing New Dependencies

```powershell
# Option 1: Install from host (recommended)
npm install new-package

# Option 2: Install from container shell
npm run docker:dev:shell
npm install new-package
```

### Running Tests

```powershell
# Run Playwright tests
npm run docker:dev:shell
npm test

# Or run tests with UI
npm run docker:dev:shell
npx playwright test --headed
```

### Building for Production

```powershell
# Build the application
npm run docker:dev:shell
npm run build

# Preview the production build
npm run docker:dev:shell
npm run preview
```

### Database Operations

If you have database services enabled:

```powershell
# Access PostgreSQL
docker-compose -f docker-compose.dev.yml exec postgres-dev psql -U cloudless -d cloudless_dev

# Access Redis
docker-compose -f docker-compose.dev.yml exec redis-dev redis-cli
```

## 🔍 Troubleshooting

### Container Won't Start

```powershell
# Check container status
npm run docker:dev:status

# View detailed logs
npm run docker:dev:logs

# Rebuild the image
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 build
```

### Hot Reload Not Working

```powershell
# Check if file watching is working
npm run docker:dev:logs

# Restart the container
npm run docker:dev:restart

# Verify volume mounts
docker-compose -f docker-compose.dev.yml exec app-dev ls -la
```

### Port Already in Use

```powershell
# Check what's using port 3000
netstat -ano | findstr :3000

# Stop the conflicting service or change the port in docker-compose.dev.yml
```

### Performance Issues

```powershell
# Clean up Docker resources
powershell -ExecutionPolicy Bypass -File scripts/dev-docker.ps1 clean

# Increase Docker memory allocation in Docker Desktop settings
```

## 📁 Project Structure

```
cloudless.gr/
├── docker-compose.dev.yml      # Development Docker Compose
├── Dockerfile.dev              # Development Dockerfile
├── .dockerignore               # Docker build exclusions
├── scripts/
│   └── dev-docker.ps1         # Development management script
├── package.json                # Updated with Docker scripts
└── DOCKER-DEV.md              # This guide
```

## 🎯 Best Practices

### Development Workflow

1. **Always use the development environment** for coding
2. **Keep the container running** during development sessions
3. **Use the logs** to debug issues
4. **Restart containers** when adding new dependencies
5. **Clean up regularly** to maintain performance

### Code Changes

- **Vue components**: Changes are reflected immediately
- **API routes**: Restart automatically
- **Configuration files**: May require container restart
- **Dependencies**: Install from host, then restart container

### Performance Tips

- **Exclude node_modules** from volume mounts (already configured)
- **Use .dockerignore** to speed up builds
- **Clean Docker regularly** to free up space
- **Monitor resource usage** in Docker Desktop

## 🧪 Testing & CI/CD Integration

The Docker development environment is fully integrated with our comprehensive GitHub Actions CI/CD pipeline, providing automated testing, security scanning, and deployment workflows.

### GitHub Actions Workflows

Our `.github/workflows/` directory contains a complete testing and deployment pipeline:

#### 🔄 CI/CD Pipeline (`ci.yml`)

**Comprehensive automated testing on every push and pull request:**

```yaml
# Triggers on push to main branches and all pull requests
on:
  push:
    branches: [application, main, develop]
  pull_request:
    branches: [application, main]
```

**Test Jobs:**

- **Lint & Type Check**: ESLint, TypeScript validation, Prettier formatting
- **Build Test**: Multi-version Node.js compatibility testing
- **Security Check**: npm audit and vulnerability scanning with audit-ci
- **Dependency Check**: Outdated package detection and validation
- **E2E Tests**: Playwright end-to-end testing with browser automation
- **Accessibility Test**: WCAG compliance and accessibility validation
- **Performance Test**: Bundle size analysis and performance monitoring
- **Integration Test**: Server startup and connectivity verification
- **Preview Deploy**: Automated PR preview builds with status reporting

#### 🔒 Security Scanning (`security.yml`)

**Weekly automated security assessments:**

- **Dependency Vulnerability Scan**: npm audit, audit-ci, outdated packages
- **Code Security Scan**: ESLint security rules, secret detection
- **Container Security Scan**: Trivy vulnerability scanning for Docker images
- **Secrets Detection**: TruffleHog for credential and API key scanning
- **Security Summary**: Consolidated security reporting

#### 🔧 Maintenance (`maintenance.yml`)

**Automated maintenance and updates:**

- **Dependency Updates**: Automated dependency updates with PR creation
- **Build Cleanup**: Artifact cleanup and disk usage optimization
- **Security Audits**: Regular license and compliance checks
- **Health Monitoring**: Repository health and performance metrics

### Running Tests in Docker Development

#### End-to-End Testing with Playwright

```powershell
# Install Playwright browsers in the container
npm run docker:dev:shell
npx playwright install --with-deps

# Run all Playwright tests
npm run docker:dev:shell
npm test

# Run tests with UI for debugging
npm run docker:dev:shell
npx playwright test --headed

# Run specific test files
npm run docker:dev:shell
npx playwright test tests/basic.spec.js
```

#### Integration Testing

```powershell
# Run integration tests (server startup and connectivity)
npm run docker:dev:shell
chmod +x test-integration.sh
./test-integration.sh

# Manual integration testing
npm run docker:dev:shell
npm run build
node .output/server/index.mjs
```

#### Development Testing Workflow

```powershell
# 1. Start development environment
npm run docker:dev:start

# 2. Run tests in parallel terminal
npm run docker:dev:shell
npm test

# 3. Watch test results while developing
npm run docker:dev:logs
```

### Test Configuration

#### Playwright Configuration (`playwright.config.js`)

```javascript
// Configured for Docker development environment
module.exports = {
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run preview',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
}
```

#### Test Coverage Areas

**🏠 Homepage & Navigation (`tests/basic.spec.js`)**

- Page title and loading verification
- Navigation functionality across all routes
- Responsive design testing (desktop/mobile)
- Basic accessibility compliance

**🔒 Security & Performance**

- Automated vulnerability scanning
- Bundle size monitoring
- Performance regression detection
- Secret and credential scanning

**🌐 Cross-Browser Compatibility**

- Chromium, Firefox, and WebKit testing
- Mobile and desktop viewport testing
- Feature compatibility verification

### CI/CD Integration Benefits

#### For Development

- **Immediate Feedback**: Test results on every commit
- **Quality Gates**: Prevent broken code from merging
- **Automated Fixes**: Dependency updates and security patches
- **Performance Monitoring**: Track bundle size and performance metrics

#### For Production

- **Deployment Confidence**: Comprehensive testing before deployment
- **Security Assurance**: Regular vulnerability scanning
- **Rollback Capability**: Safe deployment with rollback options
- **Monitoring**: Automated health checks and alerting

### Local Testing Commands

```powershell
# Quick test suite
npm run docker:dev:shell
npm test

# Full CI/CD simulation
npm run docker:dev:shell
npm run build
npm run preview
npx playwright test

# Security audit
npm run docker:dev:shell
npm audit
npx audit-ci --moderate

# Performance analysis
npm run docker:dev:shell
npm run build
du -sh .output/
```

### Test Debugging

#### Common Issues and Solutions

**Test Failures:**

```powershell
# Check test logs
npm run docker:dev:shell
npx playwright test --reporter=line

# Debug specific test
npm run docker:dev:shell
npx playwright test tests/basic.spec.js --debug
```

**Server Issues:**

```powershell
# Check server logs
npm run docker:dev:logs

# Test server manually
npm run docker:dev:shell
curl http://localhost:3000
```

**Browser Issues:**

```powershell
# Reinstall browsers
npm run docker:dev:shell
npx playwright install --with-deps
```

### Continuous Integration Workflow

1. **Developer Push**: Code changes trigger CI pipeline
2. **Parallel Testing**: Multiple test jobs run simultaneously
3. **Quality Gates**: All tests must pass for merge approval
4. **Security Scanning**: Automated vulnerability detection
5. **Preview Deployment**: PR preview builds for testing
6. **Merge & Deploy**: Successful tests enable deployment

The Docker development environment ensures **identical testing conditions** between local development and CI/CD, eliminating "works on my machine" issues and providing confidence in deployments.

## 🔄 Migration from Local Development

If you're currently developing locally without Docker:

1. **Stop your local development server**
2. **Start the Docker development environment**
3. **Your code changes will work the same way**
4. **All npm scripts work from the container shell**

The Docker development environment provides the same development experience as local development, but with better isolation and consistency across different machines.

## 📚 Additional Resources

- [Docker Desktop Documentation](https://docs.docker.com/desktop/)
- [Nuxt 3 Development](https://nuxt.com/docs/guide/concepts/development)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [PowerShell Documentation](https://docs.microsoft.com/en-us/powershell/)
