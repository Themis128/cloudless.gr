import { defineEventHandler, getCookie, getRequestIP, readBody } from 'h3'
import { invalidateToken, validateCsrfToken } from '../utils/csrf-protection'
import {
  createAppError,
  createValidationError,
  ErrorCodes,
  generateRequestId,
  handleApiError,
} from '../utils/errorHandler'
import { getPrismaClient } from '../utils/prisma'
import { checkRateLimit, getTimeUntilReset } from '../utils/rate-limiter'

/**
 * API endpoint to handle contact form submissions
 * This implementation validates the form data and stores it in the database
 * Includes rate limiting to prevent spam submissions
 * Implements CSRF protection
 */
export default defineEventHandler(async event => {
  // Generate request ID for tracking
  const requestId = generateRequestId()
  event.context.requestId = requestId

  try {
    // Add a slight delay to slow down automated submissions
    await new Promise(resolve => setTimeout(resolve, 500))

    // Validate CSRF token
    const csrfToken = getCookie(event, 'csrf_token') || ''
    const requestBody = await readBody(event)

    // Check for honeypot field - if it's filled, it's likely a bot
    if (requestBody.website) {
      console.log('Spam submission detected (honeypot field filled)')

      // Return success to avoid tipping off the bot
      return {
        status: 'success',
        message: 'Your message has been sent successfully',
        submissionId: Math.floor(Math.random() * 1000) + 1000,
      }
    }

    // CSRF validation
    if (process.env.NODE_ENV !== 'production') {
      // Development mode - more lenient
      if (!csrfToken && !requestBody.csrfToken) {
        throw createAppError(
          'CSRF token is required. Please refresh the page and try again.',
          ErrorCodes.VALIDATION_ERROR,
          400,
          { requestId }
        )
      }
    } else {
      // Production mode - strict validation
      if (!validateCsrfToken(csrfToken)) {
        throw createAppError(
          'Your session has expired or is invalid. Please refresh the page and try again.',
          ErrorCodes.UNAUTHORIZED,
          401,
          { requestId }
        )
      }
    }

    // Invalidate the token after use to prevent replay attacks
    invalidateToken(csrfToken)

    // Get IP address for rate limiting
    const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'

    // Check rate limit
    if (!checkRateLimit(ip)) {
      const resetTimeMs = getTimeUntilReset(ip)
      const resetTimeMinutes = Math.ceil(resetTimeMs / 60000)

      throw createAppError(
        `Rate limit exceeded. Please try again in ${resetTimeMinutes} minute${resetTimeMinutes === 1 ? '' : 's'}.`,
        ErrorCodes.RATE_LIMITED,
        429,
        {
          resetTime: resetTimeMs,
          requestId,
        }
      )
    }

    // Extract form data from the request body
    const body = requestBody

    // Enhanced validation with specific error messages
    if (!body.name?.trim()) {
      throw createValidationError('name', 'Name is required')
    }
    if (!body.email?.trim()) {
      throw createValidationError('email', 'Email is required')
    }
    if (!body.subject?.trim()) {
      throw createValidationError('subject', 'Subject is required')
    }
    if (!body.message?.trim()) {
      throw createValidationError('message', 'Message is required')
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      throw createValidationError('email', 'Please provide a valid email address')
    }

    // Store the submission in the database
    const prisma = getPrismaClient()
    const submission = await prisma.contactSubmission.create({
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        subject: body.subject.trim(),
        message: body.message.trim(),
        ipAddress: ip,
        userAgent: event.headers.get('user-agent') || 'unknown',
        source: 'contact-form',
        status: 'new',
      },
    })

    // Return success response
    return {
      success: true,
      data: {
        submissionId: submission.id,
        message: 'Your message has been sent successfully',
        timestamp: submission.createdAt,
      },
      requestId,
    }
  } catch (error) {
    // Use enhanced error handling
    return handleApiError(error, event)
  }
})
