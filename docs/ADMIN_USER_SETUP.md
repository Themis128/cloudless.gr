# Admin User Setup

This document describes how to add admin users to the Cloudless.gr application.

## Current Admin User

**Email:** `baltzakis.themis@gmail.com`
**Password:** `TH!123789th!`
**Name:** Themis Baltzakis
**Role:** admin
**Status:** active & verified

## Scripts Available

### 1. Add Admin User

```bash
# Using Node.js directly
node scripts/add-admin-user.js

# Using PowerShell wrapper
powershell -ExecutionPolicy Bypass -File scripts/add-admin-user.ps1
```

### 2. Verify Admin User

```bash
node scripts/verify-admin-user.js
```

## How It Works

1. **Password Hashing:** Uses bcrypt with 10 salt rounds for secure password storage
2. **User Creation:** Creates or updates user with admin role, active status, and verified email
3. **Database Integration:** Uses Prisma ORM to interact with the SQLite database
4. **Error Handling:** Includes proper error handling and validation

## Security Features

- ✅ Passwords are hashed using bcrypt
- ✅ Admin users are automatically verified
- ✅ Account locking after failed login attempts
- ✅ Session management with JWT tokens
- ✅ Rate limiting for login attempts

## Database Schema

The admin user is stored in the `User` table with the following key fields:

- `email`: Unique identifier
- `password`: Bcrypt hashed password
- `role`: Set to 'admin'
- `isActive`: Set to true
- `isVerified`: Set to true

## Login Access

The admin user can access:

- Admin dashboard at `/admin`
- All admin features and controls
- User management
- System analytics
- Contact submissions
- Health monitoring

## Troubleshooting

If you encounter issues:

1. **Check Node.js installation:** `node --version`
2. **Verify Prisma client:** `npx prisma generate`
3. **Check database connection:** `npx prisma db push`
4. **Run verification script:** `node scripts/verify-admin-user.js`

## Adding More Admin Users

To add additional admin users, modify the `scripts/add-admin-user.js` file and change the email, password, and name variables, then run the script.
