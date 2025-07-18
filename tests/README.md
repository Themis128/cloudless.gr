# Tests Directory

This directory contains all test files and testing configuration for the Cloudless project.

## 📁 Test Structure

### 🧪 Test Files

- `basic.spec.js` - Basic Playwright end-to-end tests
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
