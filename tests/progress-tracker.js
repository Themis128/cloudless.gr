// Progress tracker for visual test feedback
class ProgressTracker {
  constructor(totalTests) {
    this.totalTests = totalTests
    this.completedTests = 0
    this.failedTests = 0
    this.startTime = Date.now()
    this.testResults = []
  }

  startTest(testName) {
    const timestamp = new Date().toLocaleTimeString()
    console.log(`\n🔄 [${timestamp}] Starting: ${testName}`)
    this.currentTest = testName
    this.currentTestStart = Date.now()
  }

  completeTest(testName, success = true, error = null) {
    const timestamp = new Date().toLocaleTimeString()
    const duration = Date.now() - this.currentTestStart
    
    if (success) {
      console.log(`✅ [${timestamp}] Completed: ${testName} (${duration}ms)`)
      this.completedTests++
    } else {
      console.log(`❌ [${timestamp}] Failed: ${testName} (${duration}ms)`)
      this.failedTests++
      if (error) {
        console.log(`   Error: ${error}`)
      }
    }

    this.testResults.push({
      name: testName,
      success,
      duration,
      error,
      timestamp
    })

    this.updateProgress()
  }

  updateProgress() {
    const progress = Math.round((this.completedTests + this.failedTests) / this.totalTests * 100)
    const elapsed = Date.now() - this.startTime
    
    console.log(`\n📊 Progress: ${this.completedTests + this.failedTests}/${this.totalTests} (${progress}%)`)
    console.log(`   ✅ Passed: ${this.completedTests}`)
    console.log(`   ❌ Failed: ${this.failedTests}`)
    console.log(`   ⏱️  Elapsed: ${Math.round(elapsed / 1000)}s`)
    
    // Visual progress bar
    const barLength = 30
    const filledLength = Math.round((progress / 100) * barLength)
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
    console.log(`   ${bar} ${progress}%`)
  }

  finish() {
    const totalTime = Date.now() - this.startTime
    const successRate = Math.round((this.completedTests / this.totalTests) * 100)
    
    console.log(`\n🏁 Test Suite Completed!`)
    console.log(`   📊 Total Tests: ${this.totalTests}`)
    console.log(`   ✅ Passed: ${this.completedTests}`)
    console.log(`   ❌ Failed: ${this.failedTests}`)
    console.log(`   📈 Success Rate: ${successRate}%`)
    console.log(`   ⏱️  Total Time: ${Math.round(totalTime / 1000)}s`)
    
    if (this.failedTests > 0) {
      console.log(`\n❌ Failed Tests:`)
      this.testResults
        .filter(result => !result.success)
        .forEach(result => {
          console.log(`   - ${result.name}: ${result.error}`)
        })
    }
    
    return {
      totalTests: this.totalTests,
      passed: this.completedTests,
      failed: this.failedTests,
      successRate,
      totalTime,
      results: this.testResults
    }
  }
}

// Visual indicators for different test stages
const VisualIndicators = {
  start: '🚀',
  loading: '⏳',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  screenshot: '📸',
  form: '📝',
  submit: '🚀',
  validation: '🔍',
  reset: '🔄',
  navigation: '🧭',
  file: '📁',
  waiting: '⏰'
}

// Console logging with colors and emojis
const logWithStyle = (message, type = 'info', emoji = '') => {
  const timestamp = new Date().toLocaleTimeString()
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  }
  
  const icon = emoji || VisualIndicators[type] || ''
  console.log(`${colors[type]}[${timestamp}] ${icon} ${message}${colors.reset}`)
}

// Test step tracking
class TestStepTracker {
  constructor(testName) {
    this.testName = testName
    this.steps = []
    this.currentStep = 0
  }

  step(description, action) {
    this.currentStep++
    const stepInfo = {
      number: this.currentStep,
      description,
      startTime: Date.now()
    }
    
    logWithStyle(`Step ${this.currentStep}: ${description}`, 'info', '📋')
    
    try {
      const result = action()
      stepInfo.success = true
      stepInfo.duration = Date.now() - stepInfo.startTime
      logWithStyle(`Step ${this.currentStep} completed (${stepInfo.duration}ms)`, 'success', '✅')
      this.steps.push(stepInfo)
      return result
    } catch (error) {
      stepInfo.success = false
      stepInfo.error = error.message
      stepInfo.duration = Date.now() - stepInfo.startTime
      logWithStyle(`Step ${this.currentStep} failed: ${error.message}`, 'error', '❌')
      this.steps.push(stepInfo)
      throw error
    }
  }

  getSummary() {
    const totalSteps = this.steps.length
    const successfulSteps = this.steps.filter(s => s.success).length
    const totalTime = this.steps.reduce((sum, step) => sum + step.duration, 0)
    
    return {
      testName: this.testName,
      totalSteps,
      successfulSteps,
      failedSteps: totalSteps - successfulSteps,
      totalTime,
      steps: this.steps
    }
  }
}

module.exports = {
  ProgressTracker,
  VisualIndicators,
  logWithStyle,
  TestStepTracker
} 