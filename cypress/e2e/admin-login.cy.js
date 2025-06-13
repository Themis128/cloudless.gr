// Example test: Admin login page loads and login form is present

describe('Admin Login', () => {
  it('should display the admin login form', () => {
    cy.visit('/admin/login')
    cy.get('form').should('exist')
  })
})
