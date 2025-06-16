#!/usr/bin/env node

// Verification script to check if custom JWT keys are properly configured
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const expectedKeys = {
  JWT_SECRET: 'eOvlpJPRGfQkptMLRFSfCPerPR5MkrekkpIuLqXd',
  ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzUwMDIxMjAwLCJleHAiOjE5MDc3ODc2MDB9.t_fNs-0FseUffAlk14mKEhQEr_PF3-IlHQ0z4VK3fxQ',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NTAwMjEyMDAsImV4cCI6MTkwNzc4NzYwMH0.n7S053n5q1Ih3_cJmdyBSUuiPmemvB3ZJgvEUoVKZ6M'
}

async function verifyKeys() {
  console.log('🔐 Verifying Custom JWT Keys Configuration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Check environment variables
  const envChecks = [
    { name: 'JWT_SECRET', expected: expectedKeys.JWT_SECRET, actual: process.env.JWT_SECRET },
    { name: 'SUPABASE_ANON_KEY', expected: expectedKeys.ANON_KEY, actual: process.env.SUPABASE_ANON_KEY },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', expected: expectedKeys.SERVICE_ROLE_KEY, actual: process.env.SUPABASE_SERVICE_ROLE_KEY }
  ]

  let allCorrect = true

  console.log('\n📄 Environment Variables Check:')
  envChecks.forEach(check => {
    const isCorrect = check.actual === check.expected
    const status = isCorrect ? '✅' : '❌'
    const message = isCorrect ? 'Correct' : 'Incorrect/Missing'
    
    console.log(`   ${status} ${check.name}: ${message}`)
    if (!isCorrect) {
      console.log(`      Expected: ${check.expected.substring(0, 30)}...`)
      console.log(`      Actual:   ${(check.actual || 'undefined').substring(0, 30)}...`)
      allCorrect = false
    }
  })

  // Test Supabase connection if keys are correct
  if (allCorrect && process.env.SUPABASE_URL) {
    console.log('\n🔌 Testing Supabase Connection:')
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })

      // Test service role key
      const { data, error } = await supabase.auth.admin.listUsers()
      if (error) {
        console.log('   ❌ Service role key test failed:', error.message)
      } else {
        console.log('   ✅ Service role key working')
        console.log(`   👥 Found ${data.users.length} users in database`)
      }

    } catch (error) {
      console.log('   ❌ Connection test failed:', error.message)
    }
  }

  // Database JWT setting check
  console.log('\n🗄️  Database JWT Configuration:')
  try {
    const { spawn } = await import('child_process')
    const dockerCmd = spawn('docker', [
      'exec', '-i', 'supabase_db_docker', 
      'psql', '-U', 'postgres', '-d', 'postgres', 
      '-c', 'SHOW "app.settings.jwt_secret";'
    ])

    let output = ''
    dockerCmd.stdout.on('data', (data) => {
      output += data.toString()
    })

    dockerCmd.on('close', (code) => {
      if (code === 0 && output.includes(expectedKeys.JWT_SECRET)) {
        console.log('   ✅ Database JWT secret is correct')
      } else if (code === 0) {
        console.log('   ❌ Database JWT secret is different')
        console.log('   🔧 Run: docker exec -i supabase_db_docker psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/jwt.sql')
      } else {
        console.log('   ⚠️  Cannot verify database JWT (container may not be running)')
      }
    })

  } catch (error) {
    console.log('   ⚠️  Cannot check database JWT:', error.message)
  }

  console.log('\n📋 Summary:')
  if (allCorrect) {
    console.log('   🎉 All custom keys are properly configured!')
    console.log('   🚀 Your Supabase instance will use the custom JWT keys on next restart')
  } else {
    console.log('   ⚠️  Some keys need to be updated')
    console.log('   🔧 Check your .env files and restart Docker containers')
  }

  console.log('\n🔄 To apply changes:')
  console.log('   1. Stop containers: cd docker && docker compose down')
  console.log('   2. Start containers: docker compose up -d')
  console.log('   3. Verify: node scripts/verify-jwt-keys.js')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

verifyKeys().catch(console.error)
