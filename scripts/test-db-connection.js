import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Database connection successful')
    
    // Test table access
    const userCount = await prisma.user.count()
    console.log(`✅ Users table accessible: ${userCount} users`)
    
    const projectCount = await prisma.project.count()
    console.log(`✅ Projects table accessible: ${projectCount} projects`)
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection() 