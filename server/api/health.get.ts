/**
 * Health Check API Endpoint
 * Provides comprehensive system health monitoring for containers and deployment
 *
 * GET /api/health - Basic health check
 * GET /api/health/detailed - Detailed system status
 * GET /api/health/readiness - Kubernetes readiness probe
 * GET /api/health/liveness - Kubernetes liveness probe
 */

import { performance } from 'perf_hooks';

// Health check status levels
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
} as const;

type HealthStatus = (typeof HealthStatus)[keyof typeof HealthStatus];

interface HealthCheck {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  version?: string;
  environment?: string;
  services?: Record<string, ServiceHealth>;
  system?: SystemHealth;
}

interface ServiceHealth {
  status: HealthStatus;
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

interface SystemHealth {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  node: {
    version: string;
    uptime: number;
  };
}

// Get system memory info
function getMemoryInfo() {
  const used = process.memoryUsage();
  return {
    used: used.heapUsed,
    total: used.heapTotal,
    percentage: Math.round((used.heapUsed / used.heapTotal) * 100),
  };
}

// Check database connectivity (if applicable)
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = performance.now();
  try {
    // Add your database connection check here
    // For now, we'll simulate a check
    await new Promise((resolve) => setTimeout(resolve, 10));

    return {
      status: HealthStatus.HEALTHY,
      responseTime: performance.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      responseTime: performance.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Check Redis connectivity (if applicable)
async function checkRedis(): Promise<ServiceHealth> {
  const startTime = performance.now();
  try {
    // Add your Redis connection check here
    // For now, we'll simulate a check
    await new Promise((resolve) => setTimeout(resolve, 5));

    return {
      status: HealthStatus.HEALTHY,
      responseTime: performance.now() - startTime,
      lastChecked: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      responseTime: performance.now() - startTime,
      lastChecked: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Basic health check
export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const pathname = url.pathname;

  // Basic health endpoint
  if (pathname === '/api/health') {
    const health: HealthCheck = {
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    setResponseStatus(event, 200);
    return health;
  }

  // Detailed health check
  if (pathname === '/api/health/detailed') {
    const [dbHealth, redisHealth] = await Promise.all([checkDatabase(), checkRedis()]);

    const services = {
      database: dbHealth,
      redis: redisHealth,
    };

    // Determine overall status
    const serviceStatuses = Object.values(services).map((s) => s.status);
    const overallStatus = serviceStatuses.includes(HealthStatus.UNHEALTHY)
      ? HealthStatus.UNHEALTHY
      : serviceStatuses.includes(HealthStatus.DEGRADED)
        ? HealthStatus.DEGRADED
        : HealthStatus.HEALTHY;

    const health: HealthCheck = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      system: {
        memory: getMemoryInfo(),
        node: {
          version: process.version,
          uptime: process.uptime(),
        },
      },
    };

    const statusCode = overallStatus === HealthStatus.HEALTHY ? 200 : 503;
    setResponseStatus(event, statusCode);
    return health;
  }

  // Kubernetes readiness probe
  if (pathname === '/api/health/readiness') {
    // Check if the application is ready to serve traffic
    const isReady = process.uptime() > 10; // App has been running for at least 10 seconds

    const health = {
      status: isReady ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      ready: isReady,
    };

    setResponseStatus(event, isReady ? 200 : 503);
    return health;
  }

  // Kubernetes liveness probe
  if (pathname === '/api/health/liveness') {
    // Check if the application is alive and should be restarted
    const memory = getMemoryInfo();
    const isAlive = memory.percentage < 95; // Not using more than 95% memory

    const health = {
      status: isAlive ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      alive: isAlive,
      memory: memory.percentage,
    };

    setResponseStatus(event, isAlive ? 200 : 503);
    return health;
  }

  // If none of the health endpoints match, return 404
  throw createError({
    statusCode: 404,
    statusMessage: 'Health endpoint not found',
  });
});
