# dev-automation.ps1
# Step 1: Cleanup and Environment Reactivation
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

# Step 2: Activate the development environment
Write-Host "Activating development environment..." -ForegroundColor Green
if (Test-Path '.\shared_venv\Scripts\Activate.ps1') {
    .\shared_venv\Scripts\Activate.ps1
} else {
    Write-Host 'Virtual environment not found. Run Python: Setup Shared Environment first.' -ForegroundColor Red
}

# Step 3: Install Node.js dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Green
npm install

# Step 4: Install Python requirements (optional, uncomment if needed)
# Write-Host "Installing Python requirements..." -ForegroundColor Green
# if (Test-Path '.\shared_venv\Scripts\python.exe') {
#     .\shared_venv\Scripts\python.exe -m pip install -r requirements.txt
# } else {
#     Write-Host 'Virtual environment not found. Run Python: Setup Shared Environment first.' -ForegroundColor Yellow
# }

Write-Host "Development automation complete." -ForegroundColor Cyan
