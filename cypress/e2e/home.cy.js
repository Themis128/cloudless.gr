// Example test: Home page loads and displays hero section

describe('Home Page', () => {
  it('should display the hero section correctly', () => {
    cy.visit('/');
    cy.contains('Cloudless: Power Without the Code').should('be.visible');
    cy.contains('Run powerful analytics and cloud workflows with clicks, not code').should(
      'be.visible',
    );
    cy.contains('Try It Free').should('be.visible');
    cy.contains('Learn More').should('be.visible');
  });
});
