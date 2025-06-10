@echo off
echo =============================================
echo  Setting up Local Supabase Development
echo =============================================

REM Check if Docker is running
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop and start it before running this script
    echo Download from: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

REM Stop any existing containers to avoid conflicts
echo Stopping any existing containers...
docker compose down >nul 2>&1

REM Clean up existing setup if needed
if exist "supabase-project" (
    echo Cleaning up previous installation...
    cd supabase-project
    docker compose down >nul 2>&1
    cd ..
)

REM Create fresh supabase-project directory
if exist "supabase-project" rmdir /s /q supabase-project
mkdir supabase-project

REM Clone Supabase repository with sparse checkout
echo Cloning Supabase repository (Docker files only)...
if exist "supabase" rmdir /s /q supabase

git clone --filter=blob:none --no-checkout https://github.com/supabase/supabase.git
cd supabase
git sparse-checkout set --cone docker
git checkout master
cd ..

REM Copy Docker compose files
echo Copying Docker Compose configuration...
xcopy /E /Y "supabase\docker\*" "supabase-project\" >nul

REM Create proper environment file
echo Creating environment configuration...
cd supabase-project

REM Use the example env or create a basic one
if exist ".env.example" (
    copy ".env.example" ".env" >nul
) else (
    echo Creating default .env configuration...
    (
        echo # Supabase Local Development
        echo POSTGRES_HOST=db
        echo POSTGRES_DB=postgres
        echo POSTGRES_USER=postgres
        echo POSTGRES_PASSWORD=postgres
        echo POSTGRES_PORT=5432
        echo JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long
        echo ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOuoJdKdisRcKLHSU2OmJrBY33Y3E8RGqL5w
        echo SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
        echo DASHBOARD_USERNAME=supabase
        echo DASHBOARD_PASSWORD=this_password_is_insecure_and_should_be_updated
        echo STUDIO_DEFAULT_ORGANIZATION=Default Organization
        echo STUDIO_DEFAULT_PROJECT=Default Project
        echo STUDIO_PORT=3000
        echo SUPABASE_PUBLIC_URL=http://localhost:8000
        echo ENABLE_EMAIL_CONFIRMATIONS=false
        echo ENABLE_EMAIL_AUTOCONFIRM=true
        echo SMTP_ADMIN_EMAIL=admin@example.com
        echo SMTP_HOST=localhost
        echo SMTP_PORT=587
        echo SMTP_USER=fake_mail_user
        echo SMTP_PASS=fake_mail_password
        echo SMTP_SENDER_NAME=fake_sender
    ) > .env
)

echo Pulling Docker images (this may take a few minutes)...
docker compose pull

echo Starting Supabase services...
docker compose up -d

echo.
echo Waiting for services to initialize (30 seconds)...
timeout /t 30 /nobreak >nul

echo.
echo Checking service status...
docker compose ps

echo.
echo =============================================
echo   Local Supabase Setup Complete!
echo =============================================
echo.
echo Services are available at:
echo   🌐 Supabase Studio:  http://localhost:3000
echo   🔌 API Gateway:      http://localhost:8000
echo   🗄️  Database:         postgresql://postgres:postgres@localhost:5432/postgres
echo   🔐 Auth Service:     http://localhost:9999
echo.
echo Default Credentials:
echo   📁 Database User:    postgres
echo   🔑 Database Pass:    postgres
echo   🎫 JWT Secret:       super-secret-jwt-token-with-at-least-32-characters-long
echo.
echo Useful Commands:
echo   ⏹️  Stop services:     docker compose down
echo   📊 View logs:         docker compose logs -f
echo   🔄 Restart:           docker compose restart
echo   📋 Service status:    docker compose ps
echo.
echo Next Steps:
echo   1. Open Supabase Studio: http://localhost:3000
echo   2. Update your app's .env.local file with local Supabase URLs
echo   3. Run your Nuxt app: npm run dev
echo.

cd ..
pause
