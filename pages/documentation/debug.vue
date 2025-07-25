<template>
  <div>
    <LayoutPageStructure
      title="Debug Documentation"
      subtitle="Learn how to debug and troubleshoot your applications"
      back-button-to="/documentation"
      :has-sidebar="false"
      :white-header="true"
    >
      <template #main>
        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h5">
            <v-icon start color="primary">mdi-bug</v-icon>
            Debugging Overview
          </v-card-title>
          <v-card-text>
            <p class="text-body-1 mb-4">
              Effective debugging is essential for maintaining and improving your applications.
              Our platform provides comprehensive debugging tools and techniques to help you identify and resolve issues quickly.
            </p>
            
            <v-alert type="info" variant="tonal" class="mb-4">
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              <strong>Tip:</strong> Use systematic debugging approaches to efficiently identify and resolve issues.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-tools</v-icon>
            Debugging Tools
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="blue" class="mb-2">mdi-console</v-icon>
                  <h5 class="text-h6">Console Logging</h5>
                  <p class="text-body-2 mb-3">Use console.log, console.error, and console.warn for debugging</p>
                  <v-chip color="primary" size="small">Basic</v-chip>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="green" class="mb-2">mdi-debugger</v-icon>
                  <h5 class="text-h6">Debugger</h5>
                  <p class="text-body-2 mb-3">Set breakpoints and step through code execution</p>
                  <v-chip color="success" size="small">Advanced</v-chip>
                </v-card>
              </v-col>
              
              <v-col cols="12" sm="6" md="4">
                <v-card variant="outlined" class="text-center pa-4 h-100">
                  <v-icon size="48" color="orange" class="mb-2">mdi-chart-line</v-icon>
                  <h5 class="text-h6">Performance</h5>
                  <p class="text-body-2 mb-3">Monitor application performance and bottlenecks</p>
                  <v-chip color="warning" size="small">Pro</v-chip>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-console-line</v-icon>
            Console Debugging
          </v-card-title>
          <v-card-text>
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Basic Console Commands</h4>
              <v-code-block
                language="javascript"
                :code="consoleExamples"
                class="mb-4"
              />
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Advanced Console Features</h4>
              <v-row>
                <v-col cols="12" md="6">
                  <h5 class="text-h6 mb-2">Console Groups</h5>
                  <v-code-block
                    language="javascript"
                    :code="consoleGroupsExample"
                    class="mb-3"
                  />
                </v-col>
                
                <v-col cols="12" md="6">
                  <h5 class="text-h6 mb-2">Console Tables</h5>
                  <v-code-block
                    language="javascript"
                    :code="consoleTableExample"
                    class="mb-3"
                  />
                </v-col>
              </v-row>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-debugger</v-icon>
            Debugger Usage
          </v-card-title>
          <v-card-text>
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Setting Breakpoints</h4>
              <p class="text-body-2 mb-3">
                Use the debugger statement or browser dev tools to pause execution and inspect variables.
              </p>
              
              <v-code-block
                language="javascript"
                :code="debuggerExample"
                class="mb-4"
              />
            </div>
            
            <div class="mb-4">
              <h4 class="text-h6 mb-2">Debugging Tips</h4>
              <ul class="text-body-2">
                <li>Use conditional breakpoints for specific scenarios</li>
                <li>Inspect call stack to understand execution flow</li>
                <li>Watch variables for changes during execution</li>
                <li>Use step-over, step-into, and step-out commands</li>
              </ul>
            </div>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-chart-line</v-icon>
            Performance Debugging
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Performance Monitoring</h4>
                <p class="text-body-2 mb-3">
                  Use performance APIs to measure execution time and identify bottlenecks.
                </p>
                
                <v-code-block
                  language="javascript"
                  :code="performanceExample"
                  class="mb-4"
                />
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Memory Profiling</h4>
                <p class="text-body-2 mb-3">
                  Monitor memory usage and identify memory leaks.
                </p>
                
                <v-code-block
                  language="javascript"
                  :code="memoryExample"
                  class="mb-4"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-alert-circle</v-icon>
            Common Issues & Solutions
          </v-card-title>
          <v-card-text>
            <v-expansion-panels variant="accordion">
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="error">mdi-alert</v-icon>
                  Undefined Variables
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2 mb-2">Check variable scope and initialization.</p>
                  <v-code-block
                    language="javascript"
                    :code="undefinedExample"
                    class="mb-2"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="warning">mdi-clock-outline</v-icon>
                  Async Issues
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2 mb-2">Debug asynchronous code execution.</p>
                  <v-code-block
                    language="javascript"
                    :code="asyncExample"
                    class="mb-2"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
              
              <v-expansion-panel>
                <v-expansion-panel-title>
                  <v-icon start color="info">mdi-database</v-icon>
                  API Errors
                </v-expansion-panel-title>
                <v-expansion-panel-text>
                  <p class="text-body-2 mb-2">Handle and debug API request failures.</p>
                  <v-code-block
                    language="javascript"
                    :code="apiErrorExample"
                    class="mb-2"
                  />
                </v-expansion-panel-text>
              </v-expansion-panel>
            </v-expansion-panels>
          </v-card-text>
        </v-card>

        <v-card class="mb-6 bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-logout</v-icon>
            Logging Best Practices
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Structured Logging</h4>
                <ul class="text-body-2">
                  <li>Use consistent log levels (debug, info, warn, error)</li>
                  <li>Include relevant context and metadata</li>
                  <li>Use structured log formats (JSON)</li>
                  <li>Implement log rotation and retention</li>
                </ul>
              </v-col>
              
              <v-col cols="12" md="6">
                <h4 class="text-h6 mb-2">Error Handling</h4>
                <ul class="text-body-2">
                  <li>Always catch and log errors</li>
                  <li>Include stack traces for debugging</li>
                  <li>Use error boundaries in React/Vue</li>
                  <li>Implement graceful degradation</li>
                </ul>
              </v-col>
            </v-row>
            
            <v-alert type="success" variant="tonal" class="mt-4">
              <template #prepend>
                <v-icon>mdi-lightbulb</v-icon>
              </template>
              <strong>Pro Tip:</strong> Use source maps in production to debug minified code effectively.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-card class="bg-white">
          <v-card-title class="text-h6">
            <v-icon start color="primary">mdi-help-circle</v-icon>
            Debugging Workflow
          </v-card-title>
          <v-card-text>
            <v-stepper v-model="debugStep" class="mb-4">
              <v-stepper-header>
                <v-stepper-item value="1" title="Reproduce" subtitle="Identify the issue">
                  <template #icon>
                    <v-icon>mdi-magnify</v-icon>
                  </template>
                </v-stepper-item>
                
                <v-divider></v-divider>
                
                <v-stepper-item value="2" title="Isolate" subtitle="Narrow down the problem">
                  <template #icon>
                    <v-icon>mdi-target</v-icon>
                  </template>
                </v-stepper-item>
                
                <v-divider></v-divider>
                
                <v-stepper-item value="3" title="Fix" subtitle="Implement solution">
                  <template #icon>
                    <v-icon>mdi-wrench</v-icon>
                  </template>
                </v-stepper-item>
                
                <v-divider></v-divider>
                
                <v-stepper-item value="4" title="Test" subtitle="Verify the fix">
                  <template #icon>
                    <v-icon>mdi-check-circle</v-icon>
                  </template>
                </v-stepper-item>
              </v-stepper-header>
              
              <v-stepper-window>
                <v-stepper-window-item value="1">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Reproduce the Issue</h4>
                    <p class="text-body-2">Consistently reproduce the problem to understand its scope and impact.</p>
                  </div>
                </v-stepper-window-item>
                
                <v-stepper-window-item value="2">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Isolate the Problem</h4>
                    <p class="text-body-2">Use debugging tools to identify the root cause and affected components.</p>
                  </div>
                </v-stepper-window-item>
                
                <v-stepper-window-item value="3">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Implement the Fix</h4>
                    <p class="text-body-2">Apply the necessary changes to resolve the issue.</p>
                  </div>
                </v-stepper-window-item>
                
                <v-stepper-window-item value="4">
                  <div class="pa-4">
                    <h4 class="text-h6 mb-2">Test the Solution</h4>
                    <p class="text-body-2">Verify that the fix resolves the issue without introducing new problems.</p>
                  </div>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </v-card-text>
        </v-card>
      </template>
    </LayoutPageStructure>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Reactive data
