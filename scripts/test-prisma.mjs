// This is a test script to verify Prisma initialization
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Attempting to initialize Prisma client...');

  try {
    // Test connection by getting a count
    const count = await prisma.contactSubmission.count();
    console.log(`Successfully connected to database. ContactSubmission count: ${count}`);
  } catch (error) {
    console.error('Error connecting to database:', error);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
