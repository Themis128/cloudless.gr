@echo off
echo Setting up Local Supabase Development Environment...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Docker is not running. Please start Docker Desktop.
    pause
    exit /b 1
)

REM Check if supabase directory exists
if not exist "supabase" (
    echo Cloning Supabase repository...
    git clone --filter=blob:none --no-checkout https://github.com/supabase/supabase
    cd supabase
    git sparse-checkout set --cone docker
    git checkout master
    cd ..
) else (
    echo Supabase repository already exists. Updating...
    cd supabase
    git pull origin master
    cd ..
)

REM Ensure supabase-project directory exists
if not exist "supabase-project" (
    mkdir supabase-project
)

REM Copy compose files
echo Copying Docker Compose files...
xcopy /E /Y supabase\docker\* supabase-project\

REM Copy environment file
if not exist "supabase-project\.env" (
    echo Copying environment configuration...
    copy supabase\docker\.env.example supabase-project\.env
) else (
    echo Environment file already exists. Creating backup...
    copy supabase-project\.env supabase-project\.env.backup
    copy supabase\docker\.env.example supabase-project\.env.new
)

cd supabase-project

echo Pulling latest Docker images...
docker compose pull

echo Starting Supabase services...
docker compose up -d

echo Waiting for services to start...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo Local Supabase Setup Complete!
echo ========================================
echo.
echo Services available at:
echo - Supabase Studio:  http://localhost:3000
echo - API Gateway:      http://localhost:8000
echo - Database:         postgresql://postgres:postgres@localhost:5432/postgres
echo - Auth:             http://localhost:9999
echo.
echo Default credentials:
echo - Database User:    postgres
echo - Database Pass:    postgres
echo - JWT Secret:       super-secret-jwt-token-with-at-least-32-characters-long
echo - Service Key:      See .env file for SUPABASE_SERVICE_ROLE_KEY
echo.
echo To stop services: docker compose down
echo To view logs:     docker compose logs -f
echo.
pause
