# Contact Form Testing Procedures

This document outlines the testing procedures for the contact form system.

## Form Validation Testing

1. **Empty Fields Validation**

   - Try submitting the form with all fields empty
   - Verify appropriate error messages appear for required fields

2. **Email Format Validation**

   - Enter invalid email formats (e.g., "test", "test@", "test@domain")
   - Verify email-specific error message appears

3. **Field Length Validation**
   - Test with very short input
   - Test with extremely long input
   - Verify appropriate error messages

## CSRF Token Testing

1. **Token Freshness**

   - Keep the form open for more than 1 hour
   - Attempt to submit
   - Verify stale token error occurs
   - Test the "Refresh Session" button functionality

2. **Token Absence**
   - Use browser dev tools to remove the CSRF token
   - Attempt to submit the form
   - Verify appropriate error message

## Honeypot Spam Prevention Testing

1. **Simulated Bot Test**
   - Use browser dev tools to make the honeypot field visible
   - Fill in the honeypot field and submit
   - Verify the form appears to succeed but no actual submission is created

## Form Auto-Save Testing

1. **Form Data Persistence**

   - Fill out form partially
   - Verify "Saving your input..." message appears
   - Refresh the page
   - Verify form data is restored

2. **Form Data Expiration**

   - Modify localStorage to set a timestamp older than 7 days
   - Refresh the page
   - Verify form data is not restored

3. **Auto-Save Cleanup**
   - Submit a form successfully
   - Verify draft data is cleared from localStorage

## Rate Limiting Testing

1. **Rate Limit Warning**
   - Submit multiple forms in quick succession
   - Verify warning message appears when approaching limit
   - Verify submission is blocked when limit is reached

## Accessibility Testing

1. **Keyboard Navigation**

   - Tab through all form elements
   - Verify focus states and tab order are logical

2. **Screen Reader Testing**
   - Test with a screen reader (NVDA or VoiceOver)
   - Verify all form elements are properly announced
   - Verify error messages are properly announced

## Browser Compatibility

Test the form in:

- Chrome
- Firefox
- Safari (if available)
- Edge

## Automated Testing

For more thorough testing, consider creating automated tests using Cypress or similar tools.

## Test Tracking Table

| Test Case              | Expected Result               | Actual Result | Pass/Fail |
| ---------------------- | ----------------------------- | ------------- | --------- |
| Empty field submission | Error messages shown          |               |           |
| Invalid email format   | Email error message shown     |               |           |
| Stale CSRF token       | Error with refresh option     |               |           |
| Honeypot field filled  | Silent rejection              |               |           |
| Form auto-save         | Data persists after refresh   |               |           |
| Form auto-clear        | Data cleared after submission |               |           |
| Rate limit warning     | Warning shown when near limit |               |           |
| Form accessibility     | All elements accessible       |               |           |
