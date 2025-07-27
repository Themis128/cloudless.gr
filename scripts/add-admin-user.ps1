# Add Admin User Script
# This script adds an admin user to the database with bcrypt hashed password

param(
  [string]$Email = "baltzakis.themis@gmail.com",
  [string]$Password = "TH!123789th!",
  [string]$Name = "Themis Baltzakis"
)

Write-Host "Adding admin user to database..." -ForegroundColor Green
Write-Host "Email: $Email" -ForegroundColor Yellow
Write-Host "Name: $Name" -ForegroundColor Yellow

# Check if Node.js is available
try {
  $nodeVersion = node --version
  Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
}
catch {
  Write-Host "Node.js is not installed or not in PATH" -ForegroundColor Red
  exit 1
}

# Run the Node.js script
Write-Host "Running admin user creation script..." -ForegroundColor Green
node scripts/add-admin-user.js

if ($LASTEXITCODE -eq 0) {
  Write-Host "Script completed successfully!" -ForegroundColor Green
}
else {
  Write-Host "Script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
  exit 1
}
