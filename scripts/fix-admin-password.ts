import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixAdminPassword() {
  try {
    // Find the admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' }
    })

    if (!adminUser) {
      console.log('❌ No admin user found')
      return
    }

    console.log('🔧 Fixing password for:', adminUser.email)
    
    // Create a proper hash for the password 'admin123'
    const newPasswordHash = await bcrypt.hash('admin123', 10)
    
    // Update the user's password
    const updatedUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: { password: newPasswordHash }
    })
    
    console.log('✅ Password updated successfully!')
    console.log('New hash:', newPasswordHash)
    
    // Verify the password works
    const isValid = await bcrypt.compare('admin123', newPasswordHash)
    console.log('Password verification test:', isValid ? '✅ PASSED' : '❌ FAILED')
    
    console.log('\n📋 Admin credentials:')
    console.log('Email: admin@cloudless.gr')
    console.log('Password: admin123')

  } catch (error) {
    console.error('❌ Error fixing password:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixAdminPassword() 