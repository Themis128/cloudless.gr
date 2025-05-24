# Contact Us Composable Documentation

## Overview

The `useContactUs` composable provides a reusable, self-contained approach to managing contact form functionality in your Vue/Nuxt application. It handles form state, validation, submission, CSRF protection, rate limiting, and error handling.

## Usage

### Basic Usage

```vue
<script setup>
import { useContactUs } from '~/composables/useContactUs';

const {
  form,
  errors,
  isSubmitting,
  isSuccess,
  error,
  rateLimitInfo,
  isRefreshingToken,
  submitForm,
  resetForm,
  refreshCsrfToken,
  checkTokenFreshness,
} = useContactUs();
</script>

<template>
  <form @submit.prevent="submitForm">
    <div>
      <label for="name">Name</label>
      <input id="name" v-model="form.name" @blur="validateName" :class="{ error: errors.name }" />
      <span v-if="errors.name">{{ errors.name }}</span>
    </div>

    <!-- Similar inputs for email, subject, and message -->

    <button type="submit" :disabled="isSubmitting">
      {{ isSubmitting ? 'Sending...' : 'Send' }}
    </button>
  </form>

  <div v-if="isSuccess">Thank you for your message!</div>

  <div v-if="error">
    {{ error }}
    <button
      v-if="error.includes('session')"
      @click="refreshCsrfToken"
      :disabled="isRefreshingToken"
    >
      {{ isRefreshingToken ? 'Refreshing...' : 'Refresh Session' }}
    </button>
  </div>

  <!-- Show token refreshing indicator -->
  <div v-else-if="isRefreshingToken" class="token-refreshing">
    <span class="refresh-spinner"></span>
    Refreshing security token...
  </div>

  <!-- Rate Limit Information (optional) -->
  <div v-if="rateLimitInfo?.remaining">Remaining submissions: {{ rateLimitInfo.remaining }}</div>
</template>
```

### Available Properties and Methods

#### Properties

- `form`: Reactive object containing form input values (name, email, subject, message, csrfToken)
- `errors`: Reactive object containing validation errors for each field
- `isSubmitting`: Boolean indicating if form is currently being submitted
- `isSuccess`: Boolean indicating if form was successfully submitted
- `error`: String containing any submission error message
- `submissionId`: Number containing the ID of the successful submission
- `rateLimitInfo`: Object containing rate limit information (remaining submissions, exceeded status)
- `isRefreshingToken`: Boolean indicating if token refresh is in progress
- `isValid`: Computed boolean indicating if the form is valid

#### Methods

- `validateName()`: Validates the name field
- `validateEmail()`: Validates the email field
- `validateSubject()`: Validates the subject field
- `validateMessage()`: Validates the message field
- `submitForm()`: Submits the form data to the server
- `resetForm()`: Resets the form to its initial state
- `refreshCsrfToken()`: Manually refreshes the CSRF token
- `checkTokenFreshness()`: Checks if the token is getting old and needs refreshing before submission

## Features

### Validation

The composable includes built-in validation for all form fields:

- **Name**: Required
- **Email**: Required and must be a valid email format
- **Subject**: Required
- **Message**: Required

### Form Auto-Save

The composable automatically saves form data as the user types:

1. Saves all form fields to localStorage
2. Restores form data when the component is mounted
3. Clears saved data after successful submission
4. Time-limited storage (expires after 7 days)
5. Provides visual feedback during auto-save

### CSRF Protection

The composable automatically handles CSRF token management:

1. Fetches a token when mounted
2. Includes the token with form submissions
3. Fetches a new token after successful submission
4. Shows proper error messages for token validation failures
5. Provides a token refresh mechanism for expired sessions
6. Automatically refreshes tokens before they expire (after 3 hours)
7. Provides visual feedback during token refresh operations
8. Stores a backup token in localStorage for improved reliability
9. Uses secure cryptographic hashing for token generation
10. Handles token expiration gracefully with user-friendly messaging

Token refreshing happens in several situations:

- On component mount
- When the refresh button is clicked
- Automatically before submission if the token is older than 3 hours
- Automatically every 30 minutes for long user sessions
- After successful form submission

The token is valid for 4 hours (up from the previous 1 hour) to reduce the frequency of token expiration errors while maintaining security.

### Rate Limiting

The composable handles rate limiting information:

1. Tracks remaining submissions
2. Detects when rate limit is exceeded
3. Provides feedback about when the user can try again

## API Endpoint

The composable sends data to the `/api/contact` endpoint, which expects a POST request with the following JSON structure:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "subject": "Inquiry Subject",
  "message": "User's message text...",
  "csrfToken": "token-from-csrf-token-endpoint"
}
```

The endpoint returns responses in the following format:

```json
{
  "status": "success" | "error",
  "message": "Response message",
  "submissionId": 123,  // ID of the stored submission (on success)
  "rateLimit": {        // Rate limit information (optional)
    "remaining": 4,     // Number of submissions remaining
    "exceeded": false   // Whether the rate limit has been exceeded
  }
}
```

## Database Storage

When a user submits the contact form, the data is stored in the SQLite database using Prisma ORM. The submission can be viewed and managed in the admin interface at `/admin/contact-submissions`.

The schema for the ContactSubmission model includes:

- id (Int, auto-increment)
- name (String)
- email (String)
- subject (String)
- message (String)
- createdAt (DateTime)
- status (String): "new", "read", "replied", "archived"
- notes (String, optional): For admin notes

## Implementation Details

The contact form system uses several server components:

1. `/api/csrf-token`: Generates and returns a CSRF token
2. `/api/contact`: Processes the form submission, validates inputs, and stores in the database
3. `/api/contact-submissions`: Admin API for listing and managing submissions
4. `server/utils/csrf-protection.ts`: Utility for generating and validating CSRF tokens
5. `server/utils/rate-limiter.ts`: Utility for managing submission rate limits

## Final Enhancements

The contact form system now includes the following advanced features:

1. **User-friendly interface** with proper validation and error feedback
2. **CSRF protection** with secure token generation and validation
3. **Rate limiting** to prevent spam submissions
4. **Persistent token storage** to survive server restarts
5. **Automatic token refresh** for long-lived sessions
6. **Database storage** for form submissions
7. **Admin interface** for managing submissions
8. **Comprehensive test page** for verifying functionality

All of these features work together to create a secure, reliable, and user-friendly contact form system that can handle real-world usage scenarios with grace.

## Next Steps

Future improvements could include:

1. Email notifications for new submissions
2. Advanced spam detection using machine learning
3. Internationalization for error messages and form labels
4. Analytics dashboard for monitoring form usage patterns
