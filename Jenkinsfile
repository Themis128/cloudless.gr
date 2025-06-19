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
    }    stage('TypeScript Quality Gate') {
      steps {
        script {
          // Run enhanced TypeScript quality check with auto-fix
          def result = sh(
            script: 'pwsh -File scripts/jenkins-quality-check.ps1 -FixDuplicates -BuildNumber ${BUILD_NUMBER}',
            returnStatus: true
          )

          // Archive quality reports
          archiveArtifacts artifacts: 'jenkins-reports/*.json', allowEmptyArchive: true

          // Set build status based on quality score
          if (result == 0) {
            echo "✅ TypeScript Quality Gate: PASSED"
          } else {
            currentBuild.result = 'UNSTABLE'
            echo "⚠️ TypeScript Quality Gate: Quality score below threshold - Build marked as unstable"
          }
        }
      }
      post {
        always {
          // Archive all TypeScript logs
          archiveArtifacts artifacts: 'typescript-*.log', allowEmptyArchive: true

          // Publish TypeScript trends
          script {
            if (fileExists('typescript-initial.log')) {
              def initialErrors = sh(
                script: 'grep "Found.*errors" typescript-initial.log | tail -1 | grep -o "[0-9]\\+" || echo "0"',
                returnStdout: true
              ).trim()

              def finalErrors = initialErrors
              if (fileExists('typescript-post-fix.log')) {
                finalErrors = sh(
                  script: 'grep "Found.*errors" typescript-post-fix.log | tail -1 | grep -o "[0-9]\\+" || echo "0"',
                  returnStdout: true
                ).trim()
              }

              // Update build description with error trends
              currentBuild.description = "TS Errors: ${initialErrors} → ${finalErrors}"

              // Create build badge
              addShortText text: "TS: ${finalErrors}",
                          color: finalErrors.toInteger() == 0 ? "green" :
                                finalErrors.toInteger() < 10 ? "yellow" : "red"
            }
          }
        }
      }
    }

    stage('Lint') {
      steps {
        sh 'npx eslint . --format=checkstyle --output-file=eslint-results.xml || echo "Linting completed with warnings"'
      }
      post {
        always {
          recordIssues enabledForFailure: true, tools: [checkStyle(pattern: 'eslint-results.xml')]
        }
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
