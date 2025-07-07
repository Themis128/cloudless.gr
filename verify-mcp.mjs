#!/usr/bin/env node

/**
 * MCP Setup Verification
 * Final verification that MCP is ready for use
 */

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const PROJECT_ROOT = process.cwd()

console.log('🎯 MCP Setup Verification')
console.log('==========================')

let allTestsPassed = true

// Test 1: Package installation
console.log('\n📦 Test 1: Package Installation')
try {
  const packagePath = join(PROJECT_ROOT, 'node_modules', '@supabase', 'mcp-server-supabase', 'package.json')
  if (existsSync(packagePath)) {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'))
    console.log(`✅ @supabase/mcp-server-supabase v${pkg.version} installed`)
  } else {
    console.log('❌ @supabase/mcp-server-supabase not found')
    allTestsPassed = false
  }
} catch (error) {
  console.log('❌ Package check failed:', error.message)
  allTestsPassed = false
}

// Test 2: MCP Configuration
console.log('\n⚙️ Test 2: MCP Configuration')
try {
  const configPath = join(PROJECT_ROOT, 'mcp-config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8'))
  
  if (config.mcpServers && config.mcpServers['supabase-official']) {
    console.log('✅ Official Supabase MCP server configured')
  } else {
    console.log('❌ Official Supabase MCP server not configured')
    allTestsPassed = false
  }
  
  if (config.featureGroups) {
    console.log(`✅ Feature groups configured: ${Object.keys(config.featureGroups).join(', ')}`)
  }
} catch (error) {
  console.log('❌ MCP configuration check failed:', error.message)
  allTestsPassed = false
}

// Test 3: Supabase Connection
console.log('\n🔌 Test 3: Supabase Connection')
try {
  const response = await fetch('http://localhost:54321/rest/v1/', {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
    }
  })
  
  if (response.ok) {
    console.log('✅ Supabase accessible at localhost:54321')
  } else {
    console.log(`❌ Supabase returned status: ${response.status}`)
    console.log('   Make sure Supabase is running: npx supabase start')
    allTestsPassed = false
  }
} catch (error) {
  console.log('❌ Cannot connect to Supabase:', error.message)
  console.log('   Make sure Supabase is running: npx supabase start')
  allTestsPassed = false
}

// Test 4: Task Configuration
console.log('\n🔧 Test 4: VS Code Task Configuration')
try {
  const taskPath = join(PROJECT_ROOT, '.vscode', 'tasks.json')
  if (existsSync(taskPath)) {
    console.log('✅ VS Code tasks.json exists')
  } else {
    console.log('ℹ️ VS Code tasks.json not found (optional)')
  }
} catch (error) {
  console.log('ℹ️ Task configuration check skipped')
}

// Final Results
console.log('\n' + '='.repeat(50))
if (allTestsPassed) {
  console.log('🎉 MCP Setup Complete!')
  console.log('\n✅ All tests passed')
  console.log('\n📋 What you can do now:')
  console.log('1. 🚀 Start MCP server: npm run mcp:start')
  console.log('2. 🤖 Configure your AI assistant to use: mcp-config.json')
  console.log('3. 🔧 Available servers: supabase-official, supabase-local-main')
  console.log('4. 💾 Features: database, auth, storage, realtime, development')
} else {
  console.log('⚠️ Some issues found')
  console.log('\n📋 Next steps:')
  console.log('1. Fix any issues shown above')
  console.log('2. Make sure Supabase is running: npx supabase start')
  console.log('3. Verify package installation: npm list @supabase/mcp-server-supabase')
}

console.log('\n🔗 MCP Server Commands:')
console.log('- npm run mcp:start     (Start MCP server)')
console.log('- npm run mcp:test      (Run this test again)')

process.exit(allTestsPassed ? 0 : 1)
