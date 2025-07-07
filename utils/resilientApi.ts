/**
 * Utility for making resilient Supabase calls with retry logic and timeout handling
 */

interface RetryOptions {
  maxRetries?: number
  timeout?: number
  backoffFactor?: number
  onRetry?: (attempt: number, error: Error) => void
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    timeout = 10000,
    backoffFactor = 2,
    onRetry
  } = options

  let lastError: Error = new Error('Unknown error')

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      })

      // Race the operation against the timeout
      const result = await Promise.race([operation(), timeoutPromise])
      
      // If we get here, the operation succeeded
      return result
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Log the error
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, lastError)
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError)
      }
      
      // If this was the last attempt, give up
      if (attempt === maxRetries) {
        break
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(backoffFactor, attempt - 1) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  // If we get here, all attempts failed
  throw lastError
}

/**
 * Wrapper for Supabase operations with built-in retry and error handling
 */
export async function resilientSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>,
  operationName: string = 'Supabase operation'
): Promise<T | null> {
  try {
    const result = await withRetry(operation, {
      maxRetries: 3,
      timeout: 15000,
      onRetry: (attempt, error) => {
        console.warn(`🔄 Retrying ${operationName} (attempt ${attempt}):`, error.message)
      }
    })
    
    if (result.error) {
      console.error(`❌ ${operationName} failed:`, result.error)
      throw result.error
    }
    
    return result.data
  } catch (error) {
    console.error(`❌ ${operationName} failed after retries:`, error)
    return null
  }
}
