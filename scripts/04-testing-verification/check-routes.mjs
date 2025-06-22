#!/usr/bin/env node

/**
 * Nuxt 3 Route Checker and Diagnostic Tool
 * This script checks all routes in your Nuxt application for common issues
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const pagesDir = path.join(__dirname, 'pages')

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

class RouteChecker {
  constructor() {
    this.issues = []
    this.routes = []
    this.layouts = []
    this.middleware = []
  }

  // Scan for all pages and generate routes
  scanPages(dir = pagesDir, basePath = '') {
    if (!fs.existsSync(dir)) {
      this.addIssue('critical', `Pages directory not found: ${dir}`)
      return
    }

    const items = fs.readdirSync(dir)
    
    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)
      
      if (stat.isDirectory()) {
        // Handle directory (nested routes)
        this.scanPages(fullPath, `${basePath}/${item}`)
      } else if (item.endsWith('.vue')) {
        // Handle Vue files
        const routeName = item.replace('.vue', '')
        let routePath = basePath
        
        // Handle special route files
        if (routeName === 'index') {
          routePath = basePath || '/'
        } else if (routeName.startsWith('[') && routeName.endsWith(']')) {
          // Dynamic route
          const paramName = routeName.slice(1, -1)
          if (paramName.startsWith('...')) {
            // Catch-all route
            routePath = `${basePath}/*`
          } else {
            // Single parameter route
            routePath = `${basePath}/:${paramName}`
          }
        } else {
          routePath = `${basePath}/${routeName}`
        }
        
        this.routes.push({
          file: fullPath,
          path: routePath || '/',
          name: routeName,
          isDynamic: routeName.includes('['),
          isCatchAll: routeName.includes('...')
        })
      }
    }
  }

  // Check for common routing issues
  checkRoutes() {
    console.log(`${colors.blue}${colors.bold}🔍 Checking Routes...${colors.reset}\n`)
    
    // Check for duplicate routes
    const pathCounts = {}
    this.routes.forEach(route => {
      pathCounts[route.path] = (pathCounts[route.path] || 0) + 1
    })
    
    Object.entries(pathCounts).forEach(([path, count]) => {
      if (count > 1) {
        this.addIssue('error', `Duplicate route found: ${path} (${count} files)`)
      }
    })
    
    // Check for missing index pages
    const hasRootIndex = this.routes.some(r => r.path === '/')
    if (!hasRootIndex) {
      this.addIssue('critical', 'Missing root index page (pages/index.vue)')
    }
    
    // Check each route file
    this.routes.forEach(route => this.checkRouteFile(route))
    
    console.log(`${colors.green}✅ Found ${this.routes.length} routes${colors.reset}`)
    this.routes.forEach(route => {
      const status = route.isDynamic ? '🔗' : '📄'
      console.log(`  ${status} ${route.path} → ${path.relative(process.cwd(), route.file)}`)
    })
    console.log()
  }

  // Check individual route file
  checkRouteFile(route) {
    try {
      const content = fs.readFileSync(route.file, 'utf8')
      
      // Check for definePageMeta
      if (!content.includes('definePageMeta')) {
        // Not critical, but good practice
        this.addIssue('warning', `${route.file}: Missing definePageMeta (recommended for layout/middleware)`)
      }
      
      // Check for proper template structure
      if (!content.includes('<template>')) {
        this.addIssue('error', `${route.file}: Missing <template> tag`)
      }
      
      // Check for layout references
      const layoutMatch = content.match(/layout:\s*['"`]([^'"`]+)['"`]/)
      if (layoutMatch) {
        const layoutName = layoutMatch[1]
        this.checkLayout(layoutName, route.file)
      }
      
      // Check for middleware references
      const middlewareMatch = content.match(/middleware:\s*\[?['"`]([^'"`]+)['"`]\]?/)
      if (middlewareMatch) {
        const middlewareName = middlewareMatch[1]
        this.checkMiddleware(middlewareName, route.file)
      }
      
    } catch (error) {
      this.addIssue('error', `${route.file}: Cannot read file - ${error.message}`)
    }
  }

  // Check if layout exists
  checkLayout(layoutName, routeFile) {
    const layoutPath = path.join(__dirname, 'layouts', `${layoutName}.vue`)
    if (!fs.existsSync(layoutPath)) {
      this.addIssue('error', `${routeFile}: References non-existent layout '${layoutName}'`)
    }
  }

  // Check if middleware exists
  checkMiddleware(middlewareName, routeFile) {
    const middlewarePath = path.join(__dirname, 'middleware', `${middlewareName}.ts`)
    const middlewarePathJs = path.join(__dirname, 'middleware', `${middlewareName}.js`)
    if (!fs.existsSync(middlewarePath) && !fs.existsSync(middlewarePathJs)) {
      this.addIssue('error', `${routeFile}: References non-existent middleware '${middlewareName}'`)
    }  }

  // Check middleware files
  checkMiddlewareFiles() {
    const middlewareDir = path.join(__dirname, 'middleware')
    if (!fs.existsSync(middlewareDir)) {
      console.log(`${colors.yellow}⚠️  No middleware directory found${colors.reset}`)
      return
    }

    const middlewareFiles = fs.readdirSync(middlewareDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
    
    console.log(`${colors.blue}${colors.bold}🛡️  Checking Middleware...${colors.reset}`)
    middlewareFiles.forEach(file => {
      console.log(`  🛡️  ${file}`)
      const content = fs.readFileSync(path.join(middlewareDir, file), 'utf8')
      
      // Check for proper middleware structure
      if (!content.includes('defineNuxtRouteMiddleware')) {
        this.addIssue('error', `middleware/${file}: Missing defineNuxtRouteMiddleware`)
      }
    })
    console.log()
  }

  // Check layouts
  checkLayouts() {
    const layoutsDir = path.join(__dirname, 'layouts')
    if (!fs.existsSync(layoutsDir)) {
      console.log(`${colors.yellow}⚠️  No layouts directory found${colors.reset}`)
      return
    }

    const layoutFiles = fs.readdirSync(layoutsDir)
      .filter(file => file.endsWith('.vue'))
    
    console.log(`${colors.blue}${colors.bold}🎨 Checking Layouts...${colors.reset}`)
    layoutFiles.forEach(file => {
      console.log(`  🎨 ${file}`)
      const content = fs.readFileSync(path.join(layoutsDir, file), 'utf8')
      
      // Check for NuxtPage
      if (!content.includes('<NuxtPage') && !content.includes('<router-view')) {
        this.addIssue('error', `layouts/${file}: Missing <NuxtPage /> or <router-view />`)
      }
    })
    console.log()
  }

  // Add issue to the list
  addIssue(type, message) {
    this.issues.push({ type, message })
  }

  // Display results
  displayResults() {
    console.log(`${colors.bold}📊 Route Check Results${colors.reset}\n`)
    
    if (this.issues.length === 0) {
      console.log(`${colors.green}${colors.bold}🎉 No routing issues found!${colors.reset}`)
      return
    }
    
    const critical = this.issues.filter(i => i.type === 'critical')
    const errors = this.issues.filter(i => i.type === 'error')
    const warnings = this.issues.filter(i => i.type === 'warning')
    
    if (critical.length > 0) {
      console.log(`${colors.red}${colors.bold}🚨 Critical Issues (${critical.length}):${colors.reset}`)
      critical.forEach(issue => console.log(`  ${colors.red}❌ ${issue.message}${colors.reset}`))
      console.log()
    }
    
    if (errors.length > 0) {
      console.log(`${colors.red}${colors.bold}❌ Errors (${errors.length}):${colors.reset}`)
      errors.forEach(issue => console.log(`  ${colors.red}🔴 ${issue.message}${colors.reset}`))
      console.log()
    }
    
    if (warnings.length > 0) {
      console.log(`${colors.yellow}${colors.bold}⚠️  Warnings (${warnings.length}):${colors.reset}`)
      warnings.forEach(issue => console.log(`  ${colors.yellow}🟡 ${issue.message}${colors.reset}`))
      console.log()
    }
  }

  // Generate route suggestions
  generateSuggestions() {
    console.log(`${colors.blue}${colors.bold}💡 Routing Best Practices:${colors.reset}`)
    console.log(`  📝 Use definePageMeta() for layout and middleware`)
    console.log(`  🎨 Ensure all layouts have <NuxtPage />`)
    console.log(`  🛡️  Use middleware for authentication checks`)
    console.log(`  🔗 Use [id].vue for dynamic routes`)
    console.log(`  🌐 Use [...slug].vue for catch-all routes`)
    console.log(`  📁 Use index.vue for directory default pages`)
    console.log()
  }

  // Main check function
  async run() {
    console.log(`${colors.bold}🚀 Nuxt 3 Route Checker${colors.reset}\n`)
    
    this.scanPages()
    this.checkRoutes()
    this.checkLayouts()
    this.checkMiddlewareFiles()
    this.displayResults()
    this.generateSuggestions()
    
    // Exit with error code if critical issues found
    const hasCritical = this.issues.some(i => i.type === 'critical')
    if (hasCritical) {
      process.exit(1)
    }
  }
}

// Run the checker
const checker = new RouteChecker()
checker.run().catch(console.error)
