# Testing Guide

This document explains the testing setup for the Cloudless.gr application.

## Overview

The project includes comprehensive testing through GitHub Actions CI/CD pipeline with the following test types:

- **Linting & Type Checking**: Code quality and TypeScript validation
- **Build Testing**: Ensures the application builds successfully
- **Security Testing**: Vulnerability scanning and dependency audits
- **End-to-End Testing**: Browser-based testing with Playwright
- **Accessibility Testing**: Basic accessibility compliance checks
- **Performance Testing**: Bundle size analysis and performance metrics
- **Integration Testing**: Server response and functionality testing

## Running Tests Locally

### Prerequisites

Install the required dependencies:

```bash
npm install
```

### Available Test Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run lint          # ESLint code linting
npm run lint:fix      # Auto-fix linting issues
npm run typecheck     # TypeScript type checking
npm run format        # Prettier code formatting
npm run format:check  # Check code formatting
npm run audit         # Security audit
npm run outdated      # Check for outdated dependencies
npm run ci            # Full CI pipeline locally
```

### End-to-End Testing

The project uses Playwright for browser-based testing:

```bash
# Install Playwright browsers
npx playwright install

# Run all E2E tests
npx playwright test

# Run tests in headed mode (with browser UI)
npx playwright test --headed

# Run specific test file
npx playwright test tests/basic.spec.js

# Run tests matching a pattern
npx playwright test --grep "accessibility"

# Generate test report
npx playwright show-report
```

### Test Structure

```
tests/
├── basic.spec.js          # Basic functionality tests
├── accessibility.spec.js  # Accessibility tests (future)
├── api.spec.js           # API endpoint tests (future)
└── components.spec.js    # Component tests (future)
```

## CI/CD Pipeline

The GitHub Actions workflow runs on:

- **Push** to `main`, `develop`, or `application` branches
- **Pull Requests** to `main` or `application` branches

### Pipeline Jobs

1. **Lint & Type Check**
   - ESLint code linting
   - TypeScript type checking
   - Prettier formatting check

2. **Build Test**
   - Tests build process on Node.js 18 and 20
   - Validates build output structure

3. **Security Check**
   - npm audit for vulnerabilities
   - audit-ci for CI-specific security checks

4. **Dependency Check**
   - Checks for outdated dependencies
   - Validates package.json structure

5. **End-to-End Tests**
   - Playwright browser tests
   - Tests across multiple browsers and devices
   - Uploads test reports as artifacts

6. **Accessibility Test**
   - Basic accessibility compliance checks
   - Alt text validation
   - Heading structure verification

7. **Performance Test**
   - Bundle size analysis
   - Large file detection

8. **Integration Test**
   - Preview server functionality
   - Server response validation

9. **Preview Deploy** (PR only)
   - Builds application for preview
   - Comments PR with test results

10. **Test Summary**
    - Generates comprehensive test report
    - Shows success/failure statistics

## Test Configuration

### ESLint Configuration (`.eslintrc.js`)
- Extends Nuxt.js and Vue.js recommended configs
- Custom rules for project-specific needs
- Prettier integration

### Prettier Configuration (`.prettierrc`)
- Consistent code formatting
- Single quotes, no semicolons
- 80 character line width

### Playwright Configuration (`playwright.config.js`)
- Multiple browser testing (Chrome, Firefox, Safari)
- Mobile device testing
- Parallel test execution
- CI-optimized settings

## Adding New Tests

### Unit Tests
For component or utility function testing, create test files in the appropriate directories:

```javascript
// Example: components/__tests__/MyComponent.test.js
import { mount } from '@vue/test-utils'
import MyComponent from '../MyComponent.vue'

describe('MyComponent', () => {
  test('renders correctly', () => {
    const wrapper = mount(MyComponent)
    expect(wrapper.exists()).toBe(true)
  })
})
```

### E2E Tests
Add new test files to the `tests/` directory:

```javascript
// Example: tests/feature.spec.js
const { test, expect } = require('@playwright/test')

test('feature works correctly', async ({ page }) => {
  await page.goto('/feature')
  await expect(page.locator('.feature-element')).toBeVisible()
})
```

### API Tests
For testing API endpoints:

```javascript
// Example: tests/api.spec.js
const { test, expect } = require('@playwright/test')

test('API endpoint returns correct data', async ({ request }) => {
  const response = await request.get('/api/endpoint')
  expect(response.ok()).toBeTruthy()
  expect(await response.json()).toHaveProperty('data')
})
```

## Best Practices

1. **Test Coverage**: Aim for high test coverage, especially for critical paths
2. **Descriptive Names**: Use clear, descriptive test names
3. **Isolation**: Each test should be independent and not rely on others
4. **Performance**: Keep tests fast and efficient
5. **Maintenance**: Update tests when features change
6. **Documentation**: Document complex test scenarios

## Troubleshooting

### Common Issues

1. **Playwright Installation**
   ```bash
   npx playwright install --with-deps
   ```

2. **ESLint Errors**
   ```bash
   npm run lint:fix
   ```

3. **TypeScript Errors**
   ```bash
   npm run typecheck
   ```

4. **Build Failures**
   ```bash
   npm run build
   ```

### CI Debugging

- Check the GitHub Actions logs for detailed error information
- Use `continue-on-error: true` for non-critical tests
- Review test artifacts for detailed reports

## Contributing

When adding new features:

1. Write tests for new functionality
2. Ensure all existing tests pass
3. Update this documentation if needed
4. Follow the established testing patterns

For questions or issues with testing, please refer to the project's issue tracker. 