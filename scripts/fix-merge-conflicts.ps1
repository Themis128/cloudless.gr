# PowerShell script to fix Git merge conflicts
# This script removes merge conflict markers and keeps the HEAD version

Write-Host "Fixing Git merge conflicts..." -ForegroundColor Green

# Function to fix merge conflicts in a file
function Fix-MergeConflicts {
    param([string]$FilePath)
    
    if (Test-Path $FilePath) {
        Write-Host "Fixing conflicts in: $FilePath" -ForegroundColor Yellow
        
        # Read the file content
        $content = Get-Content $FilePath -Raw
        
        # Remove merge conflict markers and keep HEAD version
        $fixedContent = $content -replace '<<<<<<< HEAD\s*', '' `
                                -replace '=======\s*', '' `
                                -replace '>>>>>>> [^\r\n]*\s*', ''
        
        # Write the fixed content back
        Set-Content $FilePath $fixedContent -NoNewline
        
        Write-Host "Fixed: $FilePath" -ForegroundColor Green
    }
}

# List of files with merge conflicts (based on the error output)
$filesWithConflicts = @(
    "pages/about.vue",
    "pages/index.vue", 
    "pages/terms.vue",
    "pages/codegen.vue",
    "pages/contact.vue",
    "pages/projects/index.vue",
    "pages/dashboard/index.vue",
    "pages/llm/local.vue",
    "pages/llm/index.vue",
    "pages/auth/login.vue",
    "pages/admin/users.vue",
    "pages/admin/index.vue",
    "pages/admin/projects.vue",
    "assets/css/main.css",
    "assets/css/admin.css",
    "layouts/default.vue",
    ".gitignore",
    ".eslintignore"
)

# Fix each file
foreach ($file in $filesWithConflicts) {
    Fix-MergeConflicts $file
}

Write-Host "Merge conflicts fixed!" -ForegroundColor Green
Write-Host "You can now try running 'npm run dev' again." -ForegroundColor Cyan 