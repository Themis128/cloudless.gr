# System Admin Creation - Backdoor Access

This is a secure backdoor system for creating system administrators when needed.

## Access Credentials

- **Username**: `sysadmin_cl_2025`
- **Password**: `CL_Sys_Acc3ss_2025!@#$`

## Web Interface Access

Navigate to: `https://your-domain.com/sys/maintenance`

This page is hidden from search engines and navigation.

## API Access via cURL

### 1. Authenticate System Access

```bash
curl -X POST https://your-domain.com/api/system/auth \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sysadmin_cl_2025",
    "password": "CL_Sys_Acc3ss_2025!@#$"
  }'
```

### 2. Create Admin User

```bash
curl -X POST https://your-domain.com/api/system/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sysadmin_cl_2025",
    "email": "admin@example.com",
    "password": "AdminPass123!",
    "fullName": "System Administrator"
  }'
```

## Local Development

For local development (localhost:3000):

### Authenticate
```bash
curl -X POST http://localhost:3000/api/system/auth \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sysadmin_cl_2025",
    "password": "CL_Sys_Acc3ss_2025!@#$"
  }'
```

### Create Admin
```bash
curl -X POST http://localhost:3000/api/system/create-admin \
  -H "Content-Type: application/json" \
  -d '{
    "username": "sysadmin_cl_2025",
    "email": "newadmin@cloudless.gr",
    "password": "SecureAdmin123!@#",
    "fullName": "New Administrator"
  }'
```

## One-Line Admin Creation

```bash
curl -X POST http://localhost:3000/api/system/create-admin \
  -H "Content-Type: application/json" \
  -d '{"username":"sysadmin_cl_2025","email":"admin@cloudless.gr","password":"NewAdmin123!@#","fullName":"System Admin"}' \
  && echo "Admin created successfully"
```

## Test Admin Login Capabilities

Test that admin users can log in both as regular users and as admins:

```bash
# Test admin login as regular user (should succeed)
curl -X POST http://localhost:3000/api/system/login-test \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin2@cloudless.gr",
    "password": "TestAdmin123!",
    "require_admin": false
  }'

# Test admin login as admin (should succeed)
curl -X POST http://localhost:3000/api/system/login-test \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testadmin2@cloudless.gr",
    "password": "TestAdmin123!",
    "require_admin": true
  }'

# Test regular user login as admin (should fail)
curl -X POST http://localhost:3000/api/system/login-test \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "UserPass123!",
    "require_admin": true
  }'
```

## Environment Variables (Production)

Set these environment variables in production for security:

```bash
SYSTEM_USERNAME=your_secure_username
SYSTEM_PASSWORD=your_secure_password
```

## Security Features

1. **Credential Protection**: System credentials can be set via environment variables
2. **Rate Limiting**: 2-second delay on failed authentication attempts
3. **Audit Logging**: All access attempts are logged with timestamps
4. **Double Verification**: Admin creation requires system username verification
5. **Password Validation**: Strong password requirements enforced
6. **Hidden Interface**: Web interface hidden from search engines and navigation
7. **Duplicate Prevention**: Prevents creating admins with existing emails
8. **Auto-cleanup**: Failed admin creation attempts clean up partial data

## Example Response

### Successful Authentication
```json
{
  "success": true,
  "message": "System access granted",
  "timestamp": "2025-06-21T10:30:00.000Z"
}
```

### Successful Admin Creation
```json
{
  "success": true,
  "message": "Administrator created successfully",
  "admin": {
    "id": "uuid-here",
    "email": "admin@cloudless.gr",
    "fullName": "System Admin",
    "role": "admin"
  },
  "timestamp": "2025-06-21T10:31:00.000Z"
}
```

## Emergency Access

If you need emergency access and the system is locked:

1. Access the local Supabase database directly
2. Run the database sync script: `supabase/database-sync.sql`
3. Use the existing admin account: `admin@cloudless.gr` / `Admin123!`

## Notes

- The web interface provides a user-friendly way to create admins
- The API endpoints allow for programmatic admin creation
- All actions are logged for security auditing
- The system prevents duplicate admin creation
- Password requirements are enforced for security
