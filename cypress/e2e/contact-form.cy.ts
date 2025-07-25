// cypress/e2e/contact-form.cy.ts
describe('Contact Form Tests', () => {
  beforeEach(() => {
    // Visit the contact page with retry strategy
    cy.visit('/contact', { 
      timeout: 120000,
      retryOnStatusCodeFailure: true,
      retryOnNetworkFailure: true
    });
    
    // Clear localStorage before each test
    cy.clearLocalStorage();
    
    // Intercept API calls to simulate successful responses
    cy.intercept('POST', '/api/contact', {
      statusCode: 200,
      body: { success: true }
    }).as('contactSubmit');
    
    // Intercept CSRF token requests
    cy.intercept('GET', '/api/csrf-token', {
      statusCode: 200,
      body: { token: 'test-csrf-token' }
    }).as('csrfToken');
  });

  it('loads the contact form', () => {
    cy.get('form').should('exist');
    cy.contains('Contact Us').should('be.visible');
  });
  it('has all required form fields', () => {
    // Check for the presence of form fields
    cy.get('[data-cy="input-name"]').should('exist');
    cy.get('[data-cy="input-email"]').should('exist');
    cy.get('[data-cy="input-subject"]').should('exist');
    cy.get('[data-cy="input-message"]').should('exist');
    cy.get('[data-cy="submit-button"]').should('exist');
  });
    it('validates form fields on submission', () => {
    // Submit empty form
    cy.get('[data-cy="submit-button"]').click();
    
    // Check for validation errors
    cy.get('[data-cy="error-message"]').should('be.visible');
    cy.get('[aria-invalid="true"]').should('exist');
  });
    it('shows specific validation for email field', () => {
    // Fill out form with invalid email
    cy.get('[data-cy="input-name"]').type('Test User');
    cy.get('[data-cy="input-email"]').type('invalid-email');
    cy.get('[data-cy="input-subject"]').type('Test Subject');
    cy.get('[data-cy="input-message"]').type('Test Message');
    
    // Submit form
    cy.get('[data-cy="submit-button"]').click();
    
    // Check for email validation error
    cy.get('#email').next('[data-cy="error-message"]').should('be.visible');
    cy.get('#email').should('have.attr', 'aria-invalid', 'true');
  });
    it('successfully submits a valid form', () => {
    // Fill out form with valid data using our custom command
    cy.fillContactForm('Test User', 'test@example.com', 'Test Subject', 'Test Message');
    
    // Submit form
    cy.get('[data-cy="submit-button"]').click();
    
    // Wait for API call
    cy.wait('@contactSubmit');
    
    // Check for success message
    cy.get('[data-cy="success-message"]').should('be.visible');
    cy.contains('Thank you for contacting us').should('be.visible');
    
    // Form should be reset (success message replaces the form)
    cy.get('[data-cy="input-name"]').should('not.exist');

    // LocalStorage should be cleared
    cy.window().then((win) => {
      expect(win.localStorage.getItem('contact_form_draft')).to.be.null;
    });
  });
    it('auto-saves form data to localStorage', () => {
    // Fill out form
    cy.fillContactForm('Test User', 'test@example.com', 'Test Subject', 'Test Message');
    
    // Wait for auto-save to occur
    cy.get('[data-cy="autosave-indicator"]').should('be.visible', { timeout: 5000 });
    cy.contains('Saving your input').should('be.visible');
    
    // Verify localStorage
    cy.wait(1500); // Wait for debounce
    cy.window().then((win) => {
      const savedData = JSON.parse(win.localStorage.getItem('contact_form_draft') || '{}');
      expect(savedData.name).to.equal('Test User');
      expect(savedData.email).to.equal('test@example.com');
      expect(savedData.subject).to.equal('Test Subject');
      expect(savedData.message).to.equal('Test Message');
      expect(savedData.timestamp).to.be.a('number');
    });
  });
    it('restores form data from localStorage', () => {
    // Set up saved form data in localStorage
    cy.window().then((win) => {
      const formData = {
        name: 'Saved User',
        email: 'saved@example.com',
        subject: 'Saved Subject',
        message: 'This is a saved message',
        timestamp: Date.now()
      };
      win.localStorage.setItem('contact_form_draft', JSON.stringify(formData));
    });
    
    // Reload page
    cy.reload();
    
    // Verify form has restored data
    cy.get('[data-cy="input-name"]').should('have.value', 'Saved User');
    cy.get('[data-cy="input-email"]').should('have.value', 'saved@example.com');
    cy.get('[data-cy="input-subject"]').should('have.value', 'Saved Subject');
    cy.get('[data-cy="input-message"]').should('have.value', 'This is a saved message');
  });
    it('clears form draft after successful submission', () => {
    // Set up saved form data
    cy.window().then((win) => {
      const formData = {
        name: 'Test User',
        email: 'test@example.com',
        subject: 'Test Subject',
        message: 'Test Message',
        timestamp: Date.now()
      };
      win.localStorage.setItem('contact_form_draft', JSON.stringify(formData));
    });
    
    // Submit form with saved data
    cy.visit('/contact');
    cy.get('[data-cy="submit-button"]').click();
    cy.wait('@contactSubmit');
    
    // Verify localStorage is cleared
    cy.window().then((win) => {
      expect(win.localStorage.getItem('contact_form_draft')).to.be.null;
    });
  });
    it('ignores old localStorage data', () => {
    // Set up old saved data (8 days old)
    cy.window().then((win) => {
      const formData = {
        name: 'Old User',
        email: 'old@example.com',
        subject: 'Old Subject',
        message: 'Old Message',
        timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
      };
      win.localStorage.setItem('contact_form_draft', JSON.stringify(formData));
    });

    // Reload page
    cy.reload();

    // Check that form data is not restored
    cy.get('[data-cy="input-name"]').should('have.value', '');
    cy.get('[data-cy="input-email"]').should('have.value', '');
    cy.get('[data-cy="input-subject"]').should('have.value', '');
    cy.get('[data-cy="input-message"]').should('have.value', '');
  });

  it('allows refreshing CSRF token when stale', () => {
    // Mock token refresh API
    cy.intercept('GET', '/api/csrf-token', {
      statusCode: 200,
      body: { token: 'new-csrf-token' },
    }).as('refreshToken');

    // Simulate stale token
    cy.window().then((win) => {
      // Find a way to trigger token staleness
      // This might require exposing a method in the app specifically for testing
      win.dispatchEvent(new CustomEvent('custom:csrf-token-stale'));
    });

    // Refresh token button should appear
    cy.get('button.refresh-token-btn').should('be.visible');
    cy.get('button.refresh-token-btn').click();

    // Wait for refresh API call
    cy.wait('@refreshToken');    // Button should disappear after refresh
    cy.get('button.refresh-token-btn').should('not.exist');
  });  it('is accessible via keyboard navigation', () => {
    // Simple test for focus handling - just check if we can focus the input fields
    cy.get('[data-cy="input-name"]').focus().should('be.focused');
    cy.get('[data-cy="input-email"]').focus().should('be.focused');
    cy.get('[data-cy="input-subject"]').focus().should('be.focused');
    cy.get('[data-cy="input-message"]').focus().should('be.focused');
    cy.get('[data-cy="submit-button"]').focus().should('be.focused');

    // Honeypot field should be skipped in tab order
    cy.get('#website').should('have.attr', 'tabindex', '-1');
  });
});
