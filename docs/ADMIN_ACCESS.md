# Admin Access & Authentication

## 🔐 Admin Credentials (Development)

### Default Admin Login
```
Email: admin@cloudless.gr
Password: cloudless2025
```

**⚠️ Security Note**: These are development-only credentials. In production, use proper authentication with Supabase Auth or Auth0.

## 🛡️ Authentication System

### Admin Routes
- **Admin Login**: `/auth/admin-login`
- **Admin Dashboard**: `/admin/dashboard`
- **Contact Submissions**: `/admin/contact-submissions`
- **Settings**: `/admin/settings`

### User Routes
- **User Login**: `/auth/login`
- **User Dashboard**: `/dashboard`
- **Profile**: `/settings`

## 🚦 Middleware Configuration

### 1. Global Middleware

#### `auth.global.ts`
- **Purpose**: Global authentication check for all routes
- **Behavior**: 
  - Allows public routes: `/`, `/about`, `/contact`, `/docs`, `/auth/*`
  - Requires authentication for all other routes
  - Validates JWT tokens and user data
  - Redirects to `/auth/login` if invalid

#### `admin-login-redirect.global.ts`
- **Purpose**: Redirects old admin login routes
- **Behavior**: Redirects `/admin/login` → `/auth/admin-login`

#### `static-assets.global.ts`
- **Purpose**: Skip middleware for static assets
- **Behavior**: Bypasses auth for `/_nuxt/`, `/api/`, and file requests

### 2. Route-Specific Middleware

#### `admin-required.ts`
- **Purpose**: Protects admin-only routes
- **Usage**: Add `definePageMeta({ middleware: 'admin-required' })` to admin pages
- **Behavior**:
  - Checks for `admin_token` and `admin_user` in localStorage
  - Validates user role is 'admin'
  - Redirects to `/auth/admin-login` if unauthorized

#### `auth-required.ts`
- **Purpose**: Protects user-authenticated routes
- **Usage**: Add `definePageMeta({ middleware: 'auth-required' })` to protected pages
- **Behavior**:
  - Uses `useAuth()` composable
  - Redirects to `/auth/login` if not authenticated

## 🔧 Setup Instructions

### 1. Environment Variables
```bash
# Copy the example file
cp .env.example .env

# Update admin credentials (if needed)
ADMIN_EMAIL=admin@cloudless.gr
ADMIN_PASSWORD=cloudless2025
```

### 2. Database Setup
```bash
# If using Prisma
npx prisma migrate dev
npx prisma generate

# If using Supabase
# Import the schema from supabase-schema.sql
```

### 3. Admin User Creation

#### Option A: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to Authentication > Users
3. Create a new user with admin@cloudless.gr
4. Set metadata: `{ "role": "admin" }`

#### Option B: SQL Insert
```sql
-- Insert admin user directly
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  'admin@cloudless.gr',
  crypt('cloudless2025', gen_salt('bf')),
  now(),
  '{"role": "admin"}'::jsonb
);
```

## 🔍 Testing Authentication

### Test Admin Access
```bash
# Run the test script
pwsh ./test-auth.ps1
```

### Manual Testing
1. Navigate to `/auth/admin-login`
2. Enter credentials:
   - Email: `admin@cloudless.gr`
   - Password: `cloudless2025`
3. Should redirect to `/admin/dashboard`

### Test User Access
1. Navigate to `/auth/login`
2. Register or login with Supabase Auth
3. Should redirect to `/dashboard`

## 🐛 Troubleshooting

### Common Issues

#### 1. "Middleware not found" error
**Solution**: Ensure middleware files are in `/middleware/` directory and properly exported

#### 2. "localStorage is not defined" error
**Cause**: Accessing localStorage on server-side
**Solution**: Check `process.client` or `typeof window !== 'undefined'`

#### 3. Infinite redirect loops
**Cause**: Middleware redirecting to a route that triggers the same middleware
**Solution**: Add proper route exclusions in global middleware

#### 4. Admin routes not protected
**Cause**: Missing `definePageMeta({ middleware: 'admin-required' })`
**Solution**: Add middleware definition to admin pages

#### 5. "Page not found" for admin routes
**Cause**: Missing admin pages or incorrect routing
**Solution**: Ensure admin pages exist in `/pages/admin/` directory

### Recent Fixes Applied

✅ **Created `/pages/admin/dashboard.vue`** - Full admin dashboard with stats and quick actions
✅ **Created `/pages/admin/contact-submissions.vue`** - Contact form management interface  
✅ **Fixed middleware protection** - Added `definePageMeta({ middleware: 'admin-required' })` to admin pages
✅ **Fixed user dashboard protection** - Added `definePageMeta({ middleware: 'auth-required' })` to `/pages/dashboard.vue`
✅ **Updated redirect paths** - Ensured consistent routing to `/auth/admin-login`

### Debug Commands
```bash
# Check middleware execution
npm run dev
# Monitor console for middleware logs

# Validate JWT tokens
# Use browser dev tools → Application → Local Storage
# Check auth_token and admin_token values
```

## 🔒 Security Best Practices

### Development
- Use the provided default credentials
- Enable console logging for debugging
- Test all authentication flows

### Production
- **Change default credentials immediately**
- Use environment variables for all secrets
- Enable HTTPS
- Implement proper session management
- Add rate limiting
- Use Supabase RLS policies
- Regular security audits

### Environment Variables for Production
```bash
# Strong, unique passwords
ADMIN_EMAIL=your-admin@yourdomain.com
ADMIN_PASSWORD=your-very-strong-password

# Secure JWT secret (32+ characters)
NUXT_JWT_SECRET=your-cryptographically-secure-jwt-secret

# Supabase production keys
NUXT_SUPABASE_URL=https://your-prod-project.supabase.co
NUXT_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_KEY=your_production_service_key
```

## 📚 Related Documentation
- [Nuxt 3 Middleware](https://nuxt.com/docs/guide/directory-structure/middleware)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)