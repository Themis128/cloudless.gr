/**
 * Simple rate limiter for contact form submissions
 * Prevents excessive submissions from the same IP address
 */

// Map to store IP addresses and their submission timestamps
const ipSubmissions = new Map<string, number[]>();

// Configuration
const MAX_SUBMISSIONS = 5; // Maximum submissions allowed
const WINDOW_MS = 3600000; // Time window in milliseconds (1 hour)

/**
 * Check if an IP address has exceeded the rate limit
 * @param ip The IP address to check
 * @returns Boolean indicating if the request should be allowed
 */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();

  // Get submission timestamps for this IP or initialize empty array
  let submissions = ipSubmissions.get(ip) || [];

  // Filter out submissions older than the time window
  submissions = submissions.filter((timestamp) => now - timestamp < WINDOW_MS);

  // Check if we've reached the submission limit
  if (submissions.length >= MAX_SUBMISSIONS) {
    return false; // Rate limit exceeded
  }

  // Add current timestamp to submissions
  submissions.push(now);

  // Update map with new submissions array
  ipSubmissions.set(ip, submissions);

  return true; // Request allowed
}

/**
 * Get remaining submission quota for an IP address
 * @param ip The IP address to check
 * @returns Number of remaining submissions allowed
 */
export function getRemainingSubmissions(ip: string): number {
  const now = Date.now();
  const submissions = ipSubmissions.get(ip) || [];

  // Count only submissions within the time window
  const recentSubmissions = submissions.filter((timestamp) => now - timestamp < WINDOW_MS);

  return Math.max(0, MAX_SUBMISSIONS - recentSubmissions.length);
}

/**
 * Get time until rate limit resets for an IP address
 * @param ip The IP address to check
 * @returns Time in milliseconds until next submission will be allowed
 */
export function getTimeUntilReset(ip: string): number {
  const now = Date.now();
  const submissions = ipSubmissions.get(ip) || [];

  if (submissions.length === 0) {
    return 0; // No recent submissions
  }

  // Get oldest submission in the window
  const oldestSubmission = Math.min(...submissions);

  // Calculate reset time
  return Math.max(0, oldestSubmission + WINDOW_MS - now);
}
