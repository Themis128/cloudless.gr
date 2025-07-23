# Start Development Server with Database Configuration
# This script sets the required environment variables and starts the Nuxt development server

Write-Host "🚀 Starting Cloudless LLM Dev Agent..." -ForegroundColor Green

# Set environment variables
$env:DATABASE_URL = "file:./prisma/dev.db"
$env:NODE_ENV = "development"

Write-Host "📊 Database URL set to: $env:DATABASE_URL" -ForegroundColor Yellow
Write-Host "🔧 Environment: $env:NODE_ENV" -ForegroundColor Yellow

# Start the development server with increased memory
Write-Host "🌐 Starting Nuxt development server..." -ForegroundColor Cyan
npm run dev 