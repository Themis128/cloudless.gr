import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import { getCookie } from 'h3'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'

export interface AdminPayload {
  id: string
  email: string
  role: string
  iat: number
  exp: number
}

export function verifyAdminToken(token: string): AdminPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload
    return decoded
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

export function getAdminFromEvent(event: H3Event): AdminPayload | null {
  const token = getCookie(event, 'admin-token')
  
  if (!token) {
    return null
  }
  
  return verifyAdminToken(token)
}

export function isAdminAuthenticated(event: H3Event): boolean {
  const admin = getAdminFromEvent(event)
  return admin !== null && admin.role === 'admin'
}
