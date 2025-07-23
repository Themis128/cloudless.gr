# 🔐 Authentication Tables Documentation

## Overview
This document describes the authentication-related tables that have been added to enhance security, user management, and session handling.

## 📋 Table Structure

### 1. **User Table (Enhanced)**
The main user table with additional security fields:

```sql
model User {
  id         Int         @id @default(autoincrement())
  email      String      @unique
  password   String
  name       String
  role       String      @default("user")
  isActive   Boolean     @default(true)      -- Account status
  isVerified Boolean     @default(false)     -- Email verification
  lastLogin  DateTime?                       -- Last login timestamp
  loginAttempts Int      @default(0)         -- Failed login attempts
  lockedUntil DateTime?                      -- Account lockout until
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  
  -- Relations to other tables
  sessions   Session[]
  loginHistory LoginHistory[]
  passwordResetTokens PasswordResetToken[]
  emailVerificationTokens EmailVerificationToken[]
}
```

**Security Features:**
- Account activation/deactivation
- Email verification status
- Login attempt tracking
- Account lockout mechanism
- Last login tracking

### 2. **Session Table**
Manages user sessions for better security control:

```sql
model Session {
  id        String   @id @default(cuid())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Features:**
- Session token management
- IP address tracking
- User agent tracking
- Session expiration
- Active/inactive session control

### 3. **LoginHistory Table**
Tracks all login attempts for security monitoring:

```sql
model LoginHistory {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  ipAddress String?
  userAgent String?
  success   Boolean
  createdAt DateTime @default(now())
}
```

**Security Benefits:**
- Audit trail of all login attempts
- Failed login detection
- Suspicious activity monitoring
- IP address analysis

### 4. **PasswordResetToken Table**
Manages password reset functionality:

```sql
model PasswordResetToken {
  id        String   @id @default(cuid())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

**Features:**
- Secure password reset tokens
- Token expiration
- One-time use tokens
- User association

### 5. **EmailVerificationToken Table**
Handles email verification process:

```sql
model EmailVerificationToken {
  id        String   @id @default(cuid())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

**Features:**
- Email verification tokens
- Token expiration
- One-time use verification
- User account verification

### 6. **RateLimit Table**
Implements rate limiting for security:

```sql
model RateLimit {
  id        String   @id @default(cuid())
  key       String   @unique  -- IP address or user ID
  type      String            -- "login", "api", "register"
  count     Int      @default(1)
  windowStart DateTime
  windowEnd   DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}
```

**Security Features:**
- Rate limiting by IP or user
- Different limits for different actions
- Time window management
- Brute force protection

## 🔧 Usage Examples

### Creating a User
```typescript
const user = await prisma.user.create({
  data: {
    email: 'user@example.com',
    password: hashedPassword,
    name: 'John Doe',
    role: 'user',
    isActive: true,
    isVerified: false
  }
})
```

### Creating a Session
```typescript
const session = await prisma.session.create({
  data: {
    userId: user.id,
    token: 'session-token-123',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...'
  }
})
```

### Recording Login History
```typescript
await prisma.loginHistory.create({
  data: {
    userId: user.id,
    ipAddress: '192.168.1.1',
    userAgent: 'Chrome/120.0.0.0',
    success: true
  }
})
```

### Creating Password Reset Token
```typescript
const resetToken = await prisma.passwordResetToken.create({
  data: {
    userId: user.id,
    token: 'reset-token-123',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  }
})
```

## 🛡️ Security Benefits

1. **Account Protection**
   - Login attempt tracking
   - Account lockout mechanism
   - Email verification requirement

2. **Session Security**
   - Session token management
   - IP address tracking
   - Session expiration

3. **Audit Trail**
   - Complete login history
   - Failed attempt monitoring
   - Security event tracking

4. **Rate Limiting**
   - Brute force protection
   - API abuse prevention
   - DDoS mitigation

5. **Password Security**
   - Secure reset tokens
   - One-time use tokens
   - Token expiration

## 📊 Database Statistics

Current table counts:
- **Users**: 1 (admin user)
- **Sessions**: 1 (demo session)
- **Login History**: 2 (demo records)
- **Password Reset Tokens**: 1 (demo token)
- **Email Verification Tokens**: 1 (demo token)
- **Rate Limit Records**: 1 (demo record)

## 🔄 Migration Status

✅ **Migration Applied**: `20250723140001_init_with_auth_tables`
✅ **Database Synced**: All tables created successfully
✅ **Admin User**: Recreated with new schema
✅ **Demo Data**: Populated for testing

## 🚀 Next Steps

1. **Update Authentication Logic**
   - Integrate session management
   - Add login attempt tracking
   - Implement account lockout

2. **Add Email Verification**
   - Send verification emails
   - Verify email tokens
   - Update user verification status

3. **Implement Password Reset**
   - Send reset emails
   - Validate reset tokens
   - Update passwords securely

4. **Add Rate Limiting**
   - Implement rate limit checks
   - Add middleware for API protection
   - Monitor and log rate limit violations 