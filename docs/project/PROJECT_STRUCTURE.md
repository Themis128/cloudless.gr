# Cloudless Project Structure

This document outlines the organized file structure of the Cloudless project.

## 📁 Root Directory Structure

```
cloudless.gr/
├── 📚 docs/                          # Documentation
│   ├── README.md                     # Documentation index
│   ├── DOCKER-DEV.md                 # Docker development guide
│   ├── DOCKER.md                     # Docker deployment guide
│   ├── DOCKER_VERSIONING.md          # Docker versioning strategy
│   ├── TESTING.md                    # Testing documentation
│   ├── support.md                    # Support documentation
│   ├── linkedin-article-mobile-friendly.md
│   ├── privacy-policy.md             # Privacy policy
│   ├── terms-of-service.md           # Terms of service
│   └── cookie-policy.md              # Cookie policy
│
├── 🐳 docker/                        # Docker configuration
│   ├── README.md                     # Docker documentation
│   ├── docker-compose.yml            # Production Docker Compose
│   ├── docker-compose.dev.yml        # Development Docker Compose
│   ├── docker-compose.prod.yml       # Production Docker Compose
│   ├── Dockerfile                    # Production Dockerfile
│   ├── Dockerfile.dev                # Development Dockerfile
│   └── .dockerignore                 # Docker build exclusions
│
├── 🔧 scripts/                       # Automation scripts
│   ├── README.md                     # Scripts documentation
│   ├── dev-docker.ps1                # Docker development management
│   ├── deploy.ps1                    # PowerShell deployment
│   ├── deploy.sh                     # Bash deployment
│   ├── test-deployment.ps1           # PowerShell test deployment
│   ├── test-deployment.sh            # Bash test deployment
│   ├── version.ps1                   # PowerShell version management
│   ├── version.sh                    # Bash version management
│   └── backup.sh                     # Database backup
│
├── 🧪 tests/                         # Testing files
│   ├── README.md                     # Testing documentation
│   ├── basic.spec.js                 # Playwright E2E tests
│   ├── test-integration.sh           # Bash integration test
│   ├── test-integration.ps1          # PowerShell integration test
│   └── test-integration-debug.sh     # Debug integration test
│
├── 🎨 assets/                        # Static assets
│   ├── vanta-clouds2.js              # Vanta.js background
│   ├── clouds.svg                    # Cloud SVG icon
│   └── rainy-sky.css                 # Rainy sky CSS
│
├── 🌐 public/                        # Public static files
│   ├── vanta/                        # Vanta.js files
│   ├── .well-known/                  # Well-known files
│   ├── bots/                         # Bot-related assets
│   ├── bot.svg                       # Bot icon
│   ├── logo.svg                      # Logo
│   ├── model.svg                     # Model icon
│   ├── pipeline.svg                  # Pipeline icon
│   └── user.svg                      # User icon
│
├── 📄 pages/                         # Nuxt pages
│   ├── index.vue                     # Homepage
│   ├── about.vue                     # About page
│   ├── contact.vue                   # Contact page
│   ├── blog.vue                      # Blog page
│   ├── careers.vue                   # Careers page
│   ├── community.vue                 # Community page
│   ├── tutorials.vue                 # Tutorials page
│   ├── api-reference.vue             # API reference
│   ├── support.vue                   # Support page
│   ├── cookies.vue                   # Cookies page
│   ├── terms.vue                     # Terms page
│   ├── privacy.vue                   # Privacy page
│   ├── pricing.vue                   # Pricing page
│   ├── deploy.vue                    # Deploy page
│   ├── dashboard.vue                 # Dashboard page
│   ├── todos.vue                     # Todos page
│   ├── documentation/                # Documentation pages
│   ├── llm/                          # LLM pages
│   ├── bots/                         # Bot pages
│   ├── pipelines/                    # Pipeline pages
│   ├── models/                       # Model pages
│   ├── projects/                     # Project pages
│   └── debug/                        # Debug pages
│
├── 🧩 components/                    # Vue components
│   ├── README.md                     # Components documentation
│   ├── activity-feed.vue             # Activity feed component
│   ├── project-list-preview.vue      # Project list preview
│   ├── SvgProgressIcon.vue           # SVG progress icon
│   ├── bots/                         # Bot components
│   ├── pipelines/                    # Pipeline components
│   ├── llms/                         # LLM components
│   ├── models/                       # Model components
│   ├── ui/                           # UI components
│   ├── step-guides/                  # Step guide components
│   ├── debug/                        # Debug components
│   ├── templates/                    # Template components
│   └── layout/                       # Layout components
│
├── 🔌 composables/                   # Nuxt composables
│   ├── supabase.ts                   # Supabase client
│   ├── useAuth.ts                    # Authentication composable
│   ├── useBotBuilder.ts              # Bot builder composable
│   ├── useBotDeployer.ts             # Bot deployer composable
│   ├── useBotFormValidation.ts       # Bot form validation
│   ├── useBotTest.ts                 # Bot testing composable
│   ├── useDebugTools.ts              # Debug tools composable
│   ├── useModelTrainer.ts            # Model trainer composable
│   ├── usePipelineDebug.ts           # Pipeline debug composable
│   ├── usePipelineRunner.ts          # Pipeline runner composable
│   ├── usePromptHelp.ts              # Prompt help composable
│   ├── useTemplates.ts               # Templates composable
│   ├── useWizard.ts                  # Wizard composable
│   └── useWizardSteps.ts             # Wizard steps composable
│
├── 🗄️ stores/                        # Pinia stores
│   ├── botStore.ts                   # Bot store
│   ├── debugStore.ts                 # Debug store
│   ├── modelStore.ts                 # Model store
│   ├── pipelineStore.ts              # Pipeline store
│   └── templateStore.ts              # Template store
│
├── 📝 types/                         # TypeScript types
│   ├── Bot.ts                        # Bot types
│   ├── Debug.ts                      # Debug types
│   ├── Model.ts                      # Model types
│   ├── Pipeline.ts                   # Pipeline types
│   ├── Template.ts                   # Template types
│   └── database.types.ts             # Database types
│
├── 🎨 layouts/                       # Nuxt layouts
│   └── default.vue                   # Default layout
│
├── 🔌 plugins/                       # Nuxt plugins
│   ├── svg-icon.ts                   # SVG icon plugin
│   ├── vue-echarts.client.ts         # Vue ECharts plugin
│   └── vuetify.ts                    # Vuetify plugin
│
├── 🖥️ server/                        # Server-side code
│   └── api/                          # API routes
│       ├── health.get.ts             # Health check endpoint
│       ├── bots/                     # Bot API routes
│       ├── models/                   # Model API routes
│       ├── pipelines/                # Pipeline API routes
│       └── debug/                    # Debug API routes
│
├── 📊 data/                          # Data files
├── 🗄️ db-backups/                    # Database backups
├── 🔐 supabase/                      # Supabase configuration
├── 🎨 templates/                     # Template files
├── 🖼️ vanta-gallery/                 # Vanta.js gallery
│
├── ⚙️ Configuration Files
│   ├── package.json                  # NPM package configuration
│   ├── package-lock.json             # NPM lock file
│   ├── nuxt.config.ts                # Nuxt configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── .eslintrc.js                  # ESLint configuration
│   ├── .prettierrc                   # Prettier configuration
│   ├── playwright.config.js          # Playwright configuration
│   ├── cspell.json                   # Spell checker configuration
│   ├── .gitignore                    # Git ignore rules
│   ├── env.example                   # Environment variables example
│   ├── start-server.js               # Server startup script
│   └── vanta_files.txt               # Vanta files list
│
├── 🏗️ Build & Output Directories
│   ├── .nuxt/                        # Nuxt build cache (auto-generated)
│   ├── .output/                      # Nuxt output (auto-generated)
│   ├── node_modules/                 # NPM dependencies (auto-generated)
│   ├── logs/                         # Application logs
│   ├── server.log                    # Server log file
│   └── playwright-report/            # Playwright test reports (auto-generated)
│
└── 📋 Development Files
    ├── .vscode/                      # VS Code configuration
    ├── .cursor/                      # Cursor IDE configuration
    ├── .continue/                    # Continue AI configuration
    ├── .copilot/                     # GitHub Copilot configuration
    ├── .github/                      # GitHub Actions workflows
    ├── .deployment-info              # Deployment information
    ├── .docker-version               # Docker version info
    └── PROJECT_STRUCTURE.md          # This file
```

