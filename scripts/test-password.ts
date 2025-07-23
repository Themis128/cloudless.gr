import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPassword() {
  try {
    // Get the admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    })

    if (!adminUser) {
      console.log('❌ No admin user found')
      return
    }

    console.log('🔍 Testing password for:', adminUser.email)
    console.log('Stored hash:', adminUser.password)
    
    // Test the password we think it should be
    const testPassword = 'admin123'
    const isValid = await bcrypt.compare(testPassword, adminUser.password)
    
    console.log('Password "admin123" is valid:', isValid)
    
    // Try some other common passwords
    const commonPasswords = ['admin', 'password', '123456', 'admin@cloudless.gr']
    
    for (const password of commonPasswords) {
      const isValid = await bcrypt.compare(password, adminUser.password)
      console.log(`Password "${password}" is valid:`, isValid)
    }
    
    // Create a new hash with the expected password
    const newHash = await bcrypt.hash('admin123', 10)
    console.log('New hash for "admin123":', newHash)
    
    // Test the new hash
    const newHashValid = await bcrypt.compare('admin123', newHash)
    console.log('New hash is valid:', newHashValid)

  } catch (error) {
    console.error('❌ Error testing password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPassword() 