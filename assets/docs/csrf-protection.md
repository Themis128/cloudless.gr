# CSRF Protection for Contact Form

This document outlines the Cross-Site Request Forgery (CSRF) protection implementation for the contact form system.

## Overview

CSRF is an attack that forces authenticated users to submit unwanted requests to web applications. Our contact form system implements token-based CSRF protection to ensure that form submissions are legitimate and initiated from our own website.

## Implementation Details

### Server-Side Implementation

The CSRF protection is implemented in `server/utils/csrf-protection.ts` and provides the following functionality:

1. **Token Generation**: Creates unique tokens associated with user sessions using secure cryptographic hashing.
2. **Token Validation**: Verifies that incoming requests contain valid tokens.
3. **Token Invalidation**: Ensures tokens can only be used once.
4. **Expiration Handling**: Automatically expires tokens after a certain time.
5. **Cryptographic Security**: Uses SHA-256 hashing when available for more secure token generation.

### API Endpoints

1. **Token Generation Endpoint** (`/api/csrf-token`):

   - Generates a new CSRF token for the current session.
   - Sets the token in an HTTP-only cookie with a 4-hour expiration.
   - Returns the token to be included in the form as a hidden field.
   - Uses 'lax' SameSite policy to balance security and functionality.

2. **Contact Form Endpoint** (`/api/contact`):
   - Validates the CSRF token from both cookie and request body.
   - Rejects the request if the token is invalid or missing.
   - Invalidates the token after successful use to prevent replay attacks.
   - Provides detailed error messages to help users troubleshoot issues.
   - Implements more lenient validation in development mode for testing.

### Client-Side Integration

The contact form composable (`useContactUs.ts`) handles CSRF tokens by:

1. Adding a CSRF token field to the form data.
2. Automatically fetching a new token when the composable is initialized.
3. Refreshing the token after form submission or reset.
4. Including the token with each form submission.
5. Providing a token refresh mechanism for expired tokens.
6. Implementing automatic token freshness checking (refreshes after 3 hours).
7. Adding periodic background refresh for long-lived sessions (every 30 minutes).
8. Storing backup tokens in localStorage with timestamps for better reliability.
9. Providing visual feedback during token refresh operations.

## Security Benefits

This CSRF protection approach provides several security benefits:

1. **Double Submit Verification**: Validates the token from both cookie and request body.
2. **One-Time Use**: Tokens are invalidated after use to prevent replay attacks.
3. **Automatic Expiration**: Tokens expire after a set time period (4 hours, increased from 1 hour).
4. **HTTP-Only Cookies**: Prevents JavaScript from accessing the token in the cookie.
5. **SameSite Policy**: Cookies are set with appropriate SameSite policies.
6. **Cryptographic Hashing**: Uses secure hashing algorithms when available.
7. **Token Rotation**: Automatically refreshes tokens before they expire.

## User Experience

The CSRF protection is designed to be user-friendly:

- Token fetching happens automatically when the page loads.
- If a token error occurs, users receive a clear message with a "Refresh Session" button.
- Backup tokens are stored to handle edge cases and improve reliability.
- Extended token validity period (4 hours) reduces frequency of expiration issues.
- Visual feedback during token refresh operations (loading spinner).
- Automatic token refresh for long-lived sessions prevents disruption.

## Handling Session Expiration

To improve user experience when tokens expire:

1. **Clear Error Messages**: Users receive specific messages about session expiration.
2. **One-Click Refresh**: A dedicated "Refresh Session" button allows users to quickly get a new token.
3. **Local Backup**: A backup copy of the token is saved (not for security, but for convenience).
4. **Extended Validity**: Token validity period extended to 4 hours to reduce expiration frequency.
5. **Automatic Refresh**: Tokens are automatically refreshed after 3 hours to prevent expiration.
6. **Visual Feedback**: Users see loading indicators during token refresh operations.
7. **Proactive Refreshing**: System checks token age before form submission and refreshes if needed.
8. **Backup Recovery**: If the main token is lost, the system attempts to recover from localStorage.

## Implementation Timeline

- **Initial Implementation**: Basic CSRF protection with 1-hour token validity
- **First Enhancement**: Added token refresh button and improved error messages
- **Second Enhancement**: Extended token validity to 4 hours and added backup token storage
- **Current Version**: Implemented automatic token freshness checking, cryptographic security,
  and visual feedback during refresh operations

## Testing

The contact form system includes a dedicated test page at `/test-contact-form.vue` that provides:

1. Form validation testing
2. CSRF token testing
3. Token refresh testing
4. Token age detection testing
5. Form submission testing
6. Rate limit testing

This test page helps verify that all aspects of the CSRF protection are working correctly.

## Future Improvements

Previous potential enhancements that have now been implemented:

1. ✅ Implemented secure token generation using cryptographic libraries (SHA-256)
2. ✅ Added persistent storage for tokens to survive server restarts
3. ✅ Added improved logging and monitoring for CSRF token operations
4. ✅ Implemented automatic token freshness checking

Remaining future enhancements:

1. Implement a monitoring dashboard for CSRF token operations
2. Add analytics to track and prevent potential CSRF attacks
3. Explore more modern approaches like SameSite=strict cookies combined with custom headers
