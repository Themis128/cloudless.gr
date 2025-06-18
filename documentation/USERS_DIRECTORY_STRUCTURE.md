# Users Directory Structure

This document describes the structure and purpose of the `pages/users/` directory in the Cloudless.gr application.

## Overview

The users directory handles all user account management and profile-related functionality, separate from the main projects functionality which is handled in `pages/projects/`.

## Directory Structure

```
pages/users/
├── index.vue                   # User dashboard/home (authenticated users)
├── profile/
│   ├── index.vue              # View profile (read-only display)
│   └── edit.vue               # Edit profile (form for updating profile info)
├── account/
│   ├── index.vue              # Account settings overview (navigation hub)
│   ├── security.vue           # Security settings (password, 2FA) [TODO]
│   ├── billing.vue            # Billing information [TODO]
│   └── preferences.vue        # User preferences (theme, notifications) [TODO]
├── notifications/
│   ├── index.vue              # Notifications center (inbox)
│   └── settings.vue           # Notification preferences [TODO]
├── activity/
│   └── index.vue              # User activity log (login history, actions)
├── contact.vue                # Contact functionality ✅ (already exists)
├── codegen.vue                # Code generation feature ✅ (already exists)
└── [id].vue                   # Public user profile (viewable by others)
```

## Page Descriptions

### Core Pages (Implemented)

- **`index.vue`** - User dashboard showing welcome message, stats, and quick actions
- **`profile/index.vue`** - Read-only profile view with avatar, personal info, and stats
- **`profile/edit.vue`** - Profile editing form with avatar upload and form validation
- **`account/index.vue`** - Account settings hub with navigation to various settings
- **`notifications/index.vue`** - Notification center with filtering and mark-as-read functionality
- **`activity/index.vue`** - Activity log with timeline view and filtering options
- **`[id].vue`** - Public user profile page for viewing other users' profiles

### Existing Pages (Preserved)

- **`contact.vue`** - Contact form functionality
- **`codegen.vue`** - Code generation features

### TODO Pages (Not Yet Implemented)

- **`account/security.vue`** - Password change, 2FA setup, security settings
- **`account/billing.vue`** - Subscription management, payment methods
- **`account/preferences.vue`** - Theme selection, language, notification preferences
- **`notifications/settings.vue`** - Configure notification preferences

## Features Implemented

### Profile Management
- ✅ View profile with avatar, personal info, and account stats
- ✅ Edit profile with form validation and avatar upload
- ✅ Public profile view for other users

### Account Settings
- ✅ Settings navigation hub
- ✅ Account deletion with confirmation
- ✅ Data export functionality (basic implementation)

### Notifications
- ✅ Notification center with timeline view
- ✅ Mark as read/unread functionality
- ✅ Filter by type and date
- ✅ Bulk mark all as read

### Activity Tracking
- ✅ Activity timeline with icons and colors
- ✅ Filter by activity type and date
- ✅ Export activity log to CSV
- ✅ Mock data for demonstration

## Navigation Flow

```
/users                         → User Dashboard
/users/profile                 → View Profile
/users/profile/edit           → Edit Profile
/users/account                → Account Settings Hub
/users/account/security       → Security Settings [TODO]
/users/account/billing        → Billing [TODO]
/users/account/preferences    → Preferences [TODO]
/users/notifications          → Notifications Center
/users/notifications/settings → Notification Settings [TODO]
/users/activity               → Activity Log
/users/contact                → Contact Form
/users/codegen                → Code Generation
/users/[id]                   → Public User Profile
```

## Technical Implementation

### Composables Used
- `useSupabaseAuth()` - Authentication state and user info
- `useUserProfile()` - User profile management
- `useFetchProjects()` - Project data for dashboard stats
- `useSupabaseClient()` - Direct Supabase operations

### Database Tables Expected
- `user_profiles` - Extended user profile information
- `notifications` - User notifications
- `user_activity` - Activity log entries
- `projects` - User projects (from main projects section)

### Layouts
- Most pages use `layout: 'user'` for authenticated user areas
- Public profile (`[id].vue`) uses `layout: 'default'`

### Middleware
- All authenticated pages use `middleware: 'auth'`
- Public profile has no middleware restrictions

## Styling & UI

### Design System
- Uses Vuetify 3 components throughout
- Consistent color scheme with primary brand colors
- Material Design icons (`mdi-*`)
- Responsive design with proper breakpoints

### Key UI Patterns
- **Cards** - Main content containers with elevation
- **Timeline** - Activity and notification displays
- **Avatars** - User profile images with fallback generation
- **Chips** - Status indicators and tags
- **Dialogs** - Confirmation modals (e.g., delete account)
- **Snackbars** - Success/error notifications

## Future Enhancements

### Priority 1 (Essential)
- [ ] Implement security settings page
- [ ] Add password change functionality
- [ ] Create preferences management

### Priority 2 (Nice to Have)
- [ ] Two-factor authentication setup
- [ ] Billing and subscription management
- [ ] Advanced notification preferences
- [ ] Social features (follow/unfollow users)
- [ ] Achievement system

### Priority 3 (Advanced)
- [ ] OAuth provider management
- [ ] API key management
- [ ] Advanced privacy controls
- [ ] Account recovery options

## Notes

- The structure separates user account management from project management
- All pages include proper SEO meta tags and page titles
- Error handling includes loading states and fallback content
- Mock data is provided for development/demo purposes
- File upload functionality is implemented for avatar changes
- Export functionality is available for user data
