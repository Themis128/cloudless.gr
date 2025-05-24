import { defineEventHandler, getCookie, getRequestIP, readBody } from 'h3';
import { invalidateToken, validateCsrfToken } from '../utils/csrf-protection';
import prisma from '../utils/prisma';
import { checkRateLimit, getRemainingSubmissions, getTimeUntilReset } from '../utils/rate-limiter';

/**
 * API endpoint to handle contact form submissions
 * This implementation validates the form data and stores it in the database
 * Includes rate limiting to prevent spam submissions
 * Implements CSRF protection
 */
export default defineEventHandler(async (event) => {
  try {
    // Add a slight delay to slow down automated submissions
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Validate CSRF token
    const csrfToken = getCookie(event, 'csrf_token') || '';
    const requestBody = await readBody(event);

    // Check for honeypot field - if it's filled, it's likely a bot
    if (requestBody.website) {
      console.log('Spam submission detected (honeypot field filled)');

      // Return success to avoid tipping off the bot
      return {
        status: 'success',
        message: 'Your message has been sent successfully',
        submissionId: Math.floor(Math.random() * 1000) + 1000,
      };
    }

    // Log the tokens to help with debugging
    console.log('CSRF token from cookie:', csrfToken);
    console.log('CSRF token from request body:', requestBody.csrfToken); // In development mode, be more lenient with CSRF validation
    if (process.env.NODE_ENV !== 'production') {
      // Only check if any token exists
      if (!csrfToken && !requestBody.csrfToken) {
        console.log('CSRF token missing in development mode');
        return {
          status: 'error',
          message: 'CSRF token is required. Please refresh the page and try again.',
        };
      }
    } else {
      // In production, do strict validation
      if (!validateCsrfToken(csrfToken)) {
        console.log('CSRF token validation failed - invalid or expired token');
        return {
          status: 'error',
          message:
            'Your session has expired or is invalid. Please click the "Refresh Session" button below and try again.',
          errorCode: 'CSRF_VALIDATION_FAILED',
        };
      }
    }

    // Invalidate the token after use to prevent replay attacks
    invalidateToken(csrfToken);

    // Get IP address for rate limiting
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';

    // Check rate limit
    if (!checkRateLimit(ip)) {
      const resetTimeMs = getTimeUntilReset(ip);
      const resetTimeMinutes = Math.ceil(resetTimeMs / 60000);

      return {
        status: 'error',
        message: `Rate limit exceeded. Please try again in ${resetTimeMinutes} minute${resetTimeMinutes === 1 ? '' : 's'}.`,
        rateLimit: {
          exceeded: true,
          resetTime: resetTimeMs,
        },
      };
    }

    // Extract form data from the request body
    const body = requestBody;

    // Basic validation
    if (!body.name || !body.email || !body.subject || !body.message) {
      return {
        status: 'error',
        message: 'All fields are required',
      };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return {
        status: 'error',
        message: 'Please provide a valid email address',
      };
    } // Store the submission in the database
    const submission = await prisma.contactSubmission.create({
      data: {
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        metadata: JSON.stringify({
          ip: ip,
          userAgent: event.node.req.headers['user-agent'] || 'unknown',
          referrer: event.node.req.headers['referer'] || 'direct',
          submissionTime: new Date().toISOString(),
        }),
      },
    });

    // Log the submission
    console.log('Contact form submission received:', {
      id: submission.id,
      name: body.name,
      email: body.email,
      subject: body.subject,
    }); // Return success response
    return {
      status: 'success',
      message: 'Your message has been sent successfully',
      submissionId: submission.id,
      rateLimit: {
        remaining: getRemainingSubmissions(ip),
      },
    };
  } catch (error) {
    console.error('Contact form submission error:', error);

    // Return error response
    return {
      status: 'error',
      message: 'An error occurred while processing your request',
    };
  }
});
