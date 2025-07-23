const fs = require('fs')
const path = require('path')
const { logWithStyle } = require('./progress-tracker')

class ErrorLogger {
    constructor() {
        this.errorFolder = 'test-results/errors'
        this.errorCount = 0
        this.currentTest = null
        this.testLogs = []
        this.screenshots = []
        this.browserInfo = {}
        this.systemInfo = {}
        
        this.ensureErrorFolder()
        this.captureSystemInfo()
    }

    ensureErrorFolder() {
        if (!fs.existsSync(this.errorFolder)) {
            fs.mkdirSync(this.errorFolder, { recursive: true })
            logWithStyle(`Created error folder: ${this.errorFolder}`, 'info')
        }
    }

    captureSystemInfo() {
        this.systemInfo = {
            timestamp: new Date().toISOString(),
            platform: process.platform,
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            pid: process.pid,
            cwd: process.cwd()
        }
    }

    setCurrentTest(testName) {
        this.currentTest = testName
        this.testLogs = []
        this.screenshots = []
        this.errorCount = 0
    }

    addLog(message, level = 'info', metadata = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            test: this.currentTest,
            ...metadata
        }

        this.testLogs.push(logEntry)
        
        // Also log to console
        logWithStyle(message, level)
    }

    addScreenshot(path, caption, metadata = {}) {
        const screenshot = {
            path,
            caption,
            timestamp: new Date().toISOString(),
            test: this.currentTest,
            ...metadata
        }

        this.screenshots.push(screenshot)
    }

    setBrowserInfo(info) {
        this.browserInfo = {
            ...this.browserInfo,
            ...info,
            timestamp: new Date().toISOString()
        }
    }

    async logError(error, context = {}) {
        this.errorCount++
        const errorId = `${Date.now()}-${this.errorCount}`
        const errorFileName = `error-${errorId}.md`
        const errorFilePath = path.join(this.errorFolder, errorFileName)

        const errorReport = this.generateErrorReport(error, context, errorId)
        
        try {
            fs.writeFileSync(errorFilePath, errorReport)
            logWithStyle(`Error report saved: ${errorFilePath}`, 'error')
            
            // Also save a JSON version for programmatic access
            const jsonReport = this.generateJsonReport(error, context, errorId)
            const jsonFilePath = path.join(this.errorFolder, `error-${errorId}.json`)
            fs.writeFileSync(jsonFilePath, JSON.stringify(jsonReport, null, 2))
            
            return {
                errorId,
                markdownFile: errorFilePath,
                jsonFile: jsonFilePath,
                report: errorReport
            }
        } catch (writeError) {
            logWithStyle(`Failed to save error report: ${writeError.message}`, 'error')
            return null
        }
    }

    generateErrorReport(error, context, errorId) {
        const timestamp = new Date().toISOString()
        const testName = this.currentTest || 'Unknown Test'
        
        return `# 🚨 Test Error Report

## 📋 Error Information

- **Error ID**: \`${errorId}\`
- **Timestamp**: \`${timestamp}\`
- **Test Name**: \`${testName}\`
- **Error Type**: \`${error.name || 'Unknown'}\`
- **Error Message**: \`${error.message}\`

## 🔍 Error Details

\`\`\`
${error.stack || 'No stack trace available'}
\`\`\`

## 📊 Context Information

### Test Context
\`\`\`json
${JSON.stringify(context, null, 2)}
\`\`\`

### Browser Information
\`\`\`json
${JSON.stringify(this.browserInfo, null, 2)}
\`\`\`

### System Information
\`\`\`json
${JSON.stringify(this.systemInfo, null, 2)}
\`\`\`

## 📝 Test Logs

${this.generateLogsSection()}

## 📸 Screenshots

${this.generateScreenshotsSection()}

## 🔧 Debugging Information

### Error Analysis
- **Error Category**: ${this.categorizeError(error)}
- **Likely Cause**: ${this.analyzeErrorCause(error)}
- **Suggested Fix**: ${this.suggestFix(error)}

### Performance Metrics
- **Test Duration**: ${this.calculateTestDuration()}ms
- **Memory Usage**: ${this.formatMemoryUsage()}
- **Log Entries**: ${this.testLogs.length}
- **Screenshots**: ${this.screenshots.length}

### Environment Details
- **Playwright Version**: ${process.env.PLAYWRIGHT_VERSION || 'Unknown'}
- **Test Environment**: ${process.env.NODE_ENV || 'development'}
- **Browser**: ${this.browserInfo.browser || 'Unknown'}
- **Viewport**: ${this.browserInfo.viewport || 'Unknown'}

## 🛠️ Troubleshooting Steps

1. **Check the error stack trace** above for the exact location of the failure
2. **Review the test logs** to understand the sequence of events
3. **Examine screenshots** to see the visual state when the error occurred
4. **Verify browser compatibility** and viewport settings
5. **Check system resources** and memory usage
6. **Review recent changes** to the application or test code

## 📞 Support Information

If this error persists, please include:
- This error report file
- The corresponding JSON report
- Any screenshots from the error folder
- Steps to reproduce the issue

---
*Generated by Enhanced Visual Test System - ${timestamp}*
`
    }

    generateJsonReport(error, context, errorId) {
        return {
            errorId,
            timestamp: new Date().toISOString(),
            test: this.currentTest,
            error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
                category: this.categorizeError(error),
                cause: this.analyzeErrorCause(error),
                suggestedFix: this.suggestFix(error)
            },
            context,
            browserInfo: this.browserInfo,
            systemInfo: this.systemInfo,
            logs: this.testLogs,
            screenshots: this.screenshots,
            performance: {
                testDuration: this.calculateTestDuration(),
                memoryUsage: this.formatMemoryUsage(),
                logCount: this.testLogs.length,
                screenshotCount: this.screenshots.length
            }
        }
    }

    generateLogsSection() {
        if (this.testLogs.length === 0) {
            return '*No logs available*'
        }

        return this.testLogs.map(log => {
            const level = log.level.toUpperCase()
            const time = new Date(log.timestamp).toLocaleTimeString()
            return `**${time} [${level}]** ${log.message}`
        }).join('\n\n')
    }

    generateScreenshotsSection() {
        if (this.screenshots.length === 0) {
            return '*No screenshots available*'
        }

        return this.screenshots.map(screenshot => {
            const time = new Date(screenshot.timestamp).toLocaleTimeString()
            return `**${time}** - ${screenshot.caption}\n![Screenshot](${screenshot.path})`
        }).join('\n\n')
    }

    categorizeError(error) {
        const message = error.message.toLowerCase()
        const stack = error.stack.toLowerCase()

        if (message.includes('timeout') || message.includes('waiting')) {
            return 'Timeout Error'
        } else if (message.includes('element') || message.includes('selector')) {
            return 'Element Not Found'
        } else if (message.includes('network') || message.includes('fetch')) {
            return 'Network Error'
        } else if (message.includes('assertion') || message.includes('expect')) {
            return 'Assertion Error'
        } else if (message.includes('navigation') || message.includes('page')) {
            return 'Navigation Error'
        } else if (message.includes('javascript') || message.includes('script')) {
            return 'JavaScript Error'
        } else {
            return 'Unknown Error'
        }
    }

    analyzeErrorCause(error) {
        const message = error.message.toLowerCase()
        const stack = error.stack.toLowerCase()

        if (message.includes('timeout')) {
            return 'The test exceeded the maximum wait time for an element or condition'
        } else if (message.includes('element not found')) {
            return 'The expected element was not found in the DOM, possibly due to timing or selector issues'
        } else if (message.includes('network')) {
            return 'A network request failed, possibly due to server issues or connectivity problems'
        } else if (message.includes('assertion')) {
            return 'A test assertion failed, indicating the expected condition was not met'
        } else if (message.includes('navigation')) {
            return 'Page navigation failed, possibly due to invalid URL or server issues'
        } else {
            return 'Unknown cause - check the error stack trace for more details'
        }
    }

    suggestFix(error) {
        const category = this.categorizeError(error)
        
        switch (category) {
            case 'Timeout Error':
                return 'Increase timeout values, check if elements are loading correctly, or add explicit waits'
            case 'Element Not Found':
                return 'Verify selectors are correct, add wait conditions, or check if the page structure has changed'
            case 'Network Error':
                return 'Check server status, verify network connectivity, or add retry logic'
            case 'Assertion Error':
                return 'Review the expected vs actual values, check test data, or verify application state'
            case 'Navigation Error':
                return 'Verify URLs are correct, check server status, or add error handling for navigation'
            case 'JavaScript Error':
                return 'Check for JavaScript errors in the application, verify browser compatibility'
            default:
                return 'Review the error details and logs to identify the specific issue'
        }
    }

    calculateTestDuration() {
        if (this.testLogs.length < 2) return 0
        
        const startTime = new Date(this.testLogs[0].timestamp)
        const endTime = new Date(this.testLogs[this.testLogs.length - 1].timestamp)
        return endTime - startTime
    }

    formatMemoryUsage() {
        const usage = process.memoryUsage()
        return {
            rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`
        }
    }

    getErrorSummary() {
        return {
            totalErrors: this.errorCount,
            errorFolder: this.errorFolder,
            currentTest: this.currentTest,
            logCount: this.testLogs.length,
            screenshotCount: this.screenshots.length
        }
    }

    async cleanup() {
        // Keep only the last 50 error reports to prevent disk space issues
        try {
            const files = fs.readdirSync(this.errorFolder)
            const errorFiles = files.filter(file => file.startsWith('error-') && file.endsWith('.md'))
            
            if (errorFiles.length > 50) {
                const sortedFiles = errorFiles
                    .map(file => ({
                        name: file,
                        path: path.join(this.errorFolder, file),
                        mtime: fs.statSync(path.join(this.errorFolder, file)).mtime
                    }))
                    .sort((a, b) => b.mtime - a.mtime)
                
                const filesToDelete = sortedFiles.slice(50)
                filesToDelete.forEach(file => {
                    fs.unlinkSync(file.path)
                    const jsonFile = file.path.replace('.md', '.json')
                    if (fs.existsSync(jsonFile)) {
                        fs.unlinkSync(jsonFile)
                    }
                })
                
                logWithStyle(`Cleaned up ${filesToDelete.length} old error reports`, 'info')
            }
        } catch (error) {
            logWithStyle(`Error during cleanup: ${error.message}`, 'warning')
        }
    }
}

// Global error logger instance
const errorLogger = new ErrorLogger()

module.exports = {
    ErrorLogger,
    errorLogger
} 