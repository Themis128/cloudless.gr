# pgAdmin Enhanced Configuration - Quick Reference

## 🚀 What's Been Configured

### Enhanced pgAdmin Features:
✅ **Pre-configured Database Servers**
- **Local Supabase** (Green theme) - Your development database
- **Cloud Supabase** (Red theme) - Your production database

✅ **Automatic Password Management**
- No manual password entry needed
- Secure credential storage

✅ **Ready-to-Use SQL Scripts**
- Database health checks
- Schema comparisons
- Data verification tools

✅ **Professional Interface**
- Color-coded server themes
- Optimized settings for development
- Enhanced query editor

---

## 🔧 Management Commands

```powershell
# Start enhanced pgAdmin
.\pgadmin-enhanced.ps1 -Action start

# Check status
.\pgadmin-enhanced.ps1 -Action status

# Restart with new config
.\pgadmin-enhanced.ps1 -Restart

# View logs
.\pgadmin-enhanced.ps1 -Logs

# Complete reset (destructive)
.\pgadmin-enhanced.ps1 -Reset
```

---

## 🌐 Access Information

- **URL**: http://localhost:8080
- **Email**: admin@cloudless.gr
- **Password**: admin123

---

## 📊 Using the SQL Scripts

Navigate to the server and open a new Query Tool, then load these scripts:

### 1. **database-overview.sql**
- Complete database health check
- Table sizes and row counts
- Recent activity monitoring
- Auth user statistics

### 2. **schema-comparison.sql**
- Compare table structures between environments
- Column definitions and constraints
- Index information
- Perfect for troubleshooting schema mismatches

### 3. **data-verification.sql**
- Verify sync operations
- Check data consistency
- Quality assurance checks
- Identify missing or duplicate records

---

## 🎨 Visual Features

### Color-Coded Servers:
- 🟢 **Local Supabase**: Green theme (safe for testing)
- 🔴 **Cloud Supabase**: Red theme (production - be careful!)

### Enhanced Query Editor:
- Syntax highlighting
- Auto-completion
- Line numbers
- Bracket matching
- Tab size: 4 spaces

---

## 🔄 Integration with Sync Scripts

The enhanced pgAdmin works seamlessly with your sync scripts:

1. **Run sync**: `.\sync-comprehensive.ps1 -ServiceRoleKey "..." -IncludeAuth -DatabasePassword "supabase2025"`
2. **Verify in pgAdmin**: Use the data-verification.sql script
3. **Compare schemas**: Use schema-comparison.sql to identify differences
4. **Monitor health**: Use database-overview.sql for ongoing monitoring

---

## 💡 Pro Tips

1. **Bookmark Useful Queries**: Save frequently used queries in pgAdmin
2. **Use Explain Analyze**: For performance optimization
3. **Export/Import**: Easy backup and restore functionality
4. **Multiple Tabs**: Compare data between Local and Cloud side-by-side
5. **Color Coding**: Always check the server color before making changes!

---

## 🛠️ Troubleshooting

### Can't Connect to Cloud Supabase?
- Verify the database password in pgpass file
- Check network connectivity
- Ensure database allows external connections

### Local Connection Issues?
- Ensure Supabase is running: `supabase status`
- Check Docker containers: `docker ps`
- Restart local Supabase if needed

### SQL Scripts Not Loading?
- Check file permissions
- Verify the scripts are mounted in the container
- Restart pgAdmin: `.\pgadmin-enhanced.ps1 -Restart`

---

## 🔐 Security Notes

- Passwords are stored securely in container volumes
- Cloud database access is read-only by default
- Always verify which server you're connected to before making changes
- Use the color coding to avoid accidents!
