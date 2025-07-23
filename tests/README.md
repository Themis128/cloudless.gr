# Tests Directory

This directory contains all test files and testing configuration for the Cloudless project.

## 📁 Test Structure

### 🧪 Test Files

- `basic.spec.js` - Basic Playwright end-to-end tests
- `creation-flows.spec.js` - Comprehensive creation flow tests (pipelines, models, projects, LLMs)
- `creation-flows-focused.spec.js` - Focused creation flow tests with better selectors
- `visual-test-runner.spec.js` - Visual tests with real-time progress and screenshots
- `enhanced-visual-runner.spec.js` - Enhanced visual tests with detailed step tracking
- `visual-dashboard.html` - Web dashboard for real-time test monitoring
- `dashboard-server.js` - WebSocket server for dashboard communication
- `error-logger.js` - Comprehensive error logging and reporting system
- `progress-tracker.js` - Progress tracking utilities for visual feedback
- `test-integration.sh` - Integration test script (Bash)
- `test-integration.ps1` - Integration test script (PowerShell)
- `test-integration-debug.sh` - Debug integration test script

### 📊 Test Reports

- `playwright-report/` - Playwright test reports (auto-generated)

### ⚙️ Configuration

- `playwright.config.js` - Playwright configuration

## 🚀 Running Tests

### E2E Tests (Playwright)

```bash
# Run all tests
npm test

# Run with UI
npx playwright test --headed

# Run specific test
npx playwright test tests/basic.spec.js

# Run creation flow tests
npx playwright test tests/creation-flows-focused.spec.js

# Run all creation tests
npx playwright test tests/creation-flows*.spec.js

# Run visual tests (with browser visible)
npm run test:visual

# Run visual tests in slow mode
npm run test:visual:slow

# Run visual tests in debug mode
npm run test:visual:debug

# Run visual tests with PowerShell script
powershell -ExecutionPolicy Bypass -File tests/run-visual-tests.ps1

## 🎯 Complete Visual Testing System

### Launch the Full Visual System

```bash
# Launch dashboard and open web interface
npm run test:visual:system

# Launch with auto-start tests
npm run test:visual:system:auto

# Launch dashboard only (manual test control)
npm run test:visual:system:dashboard

# Start dashboard server directly
npm run test:dashboard
```

### Web Dashboard Features

- **Real-time Progress**: Live updates of test execution
- **Visual Pipeline**: Step-by-step test progress with screenshots
- **Detailed Logs**: Verbose debugging information
- **Test Metrics**: Success rates, timing, and performance data
- **Screenshot Gallery**: Visual evidence of each test step
- **Interactive Controls**: Start, stop, pause tests from web interface

### Dashboard Access

1. **Launch System**: Run `npm run test:visual:system`
2. **Open Browser**: Navigate to `http://localhost:3001`
3. **Monitor Tests**: Watch real-time progress in the web interface
4. **View Results**: Check screenshots and detailed logs

### Enhanced Visual Features

- **Step-by-Step Tracking**: Every test action is logged and visualized
- **Screenshot Capture**: Automatic screenshots at each step
- **Performance Metrics**: Timing information for each test
- **Error Tracking**: Detailed error information with context
- **WebSocket Communication**: Real-time updates between tests and dashboard

## 🚨 Error Logging and Reporting System

### Comprehensive Error Management

The visual testing system includes a sophisticated error logging system that automatically captures detailed information when tests fail.

### Error Report Features

- **📁 Separate Error Folder**: All error reports saved to `test-results/errors/`
- **📄 Markdown Reports**: Detailed error reports in markdown format
- **📊 JSON Data**: Structured error data for programmatic access
- **📸 Screenshots**: Visual evidence captured at the time of error
- **📝 Verbose Logs**: Complete test execution logs with timestamps
- **🔍 Error Analysis**: Automatic error categorization and cause analysis
- **🛠️ Suggested Fixes**: Intelligent suggestions for resolving issues

### Error Report Contents

Each error report includes:
- **Error Information**: ID, timestamp, test name, error type, message
- **Stack Trace**: Complete error stack trace for debugging
- **Context Information**: Test context, browser info, system info
- **Test Logs**: All log entries from the test execution
- **Screenshots**: Visual state when error occurred
- **Debugging Information**: Error analysis, performance metrics, environment details
- **Troubleshooting Steps**: Step-by-step guidance for resolution

### Error Management Commands

```bash
# View error summary
npm run test:errors

# List all error reports
npm run test:errors:list

# Show latest error report
npm run test:errors:latest

# Open latest error report
npm run test:errors:open

# Show detailed summary and analysis
npm run test:errors:summary

# Clean old error reports
npm run test:errors:clean

# Filter errors by test name
powershell -ExecutionPolicy Bypass -File tests/manage-errors.ps1 -List -TestName "Pipeline"

# Filter errors by error type
powershell -ExecutionPolicy Bypass -File tests/manage-errors.ps1 -List -ErrorType "Timeout"
```

### Error Categories

The system automatically categorizes errors:
- **Timeout Error**: Element or condition wait time exceeded
- **Element Not Found**: Selector or element issues
- **Network Error**: Connection or server problems
- **Assertion Error**: Test expectation failures
- **Navigation Error**: Page loading or URL issues
- **JavaScript Error**: Browser script execution problems

### Error Analysis Features

- **Pattern Recognition**: Identifies common error patterns
- **Performance Metrics**: Memory usage and timing information
- **Browser Compatibility**: Browser and viewport information
- **System Resources**: System state at time of error
- **Automatic Cleanup**: Manages disk space by removing old reports
```

### Integration Tests

```bash
# Bash integration test
chmod +x tests/test-integration.sh
./tests/test-integration.sh

# PowerShell integration test
powershell -ExecutionPolicy Bypass -File tests/test-integration.ps1
```

### Debug Tests

```bash
# Debug integration test
chmod +x tests/test-integration-debug.sh
./tests/test-integration-debug.sh
```

## 📚 Documentation

See [../docs/TESTING.md](../docs/TESTING.md) for detailed testing documentation.
