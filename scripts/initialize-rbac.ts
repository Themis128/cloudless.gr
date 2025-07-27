import { PrismaClient } from '@prisma/client'
import { authService } from '../server/utils/auth-service'
import { rbacService } from '../server/utils/rbac-service'

const prisma = new PrismaClient()

async function initializeRBAC() {
  try {
    console.log('🚀 Initializing RBAC system...')

    // Initialize default roles and permissions
    await rbacService.initializeDefaultRBAC()

    // Find admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@cloudless.gr' },
    })

    if (adminUser) {
      // Find admin role
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
      })

      if (adminRole) {
        // Assign admin role to admin user
        await rbacService.assignRole(adminUser.id, adminRole.id)
        console.log('✅ Admin role assigned to admin user')
      }
    }

    // Create a test user with user role
    const testUser = await prisma.user.findUnique({
      where: { email: 'test@cloudless.gr' },
    })

    if (!testUser) {
      const hashedPassword = await authService['generateToken']({
        id: '1',
        email: 'test@cloudless.gr',
        role: 'user',
      })
      const newTestUser = await prisma.user.create({
        data: {
          email: 'test@cloudless.gr',
          password: hashedPassword,
          name: 'Test User',
          role: 'user',
          isActive: true,
          isVerified: true,
        },
      })

      // Find user role
      const userRole = await prisma.role.findUnique({
        where: { name: 'user' },
      })

      if (userRole) {
        await rbacService.assignRole(newTestUser.id, userRole.id)
        console.log('✅ Test user created with user role')
      }
    }

    // Display all roles and permissions
    console.log('\n📋 Available Roles:')
    const roles = await rbacService.getAllRoles()
    roles.forEach(role => {
      console.log(`  - ${role.name}: ${role.description}`)
      if (role.permissions && role.permissions.length > 0) {
        console.log(
          `    Permissions: ${role.permissions.map(p => p.name).join(', ')}`
        )
      }
    })

    console.log('\n🔐 Available Permissions:')
    const permissions = await rbacService.getAllPermissions()
    permissions.forEach(perm => {
      console.log(`  - ${perm.name}: ${perm.description}`)
    })

    console.log('\n✅ RBAC system initialized successfully!')
  } catch (error) {
    console.error('❌ Error initializing RBAC:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the initialization
initializeRBAC()
