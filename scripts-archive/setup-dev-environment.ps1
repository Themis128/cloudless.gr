Write-Host "🔧 Starting development environment..."

# Set execution policy for this session only (avoids permission errors)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force

# Step 1: Cleanup previous environment and caches
Write-Host "Cleaning up previous environment..." -ForegroundColor Cyan

# Remove Python __pycache__ and .pytest_cache folders
Get-ChildItem -Path . -Include "__pycache__", ".pytest_cache" -Recurse -Directory | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# Deactivate any active Python virtual environment (if possible)
if ($env:VIRTUAL_ENV) {
    Write-Host "Deactivating previous Python virtual environment..." -ForegroundColor Yellow
    deactivate
}

# Clear the terminal for a fresh start
Clear-Host

# Step 2: Install Node.js dependencies
Write-Host "Installing Node.js dependencies with npm..." -ForegroundColor Green
npm install

# Step 3: Install Python dependencies
Write-Host "Installing Python dependencies with pip..." -ForegroundColor Green
if (Test-Path '.\shared_venv\Scripts\python.exe') {
    .\shared_venv\Scripts\python.exe -m pip install -r requirements.txt
} else {
    Write-Host 'Virtual environment not found. Run Python: Setup Shared Environment first.' -ForegroundColor Red
}

# Check if virtual environment exists
if (-Not (Test-Path "./venv/Scripts/Activate.ps1")) {
    Write-Error "❌ Virtual environment not found at ./venv. Please create it first with: python -m venv venv"
    exit 1
}

# Activate the virtual environment
Write-Host "✅ Activating virtual environment..."
. .\venv\Scripts\Activate.ps1

# Install Python requirements if requirements.txt exists
if (Test-Path "./requirements.txt") {
    Write-Host "📦 Installing Python dependencies..."
    pip install -r requirements.txt
}

# Start Nuxt dev server
Write-Host "🚀 Starting Nuxt development server..."
npm install
npm run dev
