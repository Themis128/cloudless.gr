import { defineConfig } from 'cypress'
import cypressMochawesomeReporter from 'cypress-mochawesome-reporter/plugin.js'

export default defineConfig({
    e2e: {
        setupNodeEvents(on, config) {
            cypressMochawesomeReporter(on)
            return config
        },
        baseUrl: 'http://localhost:3000',
        specPattern: 'cypress/e2e/**/*.cy.{js,ts}'
    },
    reporter: 'cypress-mochawesome-reporter',
    reporterOptions: {
        reportDir: 'cypress/results/html',
        overwrite: false,
        html: true,
        json: true
    }
})
