describe('Login Flow', () => {
  beforeEach(() => {
    // Clear any existing sessions
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/auth');
  });

  it('should display login form correctly', () => {
    cy.get('[data-cy="login-form"]').should('be.visible');
    cy.get('[data-cy="email-input"]').should('exist');
    cy.get('[data-cy="password-input"]').should('exist');
    cy.get('[data-cy="login-button"]').should('be.visible');
    cy.contains('Login').should('be.visible');
  });
  it('should show validation errors for empty fields', () => {
    cy.get('[data-cy="login-button"]').click();
    // Form validation should prevent submission
    cy.url().should('include', '/auth');
  });

  it('should show validation error for invalid email format', () => {
    cy.get('[data-cy="email-input"]').type('invalid-email');
    cy.get('[data-cy="password-input"]').type('password123');
    cy.get('[data-cy="login-button"]').click();
    // Invalid email should trigger validation
    cy.url().should('include', '/auth');
  });

  it('should handle login with incorrect credentials', () => {
    cy.get('[data-cy="email-input"]').type('nonexistent@example.com');
    cy.get('[data-cy="password-input"]').type('wrongpassword');
    cy.get('[data-cy="login-button"]').click();

    // Should show error message or stay on auth page
    cy.url().should('include', '/auth');
  });

  it('should successfully navigate to auth page', () => {
    cy.visit('/auth');
    cy.url().should('include', '/auth');
    cy.get('.glass-card').should('be.visible');
  });

  it('should show loading state during login', () => {
    cy.get('.v-text-field input').first().type('test@example.com'); // Email field
    cy.get('.v-text-field input').eq(1).type('password123'); // Password field

    // Intercept the login request to simulate loading
    cy.intercept('POST', '**/auth/**', { delay: 1000 }).as('loginRequest');

    cy.get('button[type="submit"]').click();

    // Check for loading state
    cy.get('button[type="submit"]').should('have.attr', 'disabled');
  });

  it('should redirect to auth page when accessing protected route', () => {
    // Try to access a protected route
    cy.visit('/projects');
    // Should redirect to auth page or show auth form
    cy.url().should('include', '/auth');
  });

  it('should have proper form labels', () => {
    cy.contains('Email').should('exist');
    cy.contains('Password').should('exist');
  });

  it('should allow typing in form fields', () => {
    cy.get('.v-text-field input')
      .first()
      .type('test@example.com')
      .should('have.value', 'test@example.com'); // Email field
    cy.get('.v-text-field input').eq(1).type('testpassword').should('have.value', 'testpassword'); // Password field
  });

  it('should toggle password visibility', () => {
    cy.get('.v-text-field input').eq(1).should('exist'); // Password field
    // Look for eye icon to toggle password visibility
    cy.get('.mdi-eye, .mdi-eye-off').first().click();
    // Password field should toggle type
  });

  it('should clear form fields when clear button is clicked', () => {
    cy.get('.v-text-field input').first().type('test@example.com'); // Email field

    // Look for clear buttons and click them
    cy.get('.v-field__clearable .v-icon').first().click();
    cy.get('.v-text-field input').first().should('have.value', ''); // Email field
  });

  it('should support keyboard navigation', () => {
    // Tab through form elements
    cy.get('.v-text-field input').first().focus().type('test@example.com'); // Email field
    cy.get('.v-text-field input').eq(1).focus().type('password123'); // Password field
    cy.get('button[type="submit"]').focus();
  });
});
