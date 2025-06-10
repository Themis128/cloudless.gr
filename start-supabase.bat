@echo off
echo Starting Local Supabase Development Environment...
echo.

:: Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop and ensure it's running
    pause
    exit /b 1
)

:: Check if we're in the right directory
if not exist "supabase\config.toml" (
    echo ERROR: supabase\config.toml not found
    echo Please run this script from the cloudless.gr project root
    pause
    exit /b 1
)

echo Stopping any existing Supabase containers...
npx supabase stop

echo.
echo Starting fresh Supabase local development environment...
npx supabase start

if %errorlevel% equ 0 (
    echo.
    echo ✅ Supabase started successfully!
    echo.
    echo 📊 Services running at:
    echo   - API URL: http://localhost:54321
    echo   - Database URL: postgresql://postgres:postgres@localhost:54322/postgres
    echo   - Studio URL: http://localhost:54323
    echo   - Inbucket URL: http://localhost:54324
    echo   - JWT Secret: super-secret-jwt-token-with-at-least-32-characters-long
    echo   - Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJuYVo8zNmYmn9fA2XEyWdgbFkQ-p6PGE
    echo   - Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
    echo.
    echo 🚀 Your environment is ready! Run 'npm run dev' to start the Nuxt app.
    echo 🔗 Access Supabase Studio at: http://localhost:54323
) else (
    echo.
    echo ❌ Failed to start Supabase
    echo Check the error messages above and try again
)

echo.
echo Press any key to continue...
pause >nul