## 🎯 Organization Principles

### 📚 **Documentation First**

- All documentation is centralized in `docs/`
- Each major directory has its own README
- Clear navigation between related documents

### 🐳 **Docker Organization**

- All Docker files are in `docker/`
- Clear separation between dev and production configs
- Comprehensive Docker documentation

### 🔧 **Scripts Centralization**

- All automation scripts in `scripts/`
- Cross-platform support (PowerShell + Bash)
- Clear documentation for each script

### 🧪 **Testing Structure**

- All test files in `tests/`
- Integration tests with multiple formats
- Clear test documentation

### 🎨 **Asset Organization**

- Static assets in `assets/`
- Public files in `public/`
- Clear separation of concerns

### 🧩 **Component Architecture**

- Feature-based component organization
- Reusable UI components
- Clear component documentation

## 🚀 Benefits of This Structure

1. **📖 Easy Navigation** - Clear directory structure with README files
2. **🔍 Quick Discovery** - Related files are grouped together
3. **📚 Better Documentation** - Centralized and organized documentation
4. **🛠️ Improved Development** - Logical file organization
5. **🧪 Better Testing** - Organized test structure
6. **🐳 Docker Clarity** - Clear Docker configuration organization
7. **🔧 Script Management** - Centralized automation scripts

## 📋 Migration Notes

This structure improves upon the previous organization by:

- Moving documentation to `docs/`
- Organizing Docker files in `docker/`
- Centralizing scripts in `scripts/`
- Improving test organization in `tests/`
- Adding comprehensive README files
- Creating clear separation of concerns
