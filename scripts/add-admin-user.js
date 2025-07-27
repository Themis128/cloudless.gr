const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')

async function addAdminUser() {
  const prisma = new PrismaClient()

  try {
    const email = 'baltzakis.themis@gmail.com'
    const password = 'TH!123789th!'
    const name = 'Themis Baltzakis'

    console.log('🔐 Adding admin user to database...')
    console.log('Email:', email)
    console.log('Name:', name)

    console.log('🔐 Hashing password...')
    const hashedPassword = await bcrypt.hash(password, 10)

    console.log('📝 Checking if user already exists...')
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    })

    if (existingUser) {
      console.log('⚠️  User already exists. Updating password and role...')
      await prisma.user.update({
        where: { email: email },
        data: {
          password: hashedPassword,
          role: 'admin',
          isActive: true,
          isVerified: true,
          name: name,
        },
      })
      console.log('✅ Admin user updated successfully!')
    } else {
      console.log('📝 Creating new admin user...')
      await prisma.user.create({
        data: {
          email: email,
          password: hashedPassword,
          name: name,
          role: 'admin',
          isActive: true,
          isVerified: true,
        },
      })
      console.log('✅ Admin user created successfully!')
    }

    console.log('📋 User details:')
    console.log('   Email:', email)
    console.log('   Name:', name)
    console.log('   Role: admin')
    console.log('   Status: active & verified')

    console.log('🎉 Admin user added successfully!')
    console.log('You can now login with:')
    console.log('   Email:', email)
    console.log('   Password:', password)
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

addAdminUser()
