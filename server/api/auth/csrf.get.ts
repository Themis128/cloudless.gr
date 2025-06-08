// server/api/auth/csrf.get.ts

import { setCookie } from 'h3'
import crypto from 'crypto'

export default defineEventHandler(async (event) => {
  const token = crypto.randomBytes(32).toString('hex')

  setCookie(event, 'csrf-token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300
  })

  return { csrfToken: token }
})
