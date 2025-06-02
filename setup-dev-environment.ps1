Write-Host "🔧 Starting development environment..."

# Set execution policy for this session only (avoids permission errors)
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned -Force

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
