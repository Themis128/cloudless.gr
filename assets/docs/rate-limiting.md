# Rate Limiting for Contact Form

This document outlines the rate limiting implementation for the contact form system to prevent spam submissions.

## Overview

The contact form system includes a rate limiter that restricts the number of submissions from the same IP address within a specific time window. This helps to prevent spam submissions while still allowing legitimate users to contact us.

## Implementation Details

### Server-Side Implementation

The rate limiter is implemented in `server/utils/rate-limiter.ts` and provides the following functionality:

1. **Tracking Submissions**: Uses a Map to store IP addresses and their submission timestamps.
2. **Configuration**:

   - `MAX_SUBMISSIONS`: Maximum number of submissions allowed within the time window (currently 5).
   - `WINDOW_MS`: Time window in milliseconds (currently 1 hour or 3,600,000ms).

3. **Key Functions**:
   - `checkRateLimit(ip)`: Determines if a request from a given IP should be allowed.
   - `getRemainingSubmissions(ip)`: Returns the number of submissions remaining for an IP.
   - `getTimeUntilReset(ip)`: Calculates the time until the rate limit resets.

### API Integration

The contact form API (`/api/contact`) integrates the rate limiter by:

1. Getting the IP address from the request.
2. Checking if the rate limit has been exceeded.
3. If exceeded, returning an error with information about when the limit resets.
4. If not exceeded, processing the submission and returning the number of remaining submissions.

### Client-Side Integration

The contact form composable (`useContactUs.ts`) and component (`Contact.vue`) handle rate limiting by:

1. Tracking rate limit information in a reactive object.
2. Displaying warnings when submissions are getting low.
3. Disabling the form when the rate limit is exceeded.
4. Showing appropriate error messages with reset time information.

## User Experience

- Users receive clear feedback when approaching or exceeding rate limits.
- The system provides estimated time until they can submit again when limits are exceeded.
- Legitimate users are not significantly impacted, while protection against spam is maintained.

## Future Improvements

Potential enhancements to the rate limiting system:

1. Implement a more sophisticated rate limiting algorithm (e.g., token bucket).
2. Add IP address whitelisting for trusted sources.
3. Integrate with a CAPTCHA service for additional verification.
4. Implement a persistent storage solution for rate limit data to survive server restarts.
5. Add monitoring and alerting for abnormal submission patterns.
