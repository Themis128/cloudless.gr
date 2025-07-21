@echo off
echo 🚀 Starting GitHub Actions Self-Hosted Runner...
echo.

REM Check if PowerShell is available
powershell -Command "& {.\scripts\start-runner.ps1 start}" 2>nul
if %errorlevel% neq 0 (
    echo ❌ Error: PowerShell script not found or failed to execute
    echo Please ensure you're running this from the project root directory
    pause
    exit /b 1
)

echo.
echo ✅ Runner management completed
pause 