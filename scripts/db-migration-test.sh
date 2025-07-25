#!/bin/bash
# db-migration-test.sh
# A script to test and troubleshoot Prisma database migrations

# Print commands and their arguments as they are executed
set -x

# Stop execution if a command fails
set -e

echo "=== Testing Prisma database migration ==="

# 1. Check file permissions
echo "Checking file permissions on Prisma schema and migration files..."
ls -la ./prisma/

# 2. Make sure environment variable is set
echo "DATABASE_URL=\"file:../data/cloudless.db\"" > .env
echo "Environment variable set in .env file"

# 3. Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# 4. Apply existing migrations or create initial one if needed
echo "Applying migrations..."
if [ -d "./prisma/migrations" ] && [ "$(ls -A ./prisma/migrations)" ]; then
  echo "Migrations exist, applying them..."
  npx prisma migrate deploy
else
  echo "No migrations found, creating initial migration..."
  npx prisma migrate dev --name initial_migration
fi

# 5. Run tests to confirm contact form can save to updated schema
echo "Running basic database test..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testContactSubmission() {
  try {
    // Try to create a contact submission with metadata
    const submission = await prisma.contactSubmission.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Message',
        metadata: JSON.stringify({
          ip: '127.0.0.1',
          userAgent: 'test',
          referrer: 'test',
          submissionTime: new Date().toISOString()
        })
      }
    });
    
    console.log('Successfully created contact submission with metadata:', submission.id);
    
    // Retrieve the submission to verify it worked
    const retrieved = await prisma.contactSubmission.findUnique({
      where: { id: submission.id }
    });
    
    console.log('Retrieved metadata:', retrieved.metadata);
    
    // Clean up test data
    await prisma.contactSubmission.delete({
      where: { id: submission.id }
    });
    
    console.log('Test successful!');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testContactSubmission();
"

echo "=== Database migration test completed successfully ==="
