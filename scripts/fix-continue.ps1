# fix-continue.ps1

Write-Host "🛠 Fixing Continue extension issues..."

# Go to project root (parent of 'scripts')
$projectRoot = (Get-Item -Path "$PSScriptRoot\..").FullName
Set-Location $projectRoot

# Set fixed paths
$continueConfigPath = "$projectRoot\.continue\config.json"
$continueModelsPath = "$projectRoot\.continue\models"

# Ensure .continue folder exists
if (-not (Test-Path "$projectRoot\.continue")) {
  New-Item -ItemType Directory -Path "$projectRoot\.continue" | Out-Null
}

# Create or fix config.json
if (-Not (Test-Path $continueConfigPath)) {
  Write-Host "⚠️ config.json not found. Creating default..."
  @"
{
  "models": [],
  "defaultModel": "llama3_8b",
  "promptsPath": ".continue/prompts/vue-tasks.json",
  "features": {
    "agentMode": true,
    "tools": true
  },
  "projectType": "nuxt-vuetify"
}
"@ | Out-File -Encoding UTF8 -FilePath $continueConfigPath
} else {
  Write-Host "✅ config.json exists. Backing up and formatting..."
  Copy-Item $continueConfigPath "$continueConfigPath.bak" -Force
  try {
    $json = Get-Content $continueConfigPath | ConvertFrom-Json
    $json | ConvertTo-Json -Depth 5 | Set-Content $continueConfigPath
  } catch {
    Write-Host "❌ Invalid JSON. Replacing with default config."
    @"
{
  "models": [],
  "defaultModel": "llama3_8b",
  "promptsPath": ".continue/prompts/vue-tasks.json",
  "features": {
    "agentMode": true,
    "tools": true
  },
  "projectType": "nuxt-vuetify"
}
"@ | Out-File -Encoding UTF8 -FilePath $continueConfigPath
  }
}

# Clean up models
if (Test-Path $continueModelsPath) {
  Write-Host "🧹 Removing old models..."
  Remove-Item "$continueModelsPath\*" -Recurse -Force -ErrorAction SilentlyContinue
}

# Prompt restart
$choice = Read-Host "🔁 VS Code must be restarted to apply fixes. Type 'y' to continue"
if ($choice -eq 'y') {
  Write-Host "🔄 Restarting VS Code..."
  Stop-Process -Name "Code" -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Start-Process code $projectRoot
} else {
  Write-Host "❌ Cancelled. Restart VS Code manually to apply changes."
}

Write-Host "✅ Fix complete."
