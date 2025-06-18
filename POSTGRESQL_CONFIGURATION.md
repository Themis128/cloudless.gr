# PostgreSQL Extension Configuration Guide

## 🎯 Overview

This guide explains how to use the PostgreSQL extensions in VS Code with your Supabase + pgAdmin setup.

## 🔧 Installed Extensions

### 1. Official PostgreSQL Extension (`ms-ossdata.vscode-pgsql`)

- **Purpose**: Official Microsoft PostgreSQL extension
- **Features**: IntelliSense, syntax highlighting, query execution
- **Configuration**: Pre-configured in `.vscode/settings.json`

### 2. Database Client (`cweijan.vscode-postgresql-client2`)

- **Purpose**: Visual database management and query execution
- **Features**: Database explorer, query results, schema visualization
- **Configuration**: Pre-configured with local Supabase connection

### 3. Database Client JDBC (`cweijan.dbclient-jdbc`)

- **Purpose**: JDBC adapter for additional database support
- **Features**: Extended database connectivity options

## 🚀 Quick Start

### 1. Start Your Database Environment

```bash
# Start Supabase (if not already running)
npx supabase start

# Start pgAdmin
docker-compose -f docker-compose.admin.yml up -d
```

### 2. Access Database Tools

#### VS Code Extensions (Built-in)

1. **Command Palette** → `PostgreSQL: Connect to Server`
2. Select "Local Supabase (Development)" from the dropdown
3. Start writing SQL queries in `.sql` files

#### pgAdmin Web Interface

1. Open: http://localhost:8080
2. Login: `admin@cloudless.gr` / `admin123`
3. Connect to "Local Supabase" server

## 📋 VS Code Tasks Available

Open Command Palette (`Ctrl+Shift+P`) and run:

### Database Management

- **PostgreSQL: Start pgAdmin** - Start pgAdmin container
- **PostgreSQL: Stop pgAdmin** - Stop pgAdmin container
- **PostgreSQL: Open pgAdmin Web** - Open pgAdmin in browser
- **PostgreSQL: Test Local Connection** - Test database connectivity
- **PostgreSQL: Run Database Health Check** - Comprehensive health check
- **PostgreSQL: Backup Users** - Backup user data
- **PostgreSQL: Show Connection Info** - Display connection details

## 🔌 Connection Details

### Local Supabase Database

```
Host: localhost
Port: 5432
Database: postgres
Username: postgres
Password: postgres
Connection String: postgresql://postgres:postgres@localhost:5432/postgres
```

### pgAdmin Web Access

```
URL: http://localhost:8080
Email: admin@cloudless.gr
Password: admin123
```

## 📝 Writing SQL Queries

### 1. Create SQL Files

- Create `.sql` files in your workspace
- VS Code will automatically provide syntax highlighting and IntelliSense
- Use `Ctrl+Shift+P` → `PostgreSQL: Execute Query` to run queries

### 2. Using the Database Explorer

1. Open the **Database Explorer** tab in VS Code sidebar
2. Expand "Local Supabase" connection
3. Browse tables, views, functions, etc.
4. Right-click on objects for context menu options

### 3. Query Results

- Results appear in a new tab within VS Code
- Export results to CSV, JSON, or other formats
- View query execution plans and performance metrics

## 🛠️ Advanced Features

### IntelliSense and Auto-completion

- **Table names**: Auto-complete when typing `FROM` or `JOIN`
- **Column names**: Auto-complete based on selected tables
- **Functions**: PostgreSQL function signatures and documentation
- **Keywords**: SQL keyword completion and case formatting

### Code Lenses

- **Execute Query**: Click on lens above query to run
- **Explain Plan**: Get query execution plan
- **Format Query**: Auto-format SQL code

### Diagnostics

- **Syntax Errors**: Real-time syntax checking
- **Performance Warnings**: Identify potential performance issues
- **Best Practices**: Suggestions for SQL improvements

## 📊 Working with Supabase

### Common Queries

```sql
-- Check auth users
SELECT * FROM auth.users LIMIT 10;

-- Check user profiles
SELECT * FROM profiles LIMIT 10;

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies WHERE schemaname = 'public';

-- Check database size
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Supabase-specific Features

- **RLS Policies**: View and edit Row Level Security policies
- **Auth Schema**: Access authentication tables and functions
- **Real-time**: Query real-time subscription configurations
- **Storage**: Manage file storage buckets and policies

## 🔧 Configuration Files

### VS Code Settings (`.vscode/settings.json`)

```json
{
  "pgsql.connections": [...],
  "pgsql.defaultConnection": "Local Supabase (Development)",
  "pgsql.enableIntellisense": true,
  "pgsql.enableCodeLens": true,
  "sql.format.keywordCase": "upper"
}
```

### Database Config (`db-config.ini`)

- Contains connection strings for both local and cloud databases
- Used by PowerShell scripts for automated operations
- Environment variables for sensitive data

## 🚨 Troubleshooting

### Common Issues

#### 1. Connection Refused

```bash
# Check if Supabase is running
npx supabase status

# Start if not running
npx supabase start
```

#### 2. pgAdmin Not Accessible

```bash
# Check container status
docker ps | grep pgadmin

# Restart pgAdmin
docker-compose -f docker-compose.admin.yml restart
```

#### 3. Extension Not Working

1. Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Check extension settings in `.vscode/settings.json`
3. Verify connection details

#### 4. IntelliSense Not Working

1. Ensure connection is established
2. Check `pgsql.enableIntellisense` setting
3. Refresh database metadata (`Ctrl+Shift+P` → "PostgreSQL: Refresh IntelliSense")

### Performance Tips

1. **Query Timeouts**: Adjust timeout settings for long-running queries
2. **Result Limits**: Set appropriate limits for large result sets
3. **Connection Pooling**: Use connection pooling for multiple connections
4. **Cache Management**: Clear extension cache if experiencing issues

## 📚 Additional Resources

- **Supabase Documentation**: https://supabase.com/docs/guides/database
- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **pgAdmin Documentation**: https://www.pgadmin.org/docs/
- **VS Code PostgreSQL Extension**: Official Microsoft documentation

## 🎉 Next Steps

1. **Start Database Environment**: Run the startup tasks
2. **Create SQL Files**: Start writing queries with full IntelliSense
3. **Use pgAdmin**: Access the web interface for visual management
4. **Run Health Checks**: Use the built-in tasks to verify everything works
5. **Backup Regularly**: Use the automated backup scripts

Your PostgreSQL development environment is now fully configured and ready for productive database development! 🚀
