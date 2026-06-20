import { Logger } from "@aws-lambda-powertools/logger";
import type { LogLevel } from "@aws-lambda-powertools/logger/types";

/**
 * Structured JSON logger (AWS Lambda Powertools).
 * In production (Lambda), outputs structured JSON with request context.
 * Locally, outputs human-readable JSON lines.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Order processed", { orderId, amount });
 *   logger.error("Stripe webhook failed", { error: err.message });
 */
export const logger = new Logger({
  serviceName: "cloudless",
  logLevel: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
});
