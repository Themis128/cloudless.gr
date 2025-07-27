# Cloudless.gr Development Stack Startup Script
# Starts the complete development environment with all services

param(
  [switch]$Full,
  [switch]$Core,
  [switch]$Monitor,
  [switch]$Logs,
  [switch]$Stop,
  [switch]$Status,
  [switch]$Health
)

Write-Host "🚀 Cloudless.gr Development Stack Manager" -ForegroundColor Cyan

if ($Full) {
  Write-Host "📦 Starting complete development stack..." -ForegroundColor Yellow

  # Stop any existing containers
  Write-Host "🛑 Stopping existing containers..." -ForegroundColor Gray
  pnpm run docker:dev:down

  # Start the complete stack
  Write-Host "🔄 Building and starting all services..." -ForegroundColor Yellow
  pnpm run docker:dev:build

  Write-Host "✅ Complete stack started!" -ForegroundColor Green
  Write-Host ""
  Write-Host "📋 Service URLs:" -ForegroundColor Cyan
  Write-Host "  🌐 Main App:        http://localhost:3000" -ForegroundColor White
  Write-Host "  📊 Grafana:         http://localhost:3001 (admin/admin)" -ForegroundColor White
  Write-Host "  🗄️  pgAdmin:         http://localhost:8080 (admin@cloudless.gr/admin)" -ForegroundColor White
  Write-Host "  🔴 Redis Commander: http://localhost:8081 (admin/admin)" -ForegroundColor White
  Write-Host "  📦 Portainer:       http://localhost:9000" -ForegroundColor White
  Write-Host "  📈 Prometheus:      http://localhost:9090" -ForegroundColor White
  Write-Host "  🔍 Kibana:          http://localhost:5601" -ForegroundColor White
  Write-Host "  🕵️  Jaeger:          http://localhost:16686" -ForegroundColor White
  Write-Host "  📧 MailHog:         http://localhost:8025" -ForegroundColor White
  Write-Host "  🌐 Traefik:         http://localhost:8082" -ForegroundColor White

}
elseif ($Core) {
  Write-Host "🔧 Starting core services only..." -ForegroundColor Yellow

  # Start only essential services
  docker compose -f docker-compose.dev.yml up -d app-dev redis-dev postgres-dev

  Write-Host "✅ Core services started!" -ForegroundColor Green
  Write-Host ""
  Write-Host "📋 Core Service URLs:" -ForegroundColor Cyan
  Write-Host "  🌐 Main App: http://localhost:3000" -ForegroundColor White
  Write-Host "  🗄️  Database: localhost:5432" -ForegroundColor White

}
elseif ($Monitor) {
  Write-Host "📊 Opening monitoring dashboards..." -ForegroundColor Yellow

  # Open monitoring UIs in default browser
  Start-Process "http://localhost:3001"  # Grafana
  Start-Process "http://localhost:9090"  # Prometheus
  Start-Process "http://localhost:16686" # Jaeger
  Start-Process "http://localhost:5601"  # Kibana

  Write-Host "✅ Monitoring dashboards opened!" -ForegroundColor Green

}
elseif ($Logs) {
  Write-Host "📋 Showing application logs..." -ForegroundColor Yellow
  pnpm run docker:dev:logs

}
elseif ($Stop) {
  Write-Host "🛑 Stopping all services..." -ForegroundColor Yellow
  pnpm run docker:dev:down
  Write-Host "✅ All services stopped!" -ForegroundColor Green

}
elseif ($Status) {
  Write-Host "📊 Service Status:" -ForegroundColor Yellow
  docker compose -f docker-compose.dev.yml ps

}
elseif ($Health) {
  Write-Host "🏥 Checking service health..." -ForegroundColor Yellow

  # Check main app health
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
      Write-Host "✅ Main App: Healthy" -ForegroundColor Green
    }
    else {
      Write-Host "❌ Main App: Unhealthy (Status: $($response.StatusCode))" -ForegroundColor Red
    }
  }
  catch {
    Write-Host "❌ Main App: Unreachable" -ForegroundColor Red
  }

  # Check PostgreSQL
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 5
    Write-Host "✅ pgAdmin: Accessible" -ForegroundColor Green
  }
  catch {
    Write-Host "❌ pgAdmin: Unreachable" -ForegroundColor Red
  }

  # Check Redis Commander
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:8081" -TimeoutSec 5
    Write-Host "✅ Redis Commander: Accessible" -ForegroundColor Green
  }
  catch {
    Write-Host "❌ Redis Commander: Unreachable" -ForegroundColor Red
  }

  # Check Grafana
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 5
    Write-Host "✅ Grafana: Accessible" -ForegroundColor Green
  }
  catch {
    Write-Host "❌ Grafana: Unreachable" -ForegroundColor Red
  }

}
else {
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  .\start-dev-stack.ps1 -Full      # Start complete stack" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Core      # Start core services only" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Monitor   # Open monitoring dashboards" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Logs      # Show application logs" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Stop      # Stop all services" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Status    # Show service status" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Health    # Check service health" -ForegroundColor White
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor Yellow
  Write-Host "  .\start-dev-stack.ps1 -Full" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Monitor" -ForegroundColor White
  Write-Host "  .\start-dev-stack.ps1 -Health" -ForegroundColor White
}
