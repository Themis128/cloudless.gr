// Custom Cypress commands for your app can be added here.
// For example, login as admin:
Cypress.Commands.add('loginAsAdmin', () => {
  cy.visit('/admin/login')
  cy.get('input[type=email]').type(Cypress.env('adminUser'))
  cy.get('input[type=password]').type(Cypress.env('adminPassword'))
  cy.get('button').contains(/login/i).click()
})
