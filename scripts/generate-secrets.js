#!/usr/bin/env node

// Script to generate secure JWT secret
import crypto from 'crypto'

function generateJWTSecret() {
  // Generate a secure 64-byte random string
  const secret = crypto.randomBytes(64).toString('hex')
  return secret
}

function generateMultipleSecrets() {
  console.log('🔐 Generated JWT Secrets:\n')
  
  console.log('1. Primary JWT Secret (64 bytes):')
  console.log(`JWT_SECRET=${generateJWTSecret()}\n`)
  
  console.log('2. Refresh Token Secret (64 bytes):')
  console.log(`JWT_REFRESH_SECRET=${generateJWTSecret()}\n`)
  
  console.log('3. API Secret Key (32 bytes):')
  console.log(`API_SECRET_KEY=${crypto.randomBytes(32).toString('hex')}\n`)
  
  console.log('4. Session Secret (32 bytes):')
  console.log(`SESSION_SECRET=${crypto.randomBytes(32).toString('hex')}\n`)
  
  console.log('📝 Copy these to your .env file')
  console.log('⚠️  Keep these secrets secure and never commit them to version control!')
}

// Run the function immediately
generateMultipleSecrets()

export { generateJWTSecret, generateMultipleSecrets }
