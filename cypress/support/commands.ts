// cypress/support/commands.ts
// ***********************************************
// Custom commands for Cypress tests
// ***********************************************

/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to fill out the contact form
       * @example cy.fillContactForm('John Doe', 'john@example.com', 'Test Subject', 'Test Message')
       */
      fillContactForm(name: string, email: string, subject: string, message: string): Chainable<JQuery<HTMLElement>>;
      
      /**
       * Custom command to check if form has validation errors
       * @example cy.hasFormErrors()
       */
      hasFormErrors(): Chainable<JQuery<HTMLElement>>;
      
      /**
       * Custom command to check if submission was successful
       * @example cy.hasSuccessMessage()
       */
      hasSuccessMessage(): Chainable<JQuery<HTMLElement>>;
      
      /**
       * Custom command to setup saved form data
       * @example cy.setupSavedFormData({ name: 'John', email: 'john@example.com' })
       */
      setupSavedFormData(data: any): Chainable<Window>;
      
      /**
       * Custom command to simulate tab key press for keyboard navigation testing
       * @example cy.tabKey()
       */
      tabKey(): Chainable<JQuery<HTMLElement>>;
    }
  }
}

// Custom command to fill out the contact form
Cypress.Commands.add(
  'fillContactForm',
  (name: string, email: string, subject: string, message: string) => {
    if (name) cy.get('[data-cy="input-name"]').clear().type(name);
    if (email) cy.get('[data-cy="input-email"]').clear().type(email);
    if (subject) cy.get('[data-cy="input-subject"]').clear().type(subject);
    if (message) cy.get('[data-cy="input-message"]').clear().type(message);
  }
);

// Custom command to check if form has validation errors
Cypress.Commands.add('hasFormErrors', () => {
  // Check for any error message
  cy.get('[data-cy="error-message"]').should('be.visible');
  // Or check for the built-in class
  cy.get('.error-message').should('be.visible');
});

// Custom command to check if submission was successful
Cypress.Commands.add('hasSuccessMessage', () => {
  // Look for multiple possible success messages
  cy.get('[data-cy="success-message"]').should('be.visible');
  // Or fallback to text content
  cy.contains(/Thank you|Message sent/).should('be.visible');
});

// Custom command to setup saved form data
Cypress.Commands.add('setupSavedFormData', (data: any) => {
  cy.window().then((win) => {
    const formData = {
      name: data.name || '',
      email: data.email || '',
      subject: data.subject || '',
      message: data.message || '',
      timestamp: data.timestamp || Date.now(),
    };
    win.localStorage.setItem('contact_form_draft', JSON.stringify(formData));
  });
});

// Custom command for simulating tab key press
Cypress.Commands.add('tabKey', () => {
  cy.focused().trigger('keydown', { 
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    which: 9,
    bubbles: true 
  });
  return cy.wait(100).focused(); // Give browser time to process the tab event
});

export {};