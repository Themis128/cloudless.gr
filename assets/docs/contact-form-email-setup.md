# Contact Form Email Notifications

This document explains how to set up the email notification system for contact form submissions.

## Configuration

The email configuration is stored in `server/config/email.ts`. You need to update this file with your SMTP server details.

For security reasons, it's recommended to use environment variables for sensitive information rather than hardcoding values in the configuration file. You can create a `.env` file at the root of your project with the following variables:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_SENDER=contact@cloudless.gr
EMAIL_RECIPIENT=your-email@example.com
```

### Setting Up with Gmail

If you're using Gmail as your SMTP server, use these settings:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
```

**Important Note for Gmail Users**: You need to set up an "App Password" in your Google Account settings, as Google blocks "less secure apps" from using your regular password.

1. Go to your Google Account settings
2. Navigate to Security > App passwords
3. Generate a new app password specifically for this application
4. Use this generated password in your `.env` file

### Setting Up with Other Email Providers

For other email providers:

- **Outlook/Office 365**: `smtp.office365.com`, port 587
- **Yahoo**: `smtp.mail.yahoo.com`, port 587
- **Zoho**: `smtp.zoho.com`, port 587

## Testing Email Functionality

To test if your email configuration is working:

1. Set up your SMTP settings in the `.env` file
2. Submit the contact form on your website
3. Check your recipient email for the submission
4. Check the server logs for any errors if emails are not being received

## Troubleshooting

If emails are not being sent:

1. Verify your SMTP credentials are correct
2. Check if your email provider requires specific security settings
3. Look for error messages in the server logs
4. Some email providers may block outgoing SMTP attempts from new IPs
5. Your hosting provider might block outgoing SMTP connections

## Email Template

The email HTML template is defined in the `server/api/contact.ts` file. You can modify the `emailContent` variable to change the format and style of the emails you receive.
