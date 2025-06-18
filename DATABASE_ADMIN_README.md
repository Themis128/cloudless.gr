# 🗄️ Supabase Database Administration Setup

This setup provides a containerized database administration environment for managing both your cloud and local Supabase instances with automated synchronization capabilities.

## 🚀 Quick Start

### 1. Start Database Admin Services

```powershell
# Start pgAdmin (recommended for beginners)
./db-admin.ps1 start pgadmin

# Start DBeaver CloudBeaver (more advanced features)
./db-admin.ps1 start dbeaver

# Start both services
./db-admin.ps1 start both
```

### 2. Access Admin Interfaces

- **pgAdmin**: http://localhost:8080
  - Email: `admin@cloudless.gr`
  - Password: `admin123`

- **DBeaver CloudBeaver**: http://localhost:8081
  - Initial setup required on first visit

### 3. Configure Database Connections

#### In pgAdmin:
1. Right-click "Servers" → "Register" → "Server"
2. **Local Supabase**:
   - Host: `supabase-db`, Port: `5432`, Database: `postgres`, User: `postgres`, Password: `postgres`
3. **Cloud Supabase**:
   - Host: `db.oflctqligzouzshimuqh.supabase.co`, Port: `5432`, Database: `postgres`, User: `postgres`, Password: `supabase2025`

#### In DBeaver:
1. Click "New Connection"
2. Select "PostgreSQL"
3. Use connection details from `db-config.ini`

## 🔄 Automated Synchronization

### Manual Sync
```powershell
# Sync public tables only
./db-admin.ps1 sync

# Include auth users (requires cloud DB password)
./db-admin.ps1 sync -IncludeAuth
```

### Automated Sync
The sync scheduler runs every 6 hours automatically when the DBeaver service is started.

## 📊 Benefits of This Setup

### 1. **Unified Management**
- Single interface for both cloud and local databases
- Side-by-side comparison of schemas and data
- Easy data migration and synchronization

### 2. **Visual Administration**
- **pgAdmin**: Traditional PostgreSQL administration
  - Query editor with syntax highlighting
  - Visual schema designer
  - Backup/restore tools
  - User management

- **DBeaver**: Universal database tool
  - Advanced SQL editor with autocomplete
  - ER diagrams
  - Data visualization
  - CSV/Excel import/export

### 3. **Automated Operations**
- Scheduled synchronization (every 6 hours)
- Automatic backups before sync
- Backup retention management
- Comprehensive logging

### 4. **Development Workflow**
- Test changes locally first
- Sync production data for realistic testing
- Compare schemas between environments
- Easy rollback capabilities

## 📁 Directory Structure

```
├── docker-compose.admin.yml     # pgAdmin setup
├── docker-compose.dbeaver.yml   # DBeaver + sync scheduler
├── db-admin.ps1                 # Management script
├── db-config.ini                # Connection configurations
├── sync-scripts/
│   ├── automated-sync.sh        # Automated sync script
│   └── manual-sync.sh          # Manual trigger script
├── db-backups/                 # Database backups
└── logs/                       # Sync and error logs
```

## 🔧 Available Commands

```powershell
# Service management
./db-admin.ps1 start [pgadmin|dbeaver|both]
./db-admin.ps1 stop [pgadmin|dbeaver|both]
./db-admin.ps1 restart [pgadmin|dbeaver|both]
./db-admin.ps1 status

# Data operations
./db-admin.ps1 sync [-IncludeAuth]
./db-admin.ps1 backup
./db-admin.ps1 logs
```

## 🛡️ Security Considerations

1. **Local Development Only**: This setup is designed for local development
2. **Password Management**: Consider using environment variables for production
3. **Network Access**: Admin interfaces are only accessible locally
4. **Backup Encryption**: Enable encryption for sensitive backups

## 📋 Common Tasks

### Compare Schemas
1. Open pgAdmin
2. Connect to both local and cloud databases
3. Use "Tools" → "Schema Diff" to compare

### Import Cloud Data
1. Use the automated sync: `./db-admin.ps1 sync -IncludeAuth`
2. Or manually in pgAdmin: Tools → Backup/Restore

### Monitor Sync Status
```powershell
# Check logs
./db-admin.ps1 logs

# Check service status
./db-admin.ps1 status
```

### Create Manual Backup
```powershell
./db-admin.ps1 backup
```

## 🔄 Sync Process Details

The sync process:
1. **Backup**: Creates local backup before sync
2. **Schema**: Ensures local schema matches cloud
3. **Public Tables**: Syncs all public tables via REST API
4. **Auth Users**: Syncs auth.users and auth.identities via SQL dump
5. **Cleanup**: Removes temporary files and old backups

## 🐛 Troubleshooting

### Services Won't Start
```powershell
# Check Docker status
docker ps

# Check logs
docker logs supabase-pgadmin
docker logs supabase-dbeaver
```

### Sync Failures
```powershell
# Check sync logs
./db-admin.ps1 logs

# Try manual sync with verbose output
docker exec -it supabase-sync-scheduler /scripts/automated-sync.sh
```

### Connection Issues
1. Verify Supabase is running: `docker ps`
2. Check network connectivity
3. Verify credentials in `db-config.ini`

This setup transforms your database management from manual sync scripts to a professional-grade administration environment with automated workflows! 🎉
