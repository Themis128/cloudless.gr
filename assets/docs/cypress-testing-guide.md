# Working with Cypress for E2E Testing

This guide covers how to use Cypress for testing your Nuxt.js application, specifically focusing on the contact form functionality.

## Getting Started

### Running Cypress Tests

Cypress can be run in two modes:

1. **Interactive mode** (with UI):

   ```bash
   npm run cypress:open
   ```

   This opens the Cypress Test Runner UI where you can select tests to run and watch them execute in real-time.

2. **Headless mode** (for CI/CD or quick runs):
   ```bash
   npm run cypress:run
   ```
   This runs all tests in a headless browser and outputs results to the terminal.

### Prerequisites

Before running tests:

- Make sure the development server is running (`npm run dev`)
- Ensure all dependencies are installed (`npm install`)

## Test Structure

Our Cypress tests follow this structure:

```typescript
describe('Feature or Component', () => {
  beforeEach(() => {
    // Setup code that runs before each test
    cy.visit('/page-to-test');
  });

  it('should perform a specific action', () => {
    // Test code here
    cy.get('selector').should('exist');
  });
});
```

## Common Cypress Commands

### Navigation

- `cy.visit('/path')` - Navigate to a page
- `cy.reload()` - Reload the current page

### Finding Elements

- `cy.get('selector')` - Get elements by selector (CSS selector)
- `cy.contains('text')` - Get elements containing specific text

### Interacting with Elements

- `cy.get('#element').click()` - Click on an element
- `cy.get('#input').type('text')` - Type into an input field
- `cy.get('#input').clear()` - Clear an input field

### Assertions

- `cy.get('element').should('exist')` - Element should exist
- `cy.get('element').should('be.visible')` - Element should be visible
- `cy.get('element').should('have.value', 'text')` - Input should have specific value
- `cy.get('element').should('have.attr', 'attribute', 'value')` - Element should have attribute

### Network Requests

- `cy.intercept('POST', '/api/endpoint', {response})` - Mock API responses
- `cy.wait('@aliasName')` - Wait for an intercepted request to complete

### Working with localStorage

- `cy.clearLocalStorage()` - Clear all localStorage
- `cy.window().then(win => {...})` - Access window object to check localStorage

## Testing Contact Form Features

Our tests cover these key features:

1. **Form Validation**

   - Empty field validation
   - Email format validation

2. **Form Submission**

   - Successful submission workflow
   - Error handling

3. **Auto-save Functionality**

   - Saving form data to localStorage
   - Restoring form data on page load
   - Clearing form data after submission

4. **Accessibility**
   - Testing form elements have proper ARIA attributes
   - Testing keyboard navigation

## Writing Custom Commands

You can extend Cypress with custom commands in `cypress/support/commands.js`:

```typescript
// Example: Custom command to fill out the contact form
Cypress.Commands.add('fillContactForm', (name, email, subject, message) => {
  cy.get('#name').type(name);
  cy.get('#email').type(email);
  cy.get('#subject').type(subject);
  cy.get('#message').type(message);
});
```

Then use it in tests:

```typescript
cy.fillContactForm('Test User', 'test@example.com', 'Test Subject', 'Test Message');
```

## Best Practices

1. **Use data attributes for testing**:
   Add `data-cy` attributes to elements specifically for testing:

   ```html
   <button data-cy="submit-button">Submit</button>
   ```

   Then select using: `cy.get('[data-cy="submit-button"]')`

2. **Mock network requests**:
   Use `cy.intercept()` to mock API responses for faster, more reliable tests

3. **Avoid using hardcoded waits**:
   Instead of `cy.wait(1000)`, use `cy.wait('@request')` or assertions

4. **Keep tests independent**:
   Each test should not depend on the state from previous tests

5. **Clean up after tests**:
   Reset application state between tests (clear localStorage, cookies, etc.)

## Debugging

1. **Use .debug()**:

   ```typescript
   cy.get('selector').debug();
   ```

2. **Time Travel**:
   Use the Cypress UI to time-travel through test steps

3. **Screenshots and videos**:
   Cypress automatically captures screenshots on failures
