import { PrismaClient } from '@prisma/client';

// Add global declaration for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * PrismaClient is attached to the `global` object in development to prevent
 * exhausting your database connection limit.
 *
 * Learn more:
 * https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/instantiate-prisma-client
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

// Create a singleton instance of the PrismaClient
// This ensures we don't exhaust database connections by creating multiple clients
const prisma = globalThis.__prisma ?? prismaClientSingleton();

// If we're not in production, attach to the global object for reuse
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Register a handler for graceful shutdown
if (process.env.NODE_ENV === 'production') {
  const handleShutdown = async () => {
    console.log('Closing Prisma client connection...');
    await prisma.$disconnect();
    process.exit(0);
  };

  // Register shutdown handlers
  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);
}

export default prisma;
