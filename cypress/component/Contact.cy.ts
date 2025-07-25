// cypress/component/Contact.cy.ts
describe('Contact Component', () => {
  beforeEach(() => {
    // For component tests, we should mount the component instead of visiting a URL
    // Since this is a Nuxt component, we'll use the e2e test approach temporarily
    // until we set up proper component testing with Vue component testing library
    cy.visit('/contact');
  });
  it('renders properly', () => {
    // Basic assertions
    cy.get('form').should('be.visible');
    cy.get('[data-cy="input-name"]').should('be.visible');
    cy.get('[data-cy="input-email"]').should('be.visible');
    cy.get('[data-cy="input-subject"]').should('be.visible');
    cy.get('[data-cy="input-message"]').should('be.visible');
  });
  it('shows validation errors', () => {
    // Try to submit without data
    cy.get('[data-cy="submit-button"]').click();

    // Check for errors
    cy.hasFormErrors();
  });

  it('submits form successfully', () => {
    // Intercept API call
    cy.intercept('POST', '/api/contact', {
      statusCode: 200,
      body: { success: true },
    }).as('contactSubmit');

    // Fill and submit form using custom command
    cy.fillContactForm(
      'Test User',
      'test@example.com',
      'Component Test',
      'This is a test message from Cypress component test'
    );    // Submit
    cy.get('[data-cy="submit-button"]').click();

    // Wait for response
    cy.wait('@contactSubmit');

    // Check success message
    cy.hasSuccessMessage();
  });
});
