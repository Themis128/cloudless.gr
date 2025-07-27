import { H3Error } from 'h3'

export interface ErrorDetails {
  code: string
  message: string
  details?: any
  timestamp: string
  requestId?: string
  userId?: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    requestId?: string
  }
}

export class AppError extends Error {
  public code: string
  public statusCode: number
  public details?: any
  public isOperational: boolean

  constructor(
    message: string,
    code: string = 'INTERNAL_ERROR',
    statusCode: number = 500,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export function createAppError(
  message: string,
  code: string = 'INTERNAL_ERROR',
  statusCode: number = 500,
  details?: any
): AppError {
  return new AppError(message, code, statusCode, details)
}

export function handleApiError(error: any, event?: any): ApiErrorResponse {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const requestId = event?.context?.requestId || generateRequestId()

  let errorResponse: ApiErrorResponse

  if (error instanceof AppError) {
    // Handle known application errors
    errorResponse = {
      success: false,
      error: {
        code: error.code,
        message: isDevelopment ? error.message : getSanitizedMessage(error.code),
        details: isDevelopment ? error.details : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      },
    }
  } else if (error instanceof H3Error) {
    // Handle H3 errors
    errorResponse = {
      success: false,
      error: {
        code: 'H3_ERROR',
        message: isDevelopment ? error.message : 'Request processing error',
        details: isDevelopment ? { statusCode: error.statusCode } : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      },
    }
  } else {
    // Handle unknown errors
    console.error('Unhandled error:', error)
    errorResponse = {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: isDevelopment ? error.message : 'An unexpected error occurred',
        details: isDevelopment ? { stack: error.stack } : undefined,
        timestamp: new Date().toISOString(),
        requestId,
      },
    }
  }

  // Log error for monitoring
  logError(error, requestId)

  return errorResponse
}

export function getSanitizedMessage(code: string): string {
  const sanitizedMessages: Record<string, string> = {
    VALIDATION_ERROR: 'The provided data is invalid',
    NOT_FOUND: 'The requested resource was not found',
    UNAUTHORIZED: 'You are not authorized to perform this action',
    FORBIDDEN: 'Access to this resource is forbidden',
    RATE_LIMITED: 'Too many requests. Please try again later',
    DATABASE_ERROR: 'Database operation failed',
    EXTERNAL_API_ERROR: 'External service temporarily unavailable',
    FILE_UPLOAD_ERROR: 'File upload failed',
    INTERNAL_ERROR: 'An unexpected error occurred',
    H3_ERROR: 'Request processing error',
  }

  return sanitizedMessages[code] || 'An error occurred'
}

export function logError(error: any, requestId: string) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    requestId,
    error: {
      name: error.name,
      message: error.message,
      code: error.code || 'UNKNOWN',
      stack: error.stack,
      details: error.details,
    },
    environment: process.env.NODE_ENV,
  }

  // In production, send to error monitoring service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with Sentry or other error monitoring
    console.error('Production Error:', JSON.stringify(errorLog, null, 2))
  } else {
    console.error('Development Error:', errorLog)
  }
}

export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Common error codes and messages
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  RATE_LIMITED: 'RATE_LIMITED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// Validation error helper
export function createValidationError(field: string, message: string, details?: any): AppError {
  return createAppError(
    `Validation failed for field '${field}': ${message}`,
    ErrorCodes.VALIDATION_ERROR,
    400,
    { field, ...details }
  )
}

// Not found error helper
export function createNotFoundError(resource: string, id?: string | number): AppError {
  const message = id ? `${resource} with ID ${id} not found` : `${resource} not found`
  return createAppError(message, ErrorCodes.NOT_FOUND, 404, { resource, id })
}

// Unauthorized error helper
export function createUnauthorizedError(message: string = 'Authentication required'): AppError {
  return createAppError(message, ErrorCodes.UNAUTHORIZED, 401)
}

// Database error helper
export function createDatabaseError(operation: string, details?: any): AppError {
  return createAppError(
    `Database operation '${operation}' failed`,
    ErrorCodes.DATABASE_ERROR,
    500,
    { operation, ...details }
  )
}
