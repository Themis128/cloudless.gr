import { PrismaClient } from '@prisma/client';

// Use a module-scoped variable to ensure a singleton instance per server process
let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

export default getPrismaClient();
