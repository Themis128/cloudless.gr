# Contact Form Database Storage

This document explains how contact form submissions are stored in the database.

## Database Setup

The project uses SQLite with Prisma ORM to store contact form submissions. Here's an overview of how it works:

1. **Schema Definition**: The database schema is defined in `prisma/schema.prisma`
2. **Database Location**: The SQLite database file is stored in `data/cloudless.db`
3. **Model Structure**: The `ContactSubmission` model stores all form data

## Database Model

The `ContactSubmission` model includes the following fields:

```prisma
model ContactSubmission {
  id        Int      @id @default(autoincrement())
  name      String
  email     String
  subject   String
  message   String
  createdAt DateTime @default(now())
  status    String   @default("new") // "new", "read", "replied", "archived"
  notes     String?
  metadata  String?  // Stores submission details as JSON string
}
```

### Metadata Field

The `metadata` field stores additional information about each submission in JSON format:

```json
{
  "ip": "123.45.67.89",
  "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
  "referrer": "https://cloudless.gr/about",
  "submissionTime": "2025-05-22T14:30:45.123Z"
}
```

This metadata helps with:

- Identifying spam/bot submissions
- Tracking submission patterns
- Understanding user behavior
- Troubleshooting issues

## Admin Interface

An admin interface is available at `/admin/contact-submissions` where you can:

1. View all contact submissions
2. Filter submissions by status
3. Mark submissions as read/replied/archived
4. Add notes to submissions
5. View submission metadata (IP, user agent, referrer, etc.)
6. Delete submissions

The admin interface features:

- Pagination for large numbers of submissions
- Metadata display with expandable details
- Status indicators with color coding
- Sortable submission list
- Notes section for admin comments

## API Endpoints

### Submit Contact Form

- **URL**: `/api/contact`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "name": "User Name",
    "email": "user@example.com",
    "subject": "Inquiry Subject",
    "message": "User's message text...",
    "csrfToken": "token-from-csrf-token-endpoint"
  }
  ```
- **Response**:
  ```json
  {
    "status": "success" | "error",
    "message": "Response message",
    "submissionId": 123,
    "rateLimit": {
      "remaining": 4,
      "exceeded": false
    }
  }
  ```

### CSRF Token Generation

- **URL**: `/api/csrf-token`
- **Method**: `GET`
- **Response**:
  ```json
  {
    "token": "generated-csrf-token"
  }
  ```
- **Note**: The token is also set as an HTTP-only cookie named `csrf_token`

### Manage Contact Submissions

- **URL**: `/api/contact-submissions`
- **Methods**:
  - `GET`: Fetch submissions (with pagination & filtering)
  - `PATCH`: Update submission status or notes
  - `DELETE`: Delete a submission

## Security Considerations

The contact form implementation includes several security features:

1. **CSRF Protection**:

   - Uses server-generated tokens to protect against cross-site request forgery
   - Tokens are validated on submission and invalidated after use
   - Implementation in `server/utils/csrf-protection.ts`
   - Automatic token refresh for long sessions
   - Persistent token storage to survive server restarts

2. **Rate Limiting**:

   - Limits the number of submissions per IP address
   - Default limit: 5 submissions per hour
   - Implementation in `server/utils/rate-limiter.ts`
   - Visual feedback to users approaching the limit

3. **Spam Protection**:

   - Honeypot field strategy to catch automated bots
   - Submission metadata analysis for identifying patterns
   - Form design that resists automated filling

4. **Admin Interface Protection**:

   - Protected by a login page and route middleware
   - Default credentials: username `admin`, password `cloudless2025`
   - Authentication state is stored in localStorage (for demo purposes)
   - In production, use a more secure authentication system

5. **API Protection**:

   - The `/api/contact-submissions` endpoint is protected
   - Requires an `Authorization: Bearer admin-token` header
   - Implements server middleware to validate the token
   - In production, use proper JWT tokens with expiration

6. **Data Security**:
   - HTTP-only cookies for CSRF tokens
   - Secure cryptographic token generation
   - IP addresses stored for legitimate security purposes only

## Storage Approach

The implementation uses several storage strategies:

1. **Database storage**: All submissions are stored in SQLite database

   - Provides persistent storage of all form submissions
   - Allows for filtering, searching, and managing submissions
   - Data can be exported or backed up as needed
   - Metadata is stored for analysis and troubleshooting

2. **Token storage**: CSRF tokens are stored with multiple strategies

   - In-memory Map for quick validation
   - Persistent file storage to survive server restarts
   - Backup in localStorage for improved reliability

3. **Form draft storage**: User form input is preserved
   - Auto-saves form data to localStorage as user types
   - Recovers partially completed forms after page refresh
   - Cleared automatically after successful submission
   - Time-limited storage (7 days) for privacy
