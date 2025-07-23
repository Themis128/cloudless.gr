import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAdminUser() {
  try {
    // Find admin user
    const adminUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true, // Include password to see if it's hashed
        createdAt: true
      }
    })

    if (adminUser) {
      console.log('✅ Admin user found:')
      console.log('ID:', adminUser.id)
      console.log('Email:', adminUser.email)
      console.log('Name:', adminUser.name)
      console.log('Role:', adminUser.role)
      console.log('Password (hashed):', adminUser.password.substring(0, 20) + '...')
      console.log('Created:', adminUser.createdAt)
    } else {
      console.log('❌ No admin user found')
    }

    // Also check all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    })

    console.log('\n📋 All users in database:')
    allUsers.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`)
    })

  } catch (error) {
    console.error('❌ Error checking admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAdminUser() 