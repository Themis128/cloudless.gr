pipeline {
  agent any

  environment {
    DEPLOY_TOKEN = credentials('MY_SECRET_TOKEN')
    NUXT_ENV_API_BASE = 'https://api.example.com'
  }

  stages {
    stage('Install') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Lint') {
      steps {
        sh 'npx eslint .'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Test') {
      steps {
        sh 'echo "Token: $DEPLOY_TOKEN"'
        sh 'npm run test'
      }
      post {
        always {
          junit 'junit.xml'
        }
      }
    }

    stage('Cypress Tests') {
      steps {
        sh 'npx cypress run'
        sh 'npx mochawesome-merge cypress/results/html/.jsons/*.json > cypress/results/html/mochawesome.json'
        sh 'npx mochawesome-report-generator cypress/results/html/mochawesome.json --reportDir cypress/results/html --reportFilename index.html'
      }
    }

    stage('Publish Cypress Report') {
      steps {
        publishHTML([
          reportDir: 'cypress/results/html',
          reportFiles: 'index.html',
          reportName: 'Cypress HTML Report'
        ])
      }
    }

    stage('Playwright Tests') {
      steps {
        sh 'npx playwright test'
      }
    }

    stage('Publish Playwright Report') {
      steps {
        sh 'npx playwright show-report --output=playwright/results/html'
        publishHTML([
          reportDir: 'playwright/results/html',
          reportFiles: 'index.html',
          reportName: 'Playwright HTML Report'
        ])
      }
    }
  }

  post {
    always {
      echo 'Pipeline finished.'
    }
    success {
      echo '✔️ Build passed!'
    }
    failure {
      echo '❌ Build failed.'
    }
  }
}
