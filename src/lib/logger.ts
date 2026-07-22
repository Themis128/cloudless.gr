/**
 * Simple console logger (replaces AWS Lambda Powertools).
 * In Workers, we use plain console.log/console.warn.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info("Order processed", { orderId, amount });
 *   logger.error("Stripe webhook failed", { error: err.message });
 */
export const logger = {
  info: (message: string, ...args: unknown[]) =>
    console.log(JSON.stringify({ level: "INFO", message, ...(args.length ? { data: args } : {}) })),
  warn: (message: string, ...args: unknown[]) =>
    console.warn(JSON.stringify({ level: "WARN", message, ...(args.length ? { data: args } : {}) })),
  error: (message: string, ...args: unknown[]) =>
    console.error(JSON.stringify({ level: "ERROR", message, ...(args.length ? { data: args } : {}) })),
  debug: (message: string, ...args: unknown[]) =>
    console.debug(JSON.stringify({ level: "DEBUG", message, ...(args.length ? { data: args } : {}) })),
};

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";