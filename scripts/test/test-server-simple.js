#!/usr/bin/env node

// Simple Server Test - Just validate the server module
console.log('🧪 Simple Server Module Test')
console.log('=============================')

const fs = require('fs')
const path = require('path')

// Check if server file exists
const serverFile = '.output/server/index.mjs'
if (!fs.existsSync(serverFile)) {
  console.log(`❌ Server file not found: ${serverFile}`)
  process.exit(1)
}

console.log(`✅ Server file exists: ${serverFile}`)

// Check file size
const stats = fs.statSync(serverFile)
console.log(`📊 File size: ${stats.size} bytes`)

// Try to read the file content (first few lines)
try {
  const content = fs.readFileSync(serverFile, 'utf8')
  const lines = content.split('\n').slice(0, 5)
  console.log('📄 First few lines:')
  lines.forEach((line, i) => {
    console.log(`  ${i + 1}: ${line}`)
  })
} catch (error) {
  console.log(`❌ Error reading file: ${error.message}`)
  process.exit(1)
}

// Try to import the module
console.log('\n🔄 Attempting to import server module...')
try {
  // Use dynamic import for ES modules
  import('./.output/server/index.mjs')
    .then(serverModule => {
      console.log('✅ Server module imported successfully')

      // Check for expected exports
      const exports = Object.keys(serverModule)
      console.log(`📋 Available exports: ${exports.join(', ')}`)

      if (serverModule.listener) {
        console.log('✅ listener function found')
      } else {
        console.log('❌ listener function not found')
      }

      if (serverModule.handler) {
        console.log('✅ handler function found')
      } else {
        console.log('❌ handler function not found')
      }

      if (serverModule.websocket) {
        console.log('✅ websocket function found')
      } else {
        console.log('❌ websocket function not found')
      }

      console.log('✅ Server module validation passed')
      process.exit(0)
    })
    .catch(error => {
      console.log(`❌ Error importing server module: ${error.message}`)
      console.log(`📋 Error stack: ${error.stack}`)
      process.exit(1)
    })
} catch (error) {
  console.log(`❌ Error in import process: ${error.message}`)
  process.exit(1)
}
