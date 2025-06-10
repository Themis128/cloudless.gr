@echo off
REM Agent Helper Script for Cloudless.gr - Windows CMD Version
REM GitHub Copilot + Continue.dev Integration

setlocal enabledelayedexpansion

if "%1"=="" goto :help
if "%1"=="help" goto :help
if "%1"=="dev" goto :dev
if "%1"=="build" goto :build
if "%1"=="test" goto :test
if "%1"=="lint" goto :lint
if "%1"=="fix" goto :fix
if "%1"=="agent" goto :agent
if "%1"=="health" goto :health
if "%1"=="clean" goto :clean
goto :help

:header
echo ===========================================================
echo 🤖 Cloudless.gr Agent Development Helper
echo    GitHub Copilot + Continue.dev Integration
echo ===========================================================
echo.
goto :eof

:help
call :header
echo Available Commands:
echo.
echo   dev           Start development server with agent support
echo   build         Build the application
echo   test          Run tests with agent debugging
echo   lint          Run linter (excludes supabase-repo)
echo   fix           Fix common ESLint issues
echo   agent         Show agent configuration status
echo   health        Check project health and dependencies
echo   clean         Clean cache and temporary files
echo.
echo Usage: agent-helper.bat ^<command^>
echo Example: agent-helper.bat dev
goto :eof

:dev
call :header
echo 🚀 Starting Nuxt development server with agent support...
echo    - Continue.dev agent mode: ENABLED
echo    - GitHub Copilot: ENABLED
echo    - Terminal integration: ACTIVE
echo.
set CONTINUE_AGENT_MODE=true
set NODE_ENV=development
npm run dev
goto :eof

:build
call :header
echo 🔨 Building application...
npm run build
goto :eof

:test
call :header
echo 🧪 Running tests with agent debugging...
npm run test
goto :eof

:lint
call :header
echo 🔍 Running ESLint (excluding supabase-repo)...
npm run lint
goto :eof

:fix
call :header
echo 🔧 Fixing common ESLint issues...
npm run lint -- --fix
echo ✅ Auto-fix completed!
goto :eof

:agent
call :header
echo 🤖 Agent Configuration Status:
echo.
if exist ".continue\config.json" (
    echo ✅ Continue.dev configuration found
) else (
    echo ❌ Continue.dev configuration missing
)

if exist ".vscode\settings.json" (
    echo ✅ VS Code settings configured
) else (
    echo ❌ VS Code settings missing
)

if exist "package.json" (
    echo ✅ Package.json found
) else (
    echo ❌ Package.json missing
)

echo.
echo 🔧 Terminal Profiles Available:
echo    - AI Agent Terminal (robot icon)
echo    - Nuxt Dev Terminal
echo    - Database Terminal
echo    - Docker Terminal
echo    - Test Terminal
echo.
echo 💡 Use Ctrl+Shift+` to open terminal and select profile
goto :eof

:health
call :header
echo 🏥 Checking project health...
echo.
echo 📦 Node.js version:
node --version
echo 📦 npm version:
npm --version
echo 🚀 Nuxt version:
npx nuxt --version
echo.
echo 🔍 Checking dependencies...
npm audit --audit-level high
echo.
echo ✅ Health check completed!
goto :eof

:clean
call :header
echo 🧹 Cleaning project...
if exist ".nuxt" (
    rmdir /s /q ".nuxt"
    echo ✅ Removed .nuxt cache
)
if exist ".output" (
    rmdir /s /q ".output"
    echo ✅ Removed .output directory
)
npm cache clean --force
echo ✅ Cleaned npm cache
echo.
echo 🎉 Project cleaned successfully!
echo 💡 You may want to run 'npm install' to reinstall dependencies
goto :eof
