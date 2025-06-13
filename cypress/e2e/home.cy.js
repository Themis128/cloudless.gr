// Example test: Home page loads and displays welcome message

describe('Home Page', () => {
  it('should display the welcome message', () => {
    cy.visit('/')
    cy.contains('Welcome to Cloudless GR').should('be.visible')
  })
})
