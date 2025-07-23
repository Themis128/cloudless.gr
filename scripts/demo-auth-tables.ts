import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function demoAuthTables() {
  try {
    console.log('🔐 Authentication Tables Demo\n')

    // 1. Check User table with new fields
    console.log('1. 📋 User Table (Enhanced):')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        loginAttempts: true,
        lockedUntil: true,
        createdAt: true
      }
    })
    
    users.forEach(user => {
      console.log(`   - ${user.name} (${user.email})`)
      console.log(`     Role: ${user.role}, Active: ${user.isActive}, Verified: ${user.isVerified}`)
      console.log(`     Login Attempts: ${user.loginAttempts}, Last Login: ${user.lastLogin || 'Never'}`)
    })

    // 2. Create a session for the admin user
    console.log('\n2. 🔑 Session Management:')
    const adminUser = await prisma.user.findFirst({ where: { role: 'admin' } })
    
    if (adminUser) {
      const session = await prisma.session.create({
        data: {
          userId: adminUser.id,
          token: 'demo-session-token-123',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          ipAddress: '192.168.0.23',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      console.log(`   ✅ Created session for ${adminUser.email}`)
      console.log(`   Session ID: ${session.id}`)
      console.log(`   Expires: ${session.expiresAt}`)
    }

    // 3. Add login history
    console.log('\n3. 📊 Login History:')
    if (adminUser) {
      await prisma.loginHistory.createMany({
        data: [
          {
            userId: adminUser.id,
            ipAddress: '192.168.0.23',
            userAgent: 'Chrome/120.0.0.0',
            success: true
          },
          {
            userId: adminUser.id,
            ipAddress: '192.168.0.23',
            userAgent: 'Firefox/119.0.0.0',
            success: false
          }
        ]
      })
      
      const loginHistory = await prisma.loginHistory.findMany({
        where: { userId: adminUser.id },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
      
      loginHistory.forEach(login => {
        console.log(`   ${login.success ? '✅' : '❌'} ${login.ipAddress} - ${login.userAgent}`)
      })
    }

    // 4. Create password reset token
    console.log('\n4. 🔄 Password Reset Token:')
    if (adminUser) {
      const resetToken = await prisma.passwordResetToken.create({
        data: {
          userId: adminUser.id,
          token: 'reset-token-demo-123',
          expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        }
      })
      
      console.log(`   ✅ Created reset token for ${adminUser.email}`)
      console.log(`   Token: ${resetToken.token}`)
      console.log(`   Expires: ${resetToken.expiresAt}`)
    }

    // 5. Create email verification token
    console.log('\n5. ✉️ Email Verification Token:')
    if (adminUser) {
      const verifyToken = await prisma.emailVerificationToken.create({
        data: {
          userId: adminUser.id,
          token: 'verify-token-demo-123',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      })
      
      console.log(`   ✅ Created verification token for ${adminUser.email}`)
      console.log(`   Token: ${verifyToken.token}`)
      console.log(`   Expires: ${verifyToken.expiresAt}`)
    }

    // 6. Rate limiting
    console.log('\n6. 🚦 Rate Limiting:')
    const rateLimit = await prisma.rateLimit.create({
      data: {
        key: '192.168.0.23',
        type: 'login',
        count: 3,
        windowStart: new Date(),
        windowEnd: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
      }
    })
    
    console.log(`   ✅ Created rate limit for IP: ${rateLimit.key}`)
    console.log(`   Type: ${rateLimit.type}, Count: ${rateLimit.count}`)

    // 7. Show all tables summary
    console.log('\n7. 📈 Database Summary:')
    const userCount = await prisma.user.count()
    const sessionCount = await prisma.session.count()
    const loginHistoryCount = await prisma.loginHistory.count()
    const resetTokenCount = await prisma.passwordResetToken.count()
    const verifyTokenCount = await prisma.emailVerificationToken.count()
    const rateLimitCount = await prisma.rateLimit.count()
    
    console.log(`   Users: ${userCount}`)
    console.log(`   Active Sessions: ${sessionCount}`)
    console.log(`   Login History Records: ${loginHistoryCount}`)
    console.log(`   Password Reset Tokens: ${resetTokenCount}`)
    console.log(`   Email Verification Tokens: ${verifyTokenCount}`)
    console.log(`   Rate Limit Records: ${rateLimitCount}`)

  } catch (error) {
    console.error('❌ Error in demo:', error)
  } finally {
    await prisma.$disconnect()
  }
}

demoAuthTables() 