# CloudlessGR - Nuxt/Supabase Development Environment

![Nuxt](https://img.shields.io/badge/nuxt-3.17.5-00DC82?style=flat-square&logo=nuxt.js)
![Supabase](https://img.shields.io/badge/supabase-backend-3ECF8E?style=flat-square&logo=supabase)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178C6?style=flat-square&logo=typescript)
![Docker](https://img.shields.io/badge/docker-containerized-2496ED?style=flat-square&logo=docker)
![PostgreSQL](https://img.shields.io/badge/postgresql-15-336791?style=flat-square&logo=postgresql)
![Vue](https://img.shields.io/badge/vue-3-4FC08D?style=flat-square&logo=vue.js)
![Vuetify](https://img.shields.io/badge/vuetify-3.8+-1867C0?style=flat-square&logo=vuetify)
![License](https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square)
![Development](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

A modern full-stack development environment using Nuxt.js and Supabase with Docker containerization.

## � Documentation

**📖 [Complete Documentation](./documentation/README.md)** - Comprehensive service-based documentation

### Quick Access Documentation
- 🔐 [Authentication & Authorization](./documentation/services/authentication.md)
- 👥 [User Management](./documentation/services/user-management.md)
- 🗄️ [Database Service](./documentation/services/database.md)
- 🛠️ [Development & Scripts](./documentation/services/development-scripts.md)
- 🏗️ [Infrastructure & Docker](./documentation/services/infrastructure.md)

## �🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ and NPM
- PowerShell 7+ (for Windows)

### One-Command Setup
```bash
# Complete environment setup
.\scripts\01-setup-environment.ps1
.\scripts\02-reset-and-seed.ps1
node scripts\05-verify-setup.js
```

## 📋 Development Setup

### 1. Environment Setup
```bash
# Setup and validate environment
.\scripts\01-setup-environment.ps1

# OR manually install dependencies
npm install
```

### 2. Database Setup
```bash
# Reset and seed database with test data
.\scripts\02-reset-and-seed.ps1

# OR step by step:
.\scripts\03-create-database-tables.js
.\scripts\04-setup-user-accounts.js
.\scripts\07-seed-database.js
```

### 3. Verification
```bash
# Verify everything is working
node scripts\05-verify-setup.js
```

## 🌐 Access Points

After setup, access your services at:

- **Nuxt Application**: http://localhost:3000
- **Supabase Studio**: http://localhost:54323
- **Supabase API**: http://localhost:54321
- **PostgreSQL**: localhost:54322

## 📚 Scripts Reference

### Core Setup (Run in Order)
- `01-setup-environment.ps1` - Environment preparation
- `02-reset-and-seed.ps1` - Complete reset and seeding
- `03-create-database-tables.js` - Database table creation
- `04-setup-user-accounts.js` - User account setup
- `05-verify-setup.js` - Setup verification

### Database Management
- `06-check-database.js` - Database health check
- `07-seed-database.js` - Database seeding

### User Management
- `10-manage-users.js` - User operations

### Testing & Development
- `11-test-authentication.js` - Auth system testing
- `12-test-connectivity.ps1` - Service connectivity
- `13-show-access-points.js` - Display endpoints

### Utilities
- `16-generate-secrets.js` - Generate JWT secrets
- `18-emergency-restore.ps1` - Emergency recovery
- `19-fix-line-endings.ps1` - Fix file encoding
- `20-cleanup-temp-files.ps1` - Cleanup temp files

📖 **See [Development Scripts Documentation](./documentation/services/development-scripts.md) for complete script reference.**

## 📚 Documentation Structure

The documentation has been reorganized into service-based sections for better navigation:

- **Service Documentation**: Focused documentation for each major service
- **Quick Start Guides**: Fast setup procedures for common tasks
- **Troubleshooting**: Comprehensive issue resolution guides
- **API Reference**: Technical specifications and examples

All original documentation files have been preserved in `documentation/archive/` while new consolidated documentation is available in `documentation/services/`.

## 🛠️ Development

### Start Development Server
```bash
npm run dev
```

### Build for Production
```bash
npm run build
```

## 🧪 Testing

### Authentication Testing
```bash
# Test authentication system
node scripts\11-test-authentication.js

# Test specific user
node scripts\11-test-authentication.js --user admin@cloudless.gr
```

### Connectivity Testing
```bash
# Test all services
.\scripts\12-test-connectivity.ps1

# Quick essential tests
.\scripts\12-test-connectivity.ps1 -Quick
```

### Database Testing
```bash
# Check database health
node scripts\06-check-database.js

# Test with verbose output
node scripts\06-check-database.js --verbose
```

## 🔧 Maintenance

### Generate New Secrets
```bash
# Generate JWT and API secrets
node scripts\16-generate-secrets.js --update-env
```

### Fix Common Issues
```bash
# Fix line ending problems
.\scripts\19-fix-line-endings.ps1

# Emergency recovery
.\scripts\18-emergency-restore.ps1
```

### Cleanup
```bash
# Clean temporary files
.\scripts\20-cleanup-temp-files.ps1

# Deep cleanup including Docker
.\scripts\20-cleanup-temp-files.ps1 -Deep
```

## 🐳 Docker Management

### Start Services
```bash
cd docker
docker-compose up -d
```

### Stop Services
```bash
cd docker
docker-compose down
```

### View Logs
```bash
cd docker
docker-compose logs -f
```

### Reset Everything
```bash
.\scripts\02-reset-and-seed.ps1
```

## 🚨 Troubleshooting

### Common Issues

**Services not starting?**
```bash
.\scripts\12-test-connectivity.ps1
docker-compose ps
```

**Database connection issues?**
```bash
node scripts\06-check-database.js
.\scripts\02-reset-and-seed.ps1
```

**Authentication not working?**
```bash
node scripts\11-test-authentication.js
node scripts\04-setup-user-accounts.js --admin
```

**Environment problems?**
```bash
.\scripts\01-setup-environment.ps1 -CheckOnly
.\scripts\19-fix-line-endings.ps1
```

### Emergency Recovery
If everything breaks:
```bash
.\scripts\18-emergency-restore.ps1 -BackupFirst
node scripts\05-verify-setup.js
```

## 📁 Project Structure

```
├── scripts/                 # Numbered setup and utility scripts
│   ├── 01-setup-environment.ps1
│   ├── 02-reset-and-seed.ps1
│   ├── 05-verify-setup.js
│   └── [Numbered scripts 01-20]
├── documentation/           # Comprehensive documentation
│   ├── README.md           # Documentation index
│   ├── services/           # Service-based documentation
│   └── archive/            # Original documentation files
├── docker/                  # Docker configuration
│   ├── docker-compose.yml
│   └── .env
├── components/              # Vue components
├── composables/             # Vue composables
├── layouts/                 # Nuxt layouts
├── pages/                   # Nuxt pages
├── middleware/              # Nuxt middleware
├── stores/                  # Pinia stores
└── types/                   # TypeScript types
```

## 🎯 Default User Accounts

After running the setup scripts, these test accounts are available:

- **Admin**: admin@cloudless.gr / Admin123456!
- **Demo User**: demo@cloudless.gr / Demo123456!
- **Test User**: test@example.com / Test123456!

## 📖 Additional Resources

- **[📚 Complete Documentation](./documentation/README.md)** - Service-based comprehensive docs
- [Nuxt Documentation](https://nuxt.com/docs) - Nuxt.js framework
- [Supabase Documentation](https://supabase.com/docs) - Backend as a service
- [Docker Documentation](https://docs.docker.com/) - Containerization platform

## 🤝 Contributing

1. Run setup scripts to prepare environment
2. Make your changes
3. Test with verification scripts
4. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

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
