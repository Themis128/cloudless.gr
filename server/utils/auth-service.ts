import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import jwt from 'jsonwebtoken'
import { getPrismaClient } from './prisma'
const JWT_SECRET =
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface User {
  id: string
  email: string
  role: 'admin' | 'user'
}

export interface AuthResult {
  success: boolean
  user?: User
  token?: string
  error?: string
  sessionId?: string
}

export interface LoginAttempt {
  userId: number
  ipAddress?: string
  userAgent?: string
  success: boolean
}

export class AuthService {
  // Login with enhanced security
  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      console.log('Auth service login attempt:', {
        email,
        hasPassword: !!password,
      })

      const prisma = getPrismaClient()

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      })

      console.log('User found:', !!user)

      if (!user) {
        await this.recordLoginAttempt({
          userId: 0,
          ipAddress,
          userAgent,
          success: false,
        })
        return { success: false, error: 'Invalid credentials' }
      }

      // Check if account is active
      if (!user.isActive) {
        await this.recordLoginAttempt({
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
        })
        return { success: false, error: 'Account is deactivated' }
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        await this.recordLoginAttempt({
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
        })
        return {
          success: false,
          error: `Account is locked until ${user.lockedUntil.toLocaleString()}`,
        }
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password)

      if (!validPassword) {
        await this.handleFailedLogin(user, ipAddress, userAgent)
        return { success: false, error: 'Invalid credentials' }
      }

      // Check if email is verified (optional for admin users, bypass in development)
      if (
        !user.isVerified &&
        user.role !== 'admin' &&
        process.env.NODE_ENV === 'production'
      ) {
        await this.recordLoginAttempt({
          userId: user.id,
          ipAddress,
          userAgent,
          success: false,
        })
        return {
          success: false,
          error: 'Please verify your email before logging in',
        }
      }

      // Successful login
      await this.handleSuccessfulLogin(user, ipAddress, userAgent)

      // Generate JWT token
      const token = this.generateToken({
        id: user.id.toString(),
        email: user.email,
        role: user.role as 'admin' | 'user',
      })

      // Create session
      const session = await this.createSession(
        user.id,
        token,
        ipAddress,
        userAgent
      )

      return {
        success: true,
        user: {
          id: user.id.toString(),
          email: user.email,
          role: user.role as 'admin' | 'user',
        },
        token,
        sessionId: session.id,
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'An error occurred during login' }
    }
  }

  // Register new user
  async register(
    email: string,
    password: string,
    name: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    try {
      const prisma = getPrismaClient()
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'user',
          isActive: true,
          isVerified: false,
        },
      })

      // Create email verification token
      await this.createEmailVerificationToken(user.id)

      // Record successful registration
      await this.recordLoginAttempt({
        userId: user.id,
        ipAddress,
        userAgent,
        success: true,
      })

      // Generate JWT token
      const token = this.generateToken({
        id: user.id.toString(),
        email: user.email,
        role: user.role as 'admin' | 'user',
      })

      // Create session
      const session = await this.createSession(
        user.id,
        token,
        ipAddress,
        userAgent
      )

      return {
        success: true,
        user: {
          id: user.id.toString(),
          email: user.email,
          role: user.role as 'admin' | 'user',
        },
        token,
        sessionId: session.id,
      }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: 'An error occurred during registration' }
    }
  }

  // Verify JWT token
  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as User

      const prisma = getPrismaClient()

      // Check if session exists and is active
      const session = await prisma.session.findFirst({
        where: {
          token,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      })

      if (!session) {
        return null
      }

      // Check if user is still active
      const user = await prisma.user.findUnique({
        where: { id: parseInt(decoded.id) },
      })

      if (!user || !user.isActive) {
        return null
      }

      return decoded
    } catch (error) {
      return null
    }
  }

  // Logout user
  async logout(token: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient()
      await prisma.session.updateMany({
        where: { token },
        data: { isActive: false },
      })
      return true
    } catch (error) {
      console.error('Logout error:', error)
      return false
    }
  }

  // Create password reset token
  async createPasswordResetToken(email: string): Promise<string | null> {
    try {
      const prisma = getPrismaClient()
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user) {
        return null
      }

      // Delete existing unused tokens
      await prisma.passwordResetToken.deleteMany({
        where: {
          userId: user.id,
          used: false,
        },
      })

      // Create new token
      const token = randomBytes(32).toString('hex')
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
        },
      })

      return token
    } catch (error) {
      console.error('Create password reset token error:', error)
      return null
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient()
      const resetToken = await prisma.passwordResetToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() },
        },
      })

      if (!resetToken) {
        return false
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10)

      // Update user password
      await prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      })

      // Mark token as used
      await prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      })

      // Invalidate all sessions for this user
      await prisma.session.updateMany({
        where: { userId: resetToken.userId },
        data: { isActive: false },
      })

      return true
    } catch (error) {
      console.error('Reset password error:', error)
      return false
    }
  }

  // Create email verification token
  async createEmailVerificationToken(userId: number): Promise<string> {
    const prisma = getPrismaClient()
    const token = randomBytes(32).toString('hex')

    await prisma.emailVerificationToken.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    })

    return token
  }

  // Verify email
  async verifyEmail(token: string): Promise<boolean> {
    try {
      const prisma = getPrismaClient()
      const verifyToken = await prisma.emailVerificationToken.findFirst({
        where: {
          token,
          used: false,
          expiresAt: { gt: new Date() },
        },
      })

      if (!verifyToken) {
        return false
      }

      // Update user verification status
      await prisma.user.update({
        where: { id: verifyToken.userId },
        data: { isVerified: true },
      })

      // Mark token as used
      await prisma.emailVerificationToken.update({
        where: { id: verifyToken.id },
        data: { used: true },
      })

      return true
    } catch (error) {
      console.error('Verify email error:', error)
      return false
    }
  }

  // Rate limiting
  async checkRateLimit(
    key: string,
    type: string,
    limit: number,
    windowMinutes: number
  ): Promise<boolean> {
    try {
      const prisma = getPrismaClient()
      // Skip rate limiting in development and testing
      if (process.env.NODE_ENV !== 'production') {
        return true
      }

      const now = new Date()
      const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000)

      // Clean up old rate limit records
      await prisma.rateLimit.deleteMany({
        where: {
          windowEnd: { lt: now },
        },
      })

      // Find existing rate limit record
      const rateLimit = await prisma.rateLimit.findUnique({
        where: { key },
      })

      if (!rateLimit) {
        // Create new rate limit record
        await prisma.rateLimit.create({
          data: {
            key,
            type,
            count: 1,
            windowStart,
            windowEnd: new Date(now.getTime() + windowMinutes * 60 * 1000),
          },
        })
        return true
      }

      if (rateLimit.count >= limit) {
        return false // Rate limit exceeded
      }

      // Increment count
      await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: { count: rateLimit.count + 1 },
      })

      return true
    } catch (error) {
      console.error('Rate limit check error:', error)
      return true // Allow if error
    }
  }

  // Private methods
  private generateToken(user: User): string {
    return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' })
  }

  private async createSession(
    userId: number,
    token: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const prisma = getPrismaClient()
    return await prisma.session.create({
      data: {
        userId,
        token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        ipAddress,
        userAgent,
        isActive: true,
      },
    })
  }

  private async recordLoginAttempt(attempt: LoginAttempt) {
    const prisma = getPrismaClient()
    if (attempt.userId === 0) {
      // Anonymous attempt (user not found)
      return
    }

    await prisma.loginHistory.create({
      data: {
        userId: attempt.userId,
        ipAddress: attempt.ipAddress,
        userAgent: attempt.userAgent,
        success: attempt.success,
      },
    })
  }

  private async handleFailedLogin(
    user: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    const prisma = getPrismaClient()
    // Record failed attempt
    await this.recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      success: false,
    })

    // Increment login attempts
    const newAttempts = user.loginAttempts + 1
    const updateData: any = { loginAttempts: newAttempts }

    // Lock account after 5 failed attempts for 15 minutes
    if (newAttempts >= 5) {
      updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })
  }

  private async handleSuccessfulLogin(
    user: any,
    ipAddress?: string,
    userAgent?: string
  ) {
    const prisma = getPrismaClient()
    // Record successful attempt
    await this.recordLoginAttempt({
      userId: user.id,
      ipAddress,
      userAgent,
      success: true,
    })

    // Reset login attempts and unlock account
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date(),
      },
    })
  }
}

export const authService = new AuthService()