const debugStep = ref(1)

// Code examples
const consoleExamples = `// Basic console usage
console.log('Debug message');
console.error('Error occurred:', error);
console.warn('Warning message');
console.info('Information message');

// Object inspection
console.log('User object:', user);
console.dir(user); // Detailed object view

// Performance timing
console.time('operation');
// ... perform operation
console.timeEnd('operation');`

const consoleGroupsExample = `console.group('User Authentication');
console.log('Checking credentials...');
console.log('Validating token...');
console.groupEnd();

console.groupCollapsed('API Calls');
console.log('GET /api/users');
console.log('POST /api/login');
console.groupEnd();`

const consoleTableExample = `const users = [
  { name: 'John', age: 30, role: 'Admin' },
  { name: 'Jane', age: 25, role: 'User' }
];

console.table(users);`

const debuggerExample = `function processUser(user) {
  debugger; // Execution will pause here
  if (!user.name) {
    throw new Error('User name is required');
  }
  return user.name.toUpperCase();
}`

const performanceExample = `// Performance measurement
performance.mark('startOperation');
// ... perform operation
performance.mark('endOperation');
performance.measure('operation', 'startOperation', 'endOperation');

// Get performance entries
const entries = performance.getEntriesByName('operation');
console.log('Operation took:', entries[0].duration, 'ms');`

