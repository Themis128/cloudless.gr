const { PrismaClient } = require('@prisma/client')

async function verifyAdminUser() {
  const prisma = new PrismaClient()

  try {
    const email = 'baltzakis.themis@gmail.com'

    console.log('🔍 Verifying admin user...')
    console.log('Email:', email)

    const user = await prisma.user.findUnique({
      where: { email: email },
    })

    if (!user) {
      console.log('❌ User not found!')
      return
    }

    console.log('✅ User found!')
    console.log('📋 User details:')
    console.log('   ID:', user.id)
    console.log('   Email:', user.email)
    console.log('   Name:', user.name)
    console.log('   Role:', user.role)
    console.log('   Active:', user.isActive)
    console.log('   Verified:', user.isVerified)
    console.log('   Created:', user.createdAt)
    console.log('   Updated:', user.updatedAt)

    if (user.role === 'admin' && user.isActive && user.isVerified) {
      console.log('🎉 Admin user is properly configured!')
    } else {
      console.log('⚠️  User exists but may not have full admin privileges')
    }
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyAdminUser()
