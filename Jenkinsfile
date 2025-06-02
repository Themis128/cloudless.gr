pipeline {
  agent any

  environment {
    SUPABASE_HOST = 'supabase'
    SUPABASE_PORT = '54322'
    SUPABASE_USER = 'postgres'
    SUPABASE_PASSWORD = 'supabase_dev'
    SUPABASE_DB = 'postgres'
  }

  stages {
    stage('Check Supabase Health') {
      steps {
        script {
          def health = sh(script: 'pg_isready -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER', returnStatus: true)
          if (health != 0) {
            error('Supabase is not healthy!')
          }
        }
      }
    }
    stage('Wait for Supabase') {
      steps {
        script {
          // Wait for Supabase to be healthy (max 60s)
          sh 'for i in {1..12}; do pg_isready -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER && exit 0 || sleep 5; done; exit 1'
        }
      }
    }
    stage('Run Migrations') {
      steps {
        script {
          // Run all SQL migration scripts in migrations/ (or adjust path as needed)
          sh 'for f in migrations/*.sql; do psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -d $SUPABASE_DB -f $f; done'
        }
      }
    }
    stage('Run Tests') {
      steps {
        sh 'npm install'
        sh 'npm run test:suite'
      }
    }
    stage('Check Prometheus Health') {
      steps {
        script {
          def prometheusHealth = sh(script: 'curl -sf http://prometheus:9090/-/healthy', returnStatus: true)
          if (prometheusHealth != 0) {
            mail to: 'your-team@example.com', subject: 'Prometheus Down', body: 'Prometheus is not healthy! Check http://localhost:9090.'
            error('Prometheus is not healthy!')
          }
        }
      }
    }
    stage('Check Grafana Health') {
      steps {
        script {
          def grafanaHealth = sh(script: 'curl -sf http://grafana:3000/api/health', returnStatus: true)
          if (grafanaHealth != 0) {
            mail to: 'your-team@example.com', subject: 'Grafana Down', body: 'Grafana is not healthy! Check http://localhost:3002.'
            error('Grafana is not healthy!')
          }
        }
      }
    }
    stage('Provision Grafana Dashboards') {
      steps {
        script {
          // Wait for Grafana to be ready
          sh 'for i in {1..12}; do curl -sf http://grafana:3000/api/health && exit 0 || sleep 5; done; exit 1'
          // Import dashboards via API (optional, since provisioning is mounted, but this ensures they are loaded)
          sh 'curl -X POST -H "Content-Type: application/json" -H "Authorization: Basic YWRtaW46YWRtaW4=" --data-binary @platform-overview.json http://grafana:3000/api/dashboards/db || true'
          sh 'curl -X POST -H "Content-Type: application/json" -H "Authorization: Basic YWRtaW46YWRtaW4=" --data-binary @supabase-overview.json http://grafana:3000/api/dashboards/db || true'
        }
      }
    }
    stage('Database Backup') {
      steps {
        script {
          sh 'mkdir -p backups && pg_dump -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -F c -b -v -f backups/backup_$(date +%Y%m%d_%H%M%S).dump $SUPABASE_DB'
          // Optionally upload to S3 or another storage here
        }
      }
    }
    stage('Security Scan') {
      steps {
        sh 'bandit -r backend/'
        sh 'safety check -r requirements.txt'
      }
    }
    stage('Code Quality Gate') {
      steps {
        sh 'black --check backend/'
        sh 'flake8 backend/'
        sh 'mypy backend/'
        sh 'pytest --cov=backend --cov-fail-under=80'
      }
    }
    stage('Dependency Update Report') {
      steps {
        sh 'pip list --outdated > outdated-deps.txt'
        script {
          def outdated = readFile('outdated-deps.txt')
          if (outdated.trim()) {
            mail to: 'your-team@example.com', subject: 'Dependency Update Report', body: outdated
          }
        }
      }
    }
    stage('Automated Test Environment') {
      steps {
        script {
          sh 'docker compose -f docker-compose.dev.yml up -d --build'
          sh 'pytest --junitxml=test-results/testenv.xml || true'
          sh 'docker compose -f docker-compose.dev.yml down'
        }
      }
    }
    stage('Weekly Report') {
      when {
        expression { env.BRANCH_NAME == 'main' && new Date().getDay() == 1 } // Mondays
      }
      steps {
        script {
          def report = readFile('test-results/testenv.xml')
          mail to: 'your-team@example.com', subject: 'Weekly Platform Report', body: report
        }
      }
    }
    stage('Automated Rollback') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          // Zero-downtime rollback using Docker Compose: start previous version, then stop current
          sh '''
            echo "Rolling back to previous stable version with minimal downtime..."
            docker compose -f docker-compose.prod.yml pull app:previous || true
            docker compose -f docker-compose.prod.yml up -d --no-deps --scale app=2 app || true
            sleep 10 # Wait for previous version to be healthy (adjust as needed)
            docker compose -f docker-compose.prod.yml stop app:current || true
            docker compose -f docker-compose.prod.yml up -d --no-deps --scale app=1 app || true
          '''
          mail to: 'your-team@example.com', subject: 'Automated Rollback Triggered', body: 'A rollback was triggered due to failed health checks or metrics. Previous stable version redeployed with minimal downtime.'
        }
      }
    }
    stage('Secrets Management') {
      steps {
        script {
          // Placeholder: In production, fetch secrets from Vault or AWS Secrets Manager
          echo 'Secrets are injected via environment variables.'
        }
      }
    }
    stage('Blue/Green Deploy') {
      steps {
        script {
          // Build and deploy new version to green
          sh 'docker compose -f docker-compose.prod.yml build app-green'
          sh 'docker compose -f docker-compose.prod.yml up -d app-green'
          // Health check green
          sh 'curl -f http://localhost:8080 || exit 1'
          // Switch Nginx to green (edit nginx config)
          sh "sed -i 's/server app-blue/server app-green/g' nginx-bluegreen.conf"
          sh 'docker compose -f docker-compose.prod.yml restart nginx'
          // Optionally, stop blue after cutover
          sh 'docker compose -f docker-compose.prod.yml stop app-blue'
        }
      }
    }
    stage('Blue/Green Rollback') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          // Switch Nginx back to blue
          sh "sed -i 's/server app-green/server app-blue/g' nginx-bluegreen.conf"
          sh 'docker compose -f docker-compose.prod.yml restart nginx'
          // Optionally, stop green
          sh 'docker compose -f docker-compose.prod.yml stop app-green'
          mail to: 'your-team@example.com', subject: 'Blue/Green Rollback Triggered', body: 'Rollback to blue version completed.'
        }
      }
    }
    stage('Canary Deploy') {
      steps {
        script {
          // Build and deploy canary version
          sh 'docker compose -f docker-compose.prod.yml build app-canary'
          sh 'docker compose -f docker-compose.prod.yml up -d app-canary'
          // Update Nginx config to split traffic (e.g., 90% to blue, 10% to canary)
          sh "sed -i 's/server app-blue:3000;/server app-blue:3000;\n        server app-canary:3000 weight=1;/g' nginx-bluegreen.conf"
          sh 'docker compose -f docker-compose.prod.yml restart nginx'
          // Monitor canary health and metrics
          sh 'sleep 60' // Wait for canary traffic
          // If canary is healthy, promote to full
          // (Optional: automate traffic shift)
        }
      }
    }
    stage('Canary Rollback') {
      when {
        expression { currentBuild.currentResult == 'FAILURE' }
      }
      steps {
        script {
          // Remove canary from Nginx config
          sh "sed -i '/server app-canary:3000/d' nginx-bluegreen.conf"
          sh 'docker compose -f docker-compose.prod.yml restart nginx'
          sh 'docker compose -f docker-compose.prod.yml stop app-canary'
          mail to: 'your-team@example.com', subject: 'Canary Rollback Triggered', body: 'Canary deployment failed and was rolled back.'
        }
      }
    }
  }
  post {
    always {
      junit 'test-results/**/*.xml'
    }
    failure {
      mail to: 'your-team@example.com', subject: 'Build or Database Failed', body: 'The Jenkins build or Supabase health check failed.'
    }
  }
}
