# Frontend/Backend Sync Issues Report

## Critical Issues Found

### 1. User Profile Field Mismatch ✅ FIXED

**Problem**: Profile pages were expecting `first_name` and `last_name` fields not in database schema.

**Solution Applied**: 
- Updated profile edit page (`pages/users/profile/edit.vue`) to use `full_name` instead of separate first/last name fields
- Updated profile display page (`pages/users/profile/index.vue`) to show `full_name` instead of separate fields  
- Added informative alert explaining the single name field approach
- Fixed database table reference from `user_profiles` to `profiles` (the actual table in use)

**Database Schema Used:**
```sql
-- profiles table
full_name TEXT
bio TEXT  
email TEXT
avatar_url TEXT
role TEXT
```

### 2. Preferences Storage Gap

**Problem**: Preferences not properly integrated with backend.

**Current**: localStorage only (not synced across devices)
**Database**: `preferences JSONB` field exists but unused
**Frontend Interface**: Complex preference system with theme, notifications, etc.

**Fix Required**: Integrate frontend preferences with database storage.

### 3. Security Features Missing Backend

**Problem**: Security settings UI has no backend implementation.

**Missing APIs:**
- Password change endpoint  
- Two-factor authentication toggle
- Session management/revocation
- Active sessions listing

**Fix Required**: Implement security API endpoints.

### 4. Notification Preferences Not Persisted

**Problem**: Notification settings are frontend-only.

**Missing**:
- Database schema for notification preferences
- API endpoints for saving/loading notification settings
- Integration with actual notification system

## Immediate Action Items

### High Priority
1. **Fix profile field mapping** - Update frontend to match database schema
2. **Integrate preferences storage** - Connect frontend preferences to database
3. **Implement password change API** - Critical security feature

### Medium Priority  
4. **Add notification preferences storage** - Enhance user experience
5. **Implement session management** - Security enhancement
6. **Add 2FA system** - Advanced security

### Low Priority
7. **Add missing profile fields** - Extended user info (company, job title)

## Recommended Approach

1. **Quick Fix**: Update frontend to work with existing backend
2. **Long Term**: Enhance backend to support all frontend features
3. **Migration Strategy**: Graceful migration of localStorage preferences to database

## Files Requiring Updates

### Frontend
- `pages/users/settings.vue` - Field mapping
- `stores/userStore.ts` - Preferences integration  
- `composables/useRobustAuth.ts` - Enhanced profile updates

### Backend  
- New API endpoints in `server/api/user/`
- Database migration for missing fields
- Enhanced user profile operations in `useSupabaseDB.ts`
