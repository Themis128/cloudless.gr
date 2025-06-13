/// <reference types="cypress" />

describe('Navigation between main pages', () => {
    const pages = [
        { path: '/', label: 'Home' },
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/projects', label: 'Projects' },
        { path: '/storage', label: 'Storage' },
        { path: '/settings', label: 'Settings' },
        { path: '/about', label: 'About' },
        { path: '/contact', label: 'Contact' },
    ];

    pages.forEach(({ path, label }) => {
        it(`should navigate to ${label} page`, () => {
            cy.visit(path);
            cy.url().should('include', path === '/' ? '/' : path);
            // Optionally check for a unique element or heading on each page
            // cy.contains(label, { matchCase: false });
        });
    });
});
