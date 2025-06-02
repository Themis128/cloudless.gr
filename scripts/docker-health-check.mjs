#!/usr/bin/env node

/**
 * Docker Health Check Script for Cloudless.gr Platform
 * This script validates that all services are running correctly in Docker
 */

import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logHeader(message) {
  log(`\n🔍 ${message}`, 'blue')
  log(''.padEnd(message.length + 4, '='), 'blue')
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green')
}

function logError(message) {
  log(`❌ ${message}`, 'red')
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow')
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan')
}

async function checkEnvironmentVariables() {
  logHeader('Checking Environment Variables')
  
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'NUXT_JWT_SECRET'
  ]
  
  const optionalVars = [
    'SUPABASE_SERVICE_KEY',
    'NUXT_AUTH_SECRET',
    'ADMIN_EMAIL',
    'MINIO_ACCESS_KEY'
  ]
  
  let allRequired = true
  
  // Check required variables
  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      logError(`Missing required environment variable: ${varName}`)
      allRequired = false
    } else {
      logSuccess(`${varName} is set`)
    }
  }
  
  // Check optional variables
  for (const varName of optionalVars) {
    const value = process.env[varName]
    if (!value || value.trim() === '') {
      logWarning(`Optional environment variable not set: ${varName}`)
    } else {
      logSuccess(`${varName} is set`)
    }
  }
  
  return allRequired
}

async function checkSupabaseConnection() {
  logHeader('Testing Supabase Connection')
  
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseKey) {
    logError('Supabase credentials not found')
    return false
  }
  
  try {
    logInfo(`Connecting to: ${supabaseUrl}`)
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Test basic connection
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .limit(1)
    
    if (error) {
      if (error.code === '42P01') {
        logWarning('Instruments table does not exist yet')
        logInfo('You may need to run the SQL setup script in Supabase dashboard')
        return true // Connection works, just missing table
      } else {
        logError(`Supabase error: ${error.message}`)
        return false
      }
    } else {
      logSuccess('Supabase connection successful!')
      logInfo(`Found ${data?.length || 0} instruments in database`)
      return true
    }
  } catch (error) {
    logError(`Failed to connect to Supabase: ${error.message}`)
    return false
  }
}

async function checkServiceHealth(serviceName, url, timeout = 5000) {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Docker-Health-Check/1.0'
      }
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      logSuccess(`${serviceName} is healthy (${response.status})`)
      return true
    } else {
      logError(`${serviceName} returned ${response.status}`)
      return false
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      logError(`${serviceName} health check timed out`)
    } else {
      logError(`${serviceName} health check failed: ${error.message}`)
    }
    return false
  }
}

async function checkApplicationServices() {
  logHeader('Checking Application Services')
  
  const services = [
    { name: 'Nuxt Application', url: 'http://localhost:3000/' },
    { name: 'Supabase Demo Page', url: 'http://localhost:3000/supabase-demo' },
    { name: 'MinIO Health', url: 'http://localhost:9000/minio/health/live' },
    { name: 'MinIO Console', url: 'http://localhost:9001/' },
    { name: 'Portainer', url: 'http://localhost:9002/' },
  ]
  
  const results = await Promise.allSettled(
    services.map(service => checkServiceHealth(service.name, service.url))
  )
  
  const healthy = results.filter(result => 
    result.status === 'fulfilled' && result.value === true
  ).length
  
  logInfo(`${healthy}/${services.length} services are healthy`)
  return healthy === services.length
}

async function checkDatabaseServices() {
  logHeader('Checking Database Services')
  
  // Check PostgreSQL (if available)
  try {
    const postgresHealth = await checkServiceHealth(
      'PostgreSQL', 
      'http://localhost:5432/',
      2000
    )
  } catch (error) {
    logWarning('PostgreSQL service not accessible (this may be normal)')
  }
  
  // Check Redis (if available)
  try {
    const redisHealth = await checkServiceHealth(
      'Redis', 
      'http://localhost:6379/',
      2000
    )
  } catch (error) {
    logWarning('Redis service not accessible (this may be normal)')
  }
  
  return true // Database checks are not critical
}

async function generateHealthReport() {
  logHeader('Health Check Summary')
  
  const envCheck = await checkEnvironmentVariables()
  const supabaseCheck = await checkSupabaseConnection()
  const appCheck = await checkApplicationServices()
  const dbCheck = await checkDatabaseServices()
  
  log('\n📊 FINAL HEALTH REPORT', 'blue')
  log('========================', 'blue')
  
  const checks = [
    { name: 'Environment Variables', status: envCheck },
    { name: 'Supabase Connection', status: supabaseCheck },
    { name: 'Application Services', status: appCheck },
    { name: 'Database Services', status: dbCheck },
  ]
  
  let overallHealth = true
  
  checks.forEach(check => {
    if (check.status) {
      logSuccess(`${check.name}: HEALTHY`)
    } else {
      logError(`${check.name}: UNHEALTHY`)
      overallHealth = false
    }
  })
  
  log(`\n🎯 OVERALL STATUS: ${overallHealth ? 'HEALTHY' : 'NEEDS ATTENTION'}`, 
      overallHealth ? 'green' : 'red')
  
  if (!overallHealth) {
    log('\n📋 RECOMMENDATIONS:', 'yellow')
    
    if (!envCheck) {
      log('• Check your .env file and ensure all required variables are set', 'yellow')
      log('• See .env.docker.template for reference', 'yellow')
    }
    
    if (!supabaseCheck) {
      log('• Verify your Supabase credentials in the dashboard', 'yellow')
      log('• Run the SQL setup script if the instruments table is missing', 'yellow')
    }
    
    if (!appCheck) {
      log('• Check if all Docker containers are running: docker-compose ps', 'yellow')
      log('• Review Docker logs: docker-compose logs', 'yellow')
    }
    
    log('• Use the deploy-docker.ps1 script for easier troubleshooting', 'yellow')
  }
  
  return overallHealth
}

// Main execution
async function main() {
  log('🚀 Cloudless.gr Platform - Docker Health Check', 'blue')
  log('===============================================', 'blue')
  log(`📅 Started at: ${new Date().toISOString()}`, 'cyan')
  
  try {
    const isHealthy = await generateHealthReport()
    process.exit(isHealthy ? 0 : 1)
  } catch (error) {
    logError(`Health check failed: ${error.message}`)
    process.exit(1)
  }
}

main()
