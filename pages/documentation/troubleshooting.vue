<template>
  <div>
    <LayoutPageStructure
      title="Troubleshooting Documentation"
      subtitle="Common issues and their solutions"
      back-button-to="/documentation"
      :has-sidebar="false"
      :white-header="true"
    >
      <template #main>
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h5">
            <v-icon start color="primary">mdi-help-circle</v-icon>
            Troubleshooting Guide
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              This guide helps you resolve common issues that may arise when using our platform.
              Follow the systematic approach to identify and fix problems quickly.
            </p>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Note:</strong> If you can't find a solution here, please check our support documentation or contact our team.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-magnify</v-icon>
            Quick Diagnosis
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="error" class="mb-2">mdi-alert</v-icon>
                  <h5 class="text-h6">Error Messages</h5>
                  <p class="text-body-2">Check console and network errors</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="warning" class="mb-2">mdi-clock-outline</v-icon>
                  <h5 class="text-h6">Performance</h5>
                  <p class="text-body-2">Monitor loading times and responsiveness</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="info" class="mb-2">mdi-connection</v-icon>
                  <h5 class="text-h6">Connectivity</h5>
                  <p class="text-body-2">Verify network and API connections</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="success" class="mb-2">mdi-check-circle</v-icon>
                  <h5 class="text-h6">Configuration</h5>
                  <p class="text-body-2">Check settings and environment variables</p>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-alert-circle</v-icon>
            Common Issues
          </v-card-title>
          <v-card-text>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="error">mdi-close-circle</v-icon>
                  Application Won't Start
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Possible Causes:</h5>
                    <ul class="text-body-2">
                      <li>Missing dependencies or incorrect versions</li>
                      <li>Port conflicts or firewall issues</li>
                      <li>Database connection problems</li>
                      <li>Environment configuration errors</li>
                    </ul>
                  </div>
                  
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Solutions:</h5>
                    <ol class="text-body-2">
                      <li>Check if all dependencies are installed: <code>npm install</code></li>
                      <li>Verify port availability: <code>netstat -an | findstr :3000</code></li>
                      <li>Test database connectivity</li>
                      <li>Review environment variables and configuration files</li>
                    </ol>
                  </div>
                  
                  <v-alert type="info" variant="tonal">
                    <template #prepend>
                      <v-icon>mdi-lightbulb</v-icon>
                    </template>
                    Try running the application in development mode first to see detailed error messages.
                  </v-alert>
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="warning">mdi-database-off</v-icon>
                  Database Connection Issues
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Symptoms:</h5>
                    <ul class="text-body-2">
                      <li>"Connection refused" errors</li>
                      <li>Database timeout messages</li>
                      <li>Authentication failures</li>
                      <li>Schema migration errors</li>
                    </ul>
                  </div>
                  
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Troubleshooting Steps:</h5>
                    <ol class="text-body-2">
                      <li>Verify database service is running</li>
                      <li>Check connection string and credentials</li>
                      <li>Test network connectivity to database server</li>
                      <li>Run database migrations: <code>npx prisma migrate dev</code></li>
                      <li>Reset database if needed: <code>npx prisma db push --force-reset</code></li>
                    </ol>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="info">mdi-api-off</v-icon>
                  API Endpoint Errors
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Common Error Codes:</h5>
                    <ul class="text-body-2">
                      <li><strong>404:</strong> Endpoint not found - check URL and routing</li>
                      <li><strong>500:</strong> Server error - check server logs</li>
                      <li><strong>401:</strong> Unauthorized - verify authentication</li>
                      <li><strong>403:</strong> Forbidden - check permissions</li>
                    </ul>
                  </div>
                  
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Debugging Steps:</h5>
                    <ol class="text-body-2">
                      <li>Check browser developer tools Network tab</li>
                      <li>Verify API endpoint URLs and methods</li>
                      <li>Test endpoints with tools like Postman or curl</li>
                      <li>Review server-side error logs</li>
                      <li>Check authentication and authorization headers</li>
                    </ol>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="success">mdi-cog-sync</v-icon>
                  Build and Deployment Issues
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Build Problems:</h5>
                    <ul class="text-body-2">
                      <li>Compilation errors</li>
                      <li>Missing dependencies</li>
                      <li>TypeScript errors</li>
                      <li>Asset optimization failures</li>
                    </ul>
                  </div>
                  
                  <div class="mb-3">
                    <h5 class="text-h6 mb-2">Solutions:</h5>
                    <ol class="text-body-2">
                      <li>Clear build cache: <code>npm run clean</code></li>
                      <li>Reinstall dependencies: <code>rm -rf node_modules && npm install</code></li>
                      <li>Check TypeScript configuration</li>
                      <li>Verify environment variables for build</li>
                      <li>Test build locally before deployment</li>
                    </ol>
                  </div>
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-tools</v-icon>
            Diagnostic Tools
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Browser Developer Tools</h4>
                <ul class="text-body-2">
                  <li><strong>Console:</strong> View errors and debug messages</li>
                  <li><strong>Network:</strong> Monitor API requests and responses</li>
                  <li><strong>Elements:</strong> Inspect DOM structure and styles</li>
                  <li><strong>Performance:</strong> Analyze loading times and bottlenecks</li>
                  <li><strong>Application:</strong> Check storage and service workers</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Command Line Tools</h4>
                <ul class="text-body-2">
                  <li><strong>npm:</strong> Package management and scripts</li>
                  <li><strong>npx:</strong> Run packages without installation</li>
                  <li><strong>curl:</strong> Test API endpoints</li>
                  <li><strong>netstat:</strong> Check port availability</li>
                  <li><strong>ping:</strong> Test network connectivity</li>
                </ul>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chart-line</v-icon>
            Performance Issues
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="red" class="mb-2">mdi-timer-sand</v-icon>
                  <h5 class="text-h6">Slow Loading</h5>
                  <p class="text-body-2">Optimize assets and caching</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="orange" class="mb-2">mdi-memory</v-icon>
                  <h5 class="text-h6">Memory Leaks</h5>
                  <p class="text-body-2">Monitor and clean up resources</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="blue" class="mb-2">mdi-database</v-icon>
                  <h5 class="text-h6">Database</h5>
                  <p class="text-body-2">Optimize queries and indexing</p>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="3">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="green" class="mb-2">mdi-server</v-icon>
                  <h5 class="text-h6">Server</h5>
                  <p class="text-body-2">Scale resources and optimize code</p>
                </v-card>
              </v-col>
            </v-row>
            
            <v-alert type="warning" variant="tonal" class="mt-4">
              <template #prepend>
                <v-icon>mdi-lightbulb</v-icon>
              </template>
              <strong>Performance Tip:</strong> Use browser dev tools Performance tab to identify bottlenecks and optimize accordingly.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-shield-check</v-icon>
            Security Issues
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Authentication Problems</h4>
                <ul class="text-body-2">
                  <li>Check JWT token expiration</li>
                  <li>Verify session management</li>
                  <li>Review authentication middleware</li>
                  <li>Test login/logout flows</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Authorization Issues</h4>
                <ul class="text-body-2">
                  <li>Verify user roles and permissions</li>
                  <li>Check route protection</li>
                  <li>Review access control lists</li>
                  <li>Test permission boundaries</li>
                </ul>
              </v-col>
            </v-row>
            
            <v-alert type="error" variant="tonal" class="mt-4">
              <template #prepend>
                <v-icon>mdi-shield-alert</v-icon>
              </template>
              <strong>Security Warning:</strong> Never expose sensitive information in error messages or logs.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-lifebuoy</v-icon>
            Getting Help
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="primary" class="mb-2">mdi-book-open</v-icon>
                  <h5 class="text-h6">Documentation</h5>
                  <p class="text-body-2 mb-3">Check our comprehensive documentation</p>
                  <v-btn color="primary" variant="outlined" size="small">
                    View Docs
                  </v-btn>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="success" class="mb-2">mdi-forum</v-icon>
                  <h5 class="text-h6">Community</h5>
                  <p class="text-body-2 mb-3">Ask questions in our community forum</p>
                  <v-btn color="success" variant="outlined" size="small">
                    Join Forum
                  </v-btn>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4">
                  <v-icon size="48" color="info" class="mb-2">mdi-headset</v-icon>
                  <h5 class="text-h6">Support</h5>
                  <p class="text-body-2 mb-3">Contact our support team</p>
                  <v-btn color="info" variant="outlined" size="small">
                    Contact Support
                  </v-btn>
                </v-card>
              </v-col>
            </v-row>
            
            <v-alert type="info" variant="tonal" class="mt-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Before contacting support:</strong> Please gather relevant information including error messages, browser details, and steps to reproduce the issue.
            </v-alert>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
// SEO Meta Tags
useHead({
  title: 'Troubleshooting Documentation - Cloudless',
  meta: [
    { name: 'description', content: 'Common issues and their solutions for troubleshooting your applications effectively.' },
    { property: 'og:title', content: 'Troubleshooting Documentation - Cloudless' },
    { property: 'og:description', content: 'Troubleshooting guide and common issue solutions' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Troubleshooting Documentation - Cloudless' },
    { name: 'twitter:description', content: 'Troubleshooting guide and common issue solutions' }
  ]
})

// Page Meta
definePageMeta({
  title: 'Troubleshooting Documentation',
  description: 'Common issues and their solutions'
})
</script>

<style scoped>
.v-card {
  border-radius: 12px;
}

.v-card-title {
  border-bottom: 1px solid rgba(0, 0, 0, 0.12);
  padding-bottom: 1rem;
}

.v-alert {
  border-radius: 8px;
}

code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
</style> 