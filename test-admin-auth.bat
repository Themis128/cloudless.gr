@echo off
echo 🔐 Cloudless.gr Admin Auth Test Runner
echo ====================================
echo.
echo Choose a test to run:
echo 1. Quick Test (basic functionality)
echo 2. Complete Test Suite (comprehensive)
echo 3. Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" (
    echo.
    echo Running Quick Test...
    powershell -ExecutionPolicy Bypass -File "test-admin-auth-quick.ps1"
) else if "%choice%"=="2" (
    echo.
    echo Running Complete Test Suite...
    powershell -ExecutionPolicy Bypass -File "test-admin-auth-complete.ps1"
) else if "%choice%"=="3" (
    echo Goodbye!
    exit /b 0
) else (
    echo Invalid choice. Please run the script again.
)

echo.
pause
