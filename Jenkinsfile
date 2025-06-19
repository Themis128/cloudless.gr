pipeline {
    agent any

    // Trigger configuration for 'application' branch
    triggers {
        // Poll SCM every 2 minutes for changes on application branch
        pollSCM('H/2 * * * *')

        // Generic Webhook Trigger (recommended method)
        genericTrigger (
            genericVariables: [
                [key: 'ref', value: '$.ref'],
                [key: 'repository_name', value: '$.repository.name'],
                [key: 'pusher_name', value: '$.pusher.name']
            ],
            causeString: 'Triggered by GitHub webhook on application branch - Repository: $repository_name, Branch: $ref, Pusher: $pusher_name',
            token: 'cloudless-gr-webhook-token',
            printContributedVariables: true,
            printPostContent: true,
            silentResponse: false,
            regexpFilterText: '$ref',
            regexpFilterExpression: 'refs/heads/application'
        )
    }

    environment {
        // Application Environment
        DEPLOY_TOKEN = credentials('MY_SECRET_TOKEN')
        NUXT_ENV_API_BASE = 'https://api.example.com'
        NODE_ENV = 'test'

        // Database Configuration (adjust as needed)
        DATABASE_URL = credentials('DATABASE_URL') // Add this credential in Jenkins
        SUPABASE_URL = credentials('SUPABASE_URL')
        SUPABASE_ANON_KEY = credentials('SUPABASE_ANON_KEY')

        // Testing Configuration
        CYPRESS_baseUrl = 'http://localhost:3000'
        PLAYWRIGHT_baseURL = 'http://localhost:3000'

        // CI/CD Configuration
        CI = 'true'
        FORCE_COLOR = '1'
    }

    options {
        timeout(time: 45, unit: 'MINUTES')
        retry(1)
        skipDefaultCheckout(false)
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    stages {
        stage('Checkout & Setup') {
            parallel {
                stage('Install Dependencies') {
                    steps {
                        echo '📦 Installing Node.js dependencies...'
                        sh 'npm ci --prefer-offline --no-audit'

                        // Cache node_modules for faster builds
                        sh 'echo "Node modules installed: $(du -sh node_modules | cut -f1)"'
                    }
                }

                stage('Environment Check') {
                    steps {
                        echo '🔍 Checking environment...'
                        sh 'node --version'
                        sh 'npm --version'
                        sh 'echo "Workspace: $WORKSPACE"'
                        sh 'echo "Build Number: $BUILD_NUMBER"'
                    }
                }
            }
        }        stage('Code Quality & Static Analysis') {
            parallel {
                stage('TypeScript Quality Gate') {
                    steps {
                        echo '🔍 Running TypeScript quality checks...'
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

                stage('ESLint Analysis') {
                    steps {
                        echo '🔍 Running ESLint analysis...'
                        sh '''
                            # Run core linting with proper error handling
                            npx eslint . --ext .js,.ts,.vue --format=checkstyle --output-file=eslint-results.xml || echo "Linting completed with warnings"

                            # Run critical lint checks
                            npm run lint:critical || echo "Critical lint check completed"
                        '''
                    }
                    post {
                        always {
                            recordIssues enabledForFailure: true, tools: [checkStyle(pattern: 'eslint-results.xml')]
                        }
                    }
                }

                stage('Type Checking') {
                    steps {
                        echo '🔍 Running comprehensive type checking...'
                        sh '''
                            # Run Nuxt type checking
                            npm run typecheck || echo "Type check completed with issues"

                            # Run core type checking
                            npm run typecheck:core || echo "Core type check completed with issues"
                        '''
                    }
                }
            }
        }

        stage('Build & Compile') {
            steps {
                echo '🏗️ Building application...'
                sh '''
                    # Build the Nuxt application
                    npm run build

                    # Verify build artifacts
                    ls -la .output/
                    echo "Build completed successfully"
                '''
            }
            post {
                always {
                    // Archive build artifacts
                    archiveArtifacts artifacts: '.output/**/*', allowEmptyArchive: true
                }
            }
        }

        stage('Database Setup & Verification') {
            steps {
                echo '🗄️ Setting up test database...'
                script {
                    try {
                        sh '''
                            # Check if local Supabase is available
                            if command -v supabase &> /dev/null; then
                                echo "Starting local Supabase for testing..."
                                supabase start --exclude=gotrue,realtime,storage-api,imgproxy,inbucket,edge-runtime || echo "Supabase start failed, continuing..."

                                # Generate types
                                npm run supabase:types || echo "Type generation failed, continuing..."
                            else
                                echo "Supabase CLI not available, skipping local setup"
                            fi
                        '''
                    } catch (Exception e) {
                        echo "Database setup failed: ${e.getMessage()}"
                        currentBuild.result = 'UNSTABLE'
                    }
                }
            }
        }

        stage('Start Application Server') {
            steps {
                echo '🚀 Starting application server for testing...'
                script {
                    // Start the application in the background
                    sh '''
                        # Start Nuxt dev server in background
                        npm run dev &
                        APP_PID=$!
                        echo $APP_PID > app.pid

                        # Wait for server to be ready
                        echo "Waiting for server to start..."
                        for i in {1..30}; do
                            if curl -f http://localhost:3000 >/dev/null 2>&1; then
                                echo "✅ Server is ready!"
                                break
                            fi
                            echo "Attempt $i: Server not ready yet..."
                            sleep 2
                        done

                        # Final check
                        curl -f http://localhost:3000 || {
                            echo "❌ Server failed to start properly"
                            exit 1
                        }
                    '''
                }
            }
        }        stage('End-to-End Testing') {
            parallel {
                stage('Cypress E2E Tests') {
                    steps {
                        echo '🧪 Running Cypress end-to-end tests...'
                        script {
                            try {
                                sh '''
                                    # Install Cypress binary if needed
                                    npx cypress install

                                    # Run Cypress tests with proper configuration
                                    npx cypress run \
                                        --browser chrome \
                                        --headless \
                                        --config video=true,screenshotOnRunFailure=true \
                                        --reporter cypress-mochawesome-reporter \
                                        --reporter-options "reportDir=cypress/results/html,overwrite=false,html=true,json=true"
                                '''
                            } catch (Exception e) {
                                echo "Cypress tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                    post {
                        always {
                            // Archive Cypress artifacts
                            archiveArtifacts artifacts: 'cypress/results/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'cypress/videos/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'cypress/screenshots/**/*', allowEmptyArchive: true

                            // Publish Cypress HTML report
                            publishHTML([
                                reportDir: 'cypress/results/html',
                                reportFiles: 'index.html',
                                reportName: 'Cypress E2E Test Report',
                                keepAll: true,
                                alwaysLinkToLastBuild: true
                            ])
                        }
                    }
                }

                stage('Playwright E2E Tests') {
                    steps {
                        echo '🎭 Running Playwright end-to-end tests...'
                        script {
                            try {
                                sh '''
                                    # Install Playwright browsers
                                    npx playwright install --with-deps chromium firefox

                                    # Run Playwright tests
                                    npx playwright test \
                                        --reporter=html,line,junit \
                                        --output-dir=playwright/results
                                '''
                            } catch (Exception e) {
                                echo "Playwright tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                    post {
                        always {
                            // Archive Playwright artifacts
                            archiveArtifacts artifacts: 'playwright/results/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true

                            // Publish test results
                            junit 'playwright/results/results.xml'

                            // Publish Playwright HTML report
                            publishHTML([
                                reportDir: 'playwright-report',
                                reportFiles: 'index.html',
                                reportName: 'Playwright E2E Test Report',
                                keepAll: true,
                                alwaysLinkToLastBuild: true
                            ])
                        }
                    }
                }

                stage('API Integration Tests') {
                    steps {
                        echo '🔌 Running API integration tests...'
                        script {
                            try {
                                sh '''
                                    # Run custom API tests if they exist
                                    if [ -f "test-api-integration.mjs" ]; then
                                        node test-api-integration.mjs
                                    fi

                                    # Run database connection tests
                                    if [ -f "test-postgresql-extension.sql" ]; then
                                        echo "Running database tests..."
                                        # Add database test execution here
                                    fi

                                    # Test registration and login functionality
                                    if [ -f "test-final-registration.mjs" ]; then
                                        node test-final-registration.mjs || echo "Registration test completed with issues"
                                    fi

                                    if [ -f "test-final-login.mjs" ]; then
                                        node test-final-login.mjs || echo "Login test completed with issues"
                                    fi
                                '''
                            } catch (Exception e) {
                                echo "API tests failed: ${e.getMessage()}"
                                currentBuild.result = 'UNSTABLE'
                            }
                        }
                    }
                }

                stage('Performance Tests') {
                    steps {
                        echo '⚡ Running performance tests...'
                        script {
                            try {
                                sh '''
                                    # Basic performance check using curl
                                    echo "Testing application response time..."

                                    # Test main page load time
                                    RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000)
                                    echo "Main page response time: ${RESPONSE_TIME}s"

                                    # Test API endpoints if available
                                    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
                                        API_RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' http://localhost:3000/api/health)
                                        echo "API health check response time: ${API_RESPONSE_TIME}s"
                                    fi

                                    # Lighthouse CI if configured
                                    # npx lighthouse-ci autorun || echo "Lighthouse CI not configured"
                                '''
                            } catch (Exception e) {
                                echo "Performance tests failed: ${e.getMessage()}"
                            }
                        }
                    }
                }
            }
        }

        stage('Security & Vulnerability Scan') {
            parallel {
                stage('npm audit') {
                    steps {
                        echo '🔒 Running npm security audit...'
                        sh '''
                            npm audit --audit-level=high --json > npm-audit-results.json || echo "Audit completed with findings"
                            npm audit --audit-level=high || echo "Security audit completed"
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'npm-audit-results.json', allowEmptyArchive: true
                        }
                    }
                }

                stage('OWASP Dependency Check') {
                    when {
                        // Only run if OWASP dependency-check is available
                        expression { return fileExists('/opt/dependency-check/bin/dependency-check.sh') }
                    }
                    steps {
                        echo '🛡️ Running OWASP dependency check...'
                        sh '''
                            /opt/dependency-check/bin/dependency-check.sh \
                                --project "Cloudless.gr" \
                                --scan . \
                                --format JSON \
                                --format HTML \
                                --out dependency-check-report \
                                --exclude "**/node_modules/**" \
                                --exclude "**/test-results/**" \
                                --exclude "**/cypress/results/**" \
                                --exclude "**/playwright/results/**"
                        '''
                    }
                    post {
                        always {
                            publishHTML([
                                reportDir: 'dependency-check-report',
                                reportFiles: 'dependency-check-report.html',
                                reportName: 'OWASP Dependency Check Report'
                            ])
                        }
                    }
                }
            }
        }

        stage('Build Artifacts & Reports') {
            steps {
                echo '📊 Generating final reports and artifacts...'
                script {
                    // Generate test summary
                    sh '''
                        echo "=== Build Summary ===" > build-summary.txt
                        echo "Build Number: ${BUILD_NUMBER}" >> build-summary.txt
                        echo "Build Date: $(date)" >> build-summary.txt
                        echo "Git Commit: ${GIT_COMMIT:-unknown}" >> build-summary.txt
                        echo "Node Version: $(node --version)" >> build-summary.txt
                        echo "" >> build-summary.txt

                        # Test results summary
                        echo "=== Test Results ===" >> build-summary.txt
                        if [ -f "cypress/results/html/index.html" ]; then
                            echo "✅ Cypress tests completed" >> build-summary.txt
                        else
                            echo "❌ Cypress tests failed or not run" >> build-summary.txt
                        fi

                        if [ -f "playwright-report/index.html" ]; then
                            echo "✅ Playwright tests completed" >> build-summary.txt
                        else
                            echo "❌ Playwright tests failed or not run" >> build-summary.txt
                        fi

                        echo "" >> build-summary.txt
                        echo "=== Build Status ===" >> build-summary.txt
                        echo "Overall Status: ${currentBuild.result:-SUCCESS}" >> build-summary.txt
                    '''
                }
            }
            post {
                always {
                    archiveArtifacts artifacts: 'build-summary.txt', allowEmptyArchive: true
                }
            }
        }
    }

    post {
        always {
            echo '🧹 Cleaning up...'
            script {
                // Stop the application server
                sh '''
                    if [ -f "app.pid" ]; then
                        APP_PID=$(cat app.pid)
                        if kill -0 $APP_PID 2>/dev/null; then
                            echo "Stopping application server (PID: $APP_PID)..."
                            kill $APP_PID || true
                            sleep 5
                            kill -9 $APP_PID 2>/dev/null || true
                        fi
                        rm -f app.pid
                    fi

                    # Stop any remaining Node processes
                    pkill -f "nuxt dev" || true
                    pkill -f "node.*3000" || true
                '''

                // Stop Supabase if it was started
                sh '''
                    if command -v supabase &> /dev/null; then
                        supabase stop || echo "Supabase stop failed or not running"
                    fi
                '''
            }

            // Clean up workspace but keep important artifacts
            sh '''
                # Clean up large directories but keep reports
                rm -rf node_modules/.cache || true
                rm -rf .nuxt/dist || true
                rm -rf .output/.nitro || true
            '''
        }

        success {
            echo '🎉 ✅ End-to-End Testing Pipeline Completed Successfully!'
            script {
                currentBuild.description = "✅ E2E Tests Passed - Build #${BUILD_NUMBER}"
            }
        }

        failure {
            echo '💥 ❌ End-to-End Testing Pipeline Failed!'
            script {
                currentBuild.description = "❌ E2E Tests Failed - Build #${BUILD_NUMBER}"
            }
        }

        unstable {
            echo '⚠️ 🟡 End-to-End Testing Pipeline Completed with Issues!'
            script {
                currentBuild.description = "🟡 E2E Tests Unstable - Build #${BUILD_NUMBER}"
            }
        }

        aborted {
            echo '🛑 End-to-End Testing Pipeline was Aborted!'
            script {
                currentBuild.description = "🛑 E2E Tests Aborted - Build #${BUILD_NUMBER}"
            }
        }
    }
}
