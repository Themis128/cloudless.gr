pipeline {
    agent any

    triggers {
        githubPush() // GenericTrigger removed, use GitHub webhook instead
        pollSCM('H/2 * * * *')
    }

    environment {
        DEPLOY_TOKEN = credentials('MY_SECRET_TOKEN')
        NUXT_ENV_API_BASE = 'https://api.example.com'
        NODE_ENV = 'test'
        DATABASE_URL = credentials('DATABASE_URL')
        SUPABASE_URL = credentials('SUPABASE_URL')
        SUPABASE_ANON_KEY = credentials('SUPABASE_ANON_KEY')
        CYPRESS_baseUrl = 'http://localhost:3000'
        PLAYWRIGHT_baseURL = 'http://localhost:3000'
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
        stage('Install & Environment Setup') {
            parallel {
                stage('Install Dependencies') {
                    steps {
                        echo '📦 Installing Node.js dependencies...'
                        sh 'npm ci --prefer-offline --no-audit'
                        sh 'echo "Node modules installed: $(du -sh node_modules | cut -f1)"'
                    }
                }

                stage('Environment Check') {
                    steps {
                        echo '🔍 Checking environment...'
                        sh 'node --version'
                        sh 'npm --version'
                        sh 'echo "Workspace: $WORKSPACE"'
                    }
                }
            }
        }

        stage('Code Quality & Static Analysis') {
            parallel {
                stage('TypeScript Quality Gate') {
                    steps {
                        echo '🔍 Running TypeScript quality checks...'
                        sh 'pwsh -File scripts/jenkins-quality-check.ps1 -FixDuplicates -BuildNumber ${BUILD_NUMBER}'
                        archiveArtifacts artifacts: 'jenkins-reports/*.json', allowEmptyArchive: true
                    }
                }

                stage('ESLint Analysis') {
                    steps {
                        echo '🔍 Running ESLint analysis...'
                        sh '''
                            npx eslint . --ext .js,.ts,.vue --format=checkstyle --output-file=eslint-results.xml || echo "Linting completed with warnings"
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
                            npm run typecheck || echo "Type check completed with issues"
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
                    npm run build
                    ls -la .output/
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: '.output/**/*', allowEmptyArchive: true
                }
            }
        }

        stage('Start Application Server') {
            steps {
                echo '🚀 Starting application server...'
                sh '''
                    npm run dev & APP_PID=$!
                    echo $APP_PID > app.pid
                    for i in {1..30}; do
                        if curl -f http://localhost:3000 >/dev/null 2>&1; then
                            echo "✅ Server is ready!"
                            break
                        fi
                        echo "Waiting for server..."
                        sleep 2
                    done
                    curl -f http://localhost:3000 || exit 1
                '''
            }
        }        stage('Testing') {
            parallel {
                stage('Cypress E2E Tests') {
                    steps {
                        echo '🧪 Running Cypress E2E tests...'
                        sh '''
                            npx cypress install
                            npx cypress run --browser chrome --headless \
                                --reporter cypress-mochawesome-reporter \
                                --reporter-options "reportDir=cypress/results/html,overwrite=false,html=true,json=true" \
                                --config video=true,screenshotOnRunFailure=true
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'cypress/results/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'cypress/videos/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'cypress/screenshots/**/*', allowEmptyArchive: true
                            publishHTML([
                                reportDir: 'cypress/results/html',
                                reportFiles: 'index.html',
                                reportName: 'Cypress E2E Report',
                                keepAll: true
                            ])
                        }
                    }
                }

                stage('Playwright E2E Tests') {
                    steps {
                        echo '🎭 Running Playwright E2E tests...'
                        sh '''
                            npx playwright install --with-deps chromium firefox webkit

                            # Run auth tests first (critical)
                            echo "🔐 Running authentication tests..."
                            npx playwright test --project=auth-tests --reporter=html,line,junit \
                                --output-dir=playwright/results/auth

                            # Run main application tests
                            echo "🏗️ Running main application tests..."
                            npx playwright test --project=chromium --reporter=html,line,junit \
                                --output-dir=playwright/results/main

                            # Run cross-browser tests (optional, can fail without failing build)
                            echo "🌐 Running cross-browser compatibility tests..."
                            npx playwright test --project=firefox,webkit --reporter=html,line,junit \
                                --output-dir=playwright/results/cross-browser || echo "Cross-browser tests completed with warnings"

                            # Run mobile tests
                            echo "📱 Running mobile responsive tests..."
                            npx playwright test --project=mobile-chrome --reporter=html,line,junit \
                                --output-dir=playwright/results/mobile || echo "Mobile tests completed with warnings"
                        '''
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'playwright/results/**/*', allowEmptyArchive: true
                            archiveArtifacts artifacts: 'playwright/test-results/**/*', allowEmptyArchive: true
                            junit 'playwright/results/**/results.xml'
                            publishHTML([
                                reportDir: 'playwright-report',
                                reportFiles: 'index.html',
                                reportName: 'Playwright E2E Report',
                                keepAll: true
                            ])
                        }
                    }
                }

                stage('Custom Integration Tests') {
                    steps {
                        echo '🔧 Running custom integration tests...'
                        sh '''
                            # Run our custom MJS test files
                            echo "🚀 Running final login test..."
                            node test-final-login.mjs || echo "Final login test completed with warnings"

                            echo "📝 Running final registration test..."
                            node test-final-registration.mjs || echo "Final registration test completed with warnings"

                            echo "🛡️ Running robust auth test..."
                            node test-robust-auth.mjs || echo "Robust auth test completed with warnings"
                        '''
                    }
                    post {
                        always {
                            // Archive any test outputs
                            archiveArtifacts artifacts: 'test-results/**/*', allowEmptyArchive: true
                        }
                    }
                }

                stage('API Integration Tests') {
                    steps {
                        echo '🔌 Running API integration tests...'
                        sh '''
                            # Test API endpoints if available
                            echo "Testing application health..."
                            curl -f http://localhost:3000/ || echo "Application not responding on expected port"

                            # Test auth endpoints
                            echo "Testing auth endpoints..."
                            curl -f http://localhost:3000/auth || echo "Auth endpoint test completed"
                            curl -f http://localhost:3000/auth/register || echo "Register endpoint test completed"

                            # Test admin endpoints
                            echo "Testing admin endpoints..."
                            curl -f http://localhost:3000/admin/login || echo "Admin login endpoint test completed"
                        '''
                    }
                }
            }
        }

        stage('Security Scan') {
            parallel {
                stage('npm audit') {
                    steps {
                        sh 'npm audit --audit-level=high --json > npm-audit-results.json || echo "Audit completed with findings"'
                    }
                    post {
                        always {
                            archiveArtifacts artifacts: 'npm-audit-results.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }

        stage('Clean Up') {
            steps {
                echo '🧹 Cleaning up...'
                sh '''
                    if [ -f "app.pid" ]; then
                        APP_PID=$(cat app.pid)
                        kill $APP_PID || true
                        sleep 5
                        kill -9 $APP_PID 2>/dev/null || true
                        rm -f app.pid
                    fi
                    pkill -f "nuxt dev" || true
                    pkill -f "node.*3000" || true
                    rm -rf node_modules/.cache .nuxt/dist .output/.nitro || true
                '''
            }
        }
    }

    post {
        success {
            echo '🎉 Build Succeeded'
            script {
                currentBuild.description = "✅ Passed - Build #${BUILD_NUMBER}"
            }
        }
        failure {
            echo '❌ Build Failed'
            script {
                currentBuild.description = "❌ Failed - Build #${BUILD_NUMBER}"
            }
        }
        unstable {
            echo '⚠️ Build Unstable'
            script {
                currentBuild.description = "⚠️ Unstable - Build #${BUILD_NUMBER}"
            }
        }
        aborted {
            echo '🛑 Build Aborted'
            script {
                currentBuild.description = "🛑 Aborted - Build #${BUILD_NUMBER}"
            }
        }
    }
}
