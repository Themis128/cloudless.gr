// Cypress test: Check homepage loads and no visible Supabase/database error is shown

describe('Cloudless.gr Homepage', () => {
  it('should load the homepage and not show Supabase/database errors', () => {
    cy.visit('/')
    // Wait for main content to load
    cy.get('.landing-page').should('exist')
    // Check for any visible error banners or messages
    cy.contains(/supabase|database error|schema/i).should('not.exist')
    // Optionally, check for a key section/component
    cy.contains('How It Works').should('exist')
  })
})
