@echo off
echo =============================================
echo  Supabase Local Development Health Check
echo =============================================

cd supabase-project 2>nul || (
    echo ERROR: supabase-project directory not found
    echo Run setup-local-supabase-fixed.bat first
    pause
    exit /b 1
)

echo Checking Docker services...
docker compose ps

echo.
echo Checking service endpoints...

REM Check if services are responding
echo Testing API Gateway (http://localhost:8000)...
curl -s http://localhost:8000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ API Gateway: HEALTHY
) else (
    echo ❌ API Gateway: NOT RESPONDING
)

echo Testing Supabase Studio (http://localhost:3000)...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Supabase Studio: HEALTHY
) else (
    echo ❌ Supabase Studio: NOT RESPONDING
)

echo Testing Database Connection...
docker compose exec -T db psql -U postgres -d postgres -c "SELECT 1;" >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Database: HEALTHY
) else (
    echo ❌ Database: NOT RESPONDING
)

echo.
echo =============================================
echo  Service URLs:
echo =============================================
echo 🌐 Supabase Studio:  http://localhost:3000
echo 🔌 API Gateway:      http://localhost:8000
echo 🗄️  Database:         postgresql://postgres:postgres@localhost:5432/postgres
echo 🔐 Auth Service:     http://localhost:9999
echo.

echo Current Environment:
type .env | findstr /v "PASSWORD\|SECRET\|KEY" 2>nul

echo.
echo Useful Commands:
echo   📊 View logs:         docker compose logs -f [service]
echo   🔄 Restart service:   docker compose restart [service]
echo   ⏹️  Stop all:          docker compose down
echo   🚀 Start all:         docker compose up -d
echo.

cd ..
pause