const memoryExample = `// Memory usage (if available)
if (performance.memory) {
  console.log('Memory usage:', {
    used: performance.memory.usedJSHeapSize,
    total: performance.memory.totalJSHeapSize,
    limit: performance.memory.jsHeapSizeLimit
  });
}`

const undefinedExample = `// Problem: Variable is undefined
let user;
console.log(user.name); // TypeError: Cannot read property 'name' of undefined

// Solution: Check before using
if (user && user.name) {
  console.log(user.name);
}`

const asyncExample = `// Problem: Async timing issues
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  console.log(data); // May not execute if fetch fails
}

// Solution: Proper error handling
async function fetchData() {
  try {
    const response = await fetch('/api/data');
    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Fetch failed:', error);
  }
}`

const apiErrorExample = `// Handle API errors
fetch('/api/users')
  .then(response => {
    if (!response.ok) {
      throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
    }
    return response.json();
  })
  .then(data => {
    console.log('Success:', data);
  })
  .catch(error => {
    console.error('API Error:', error);
    // Log additional context
    console.error('Request URL:', '/api/users');
    console.error('Timestamp:', new Date().toISOString());
  });`

// SEO Meta Tags
useHead({
  title: 'Debug Documentation - Cloudless',
  meta: [
    { name: 'description', content: 'Learn how to debug and troubleshoot your applications effectively with our comprehensive documentation.' },
    { property: 'og:title', content: 'Debug Documentation - Cloudless' },
    { property: 'og:description', content: 'Application debugging documentation and best practices' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'Debug Documentation - Cloudless' },
    { name: 'twitter:description', content: 'Application debugging documentation and best practices' }
  ]
})

// Page Meta
definePageMeta({
  title: 'Debug Documentation',
  description: 'Learn how to debug and troubleshoot your applications'
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

.h-100 {
  height: 100%;
}
</style> 