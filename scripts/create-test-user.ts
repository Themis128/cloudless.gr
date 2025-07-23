import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@cloudless.gr' }
    })

    if (existingUser) {
      console.log('Test user already exists:', existingUser.email)
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12)

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'admin@cloudless.gr',
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin',
        isActive: true,
        isVerified: true
      }
    })

    console.log('Test user created successfully:', {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status
    })

    console.log('Login credentials:')
    console.log('Email: admin@cloudless.gr')
    console.log('Password: admin123')

  } catch (error) {
    console.error('Error creating test user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser() 