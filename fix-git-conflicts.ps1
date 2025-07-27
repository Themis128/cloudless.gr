# PowerShell script to fix git merge conflicts
# This script will keep the HEAD version of each file and remove conflict markers

Write-Host "🔧 Starting git conflict resolution..." -ForegroundColor Green

# Function to fix a single file
function Fix-ConflictFile {
    param([string]$filePath)

    if (Test-Path $filePath) {
        Write-Host "Processing $filePath..." -ForegroundColor Yellow

        try {
            # Read the file content
            $content = Get-Content $filePath -Raw -Encoding UTF8

            if ($content -match '<<<<<<< HEAD') {
                # Remove all conflict markers and keep HEAD version
                $fixedContent = $content -replace '<<<<<<< HEAD\s*', '' -replace '=======.*?>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a\s*', '' -replace '>>>>>>> cursor/fix-prisma-module-for-successful-build-b32a\s*', ''

                # Write the fixed content back
                Set-Content $filePath $fixedContent -NoNewline -Encoding UTF8

                Write-Host "✅ Fixed $filePath" -ForegroundColor Green
            } else {
                Write-Host "⚠️  No conflicts found in $filePath" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Error processing $filePath : $_" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠️  File $filePath not found, skipping..." -ForegroundColor Yellow
    }
}

# List of all files with conflicts that need to be fixed
$conflictFiles = @(
    # Configuration files
    "tsconfig.json",
    "README.md",
    "prisma/schema.prisma",
    "package.json",
    ".gitignore",
    ".eslintignore",

    # Vue pages
    "pages/terms.vue",
    "pages/projects/index.vue",
    "pages/index.vue",
    "pages/llm/local.vue",
    "pages/llm/index.vue",
    "pages/dashboard/index.vue",
    "pages/contact.vue",
    "pages/codegen.vue",
    "pages/about.vue",
    "pages/auth/login.vue",
    "pages/admin/index.vue",
    "pages/admin/users.vue",
    "pages/admin/projects.vue",

    # Layouts and app files
    "layouts/default.vue",
    "app.vue",

    # CSS files
    "assets/css/main.css",
    "assets/css/admin.css",

    # LLM backend files
    "llm-backend/docker-compose.yml",
    "llm-backend/Dockerfile",
    "llm-backend/README.md",
    "llm-backend/celery_worker.py",
    "llm-backend/requirements.txt",
    "llm-backend/app/llm_manager.py",
    "llm-backend/app/main.py",
    "llm-backend/app/models.py",
    "llm-backend/app/tasks.py",
    "llm-backend/app/utils.py"
)

# Process each file
foreach ($file in $conflictFiles) {
    Fix-ConflictFile $file
}

Write-Host "🎉 Git conflict resolution completed!" -ForegroundColor Green
Write-Host "Run 'git add .' and 'git commit' to commit the changes." -ForegroundColor Cyan
