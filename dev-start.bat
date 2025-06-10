@echo off
title Cloudless.gr Development Environment
color 0A

echo ================================================================================================
echo                           🚀 CLOUDLESS.GR DEVELOPMENT ENVIRONMENT 🚀
echo ================================================================================================
echo.

:: Check prerequisites
echo 📋 Checking prerequisites...

:: Check Docker
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not installed or not running
    echo    Please install Docker Desktop and ensure it's running
    pause
    exit /b 1
)
echo ✅ Docker is running

:: Check Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed
    echo    Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)
echo ✅ Node.js is installed

:: Check npm
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available
    pause
    exit /b 1
)
echo ✅ npm is available

:: Check if Supabase CLI is installed
npx supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Supabase CLI not found, installing...
    npm install -g @supabase/cli
)
echo ✅ Supabase CLI is available

echo.
echo 🔧 Setting up development environment...

:: Install dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing npm dependencies...
    npm install
)

:: Stop any existing services
echo 🛑 Stopping existing services...
npx supabase stop >nul 2>&1

echo.
echo 🚀 Starting Supabase local development server...
start /b cmd /c "npx supabase start && echo Supabase started successfully!"

:: Wait for Supabase to start
echo ⏳ Waiting for Supabase to initialize...
timeout /t 10 >nul

:: Start the development server
echo.
echo 🌐 Starting Nuxt development server...
echo    Your app will be available at: http://localhost:3000
echo    Supabase Studio: http://localhost:54323
echo    Database URL: postgresql://postgres:postgres@localhost:54322/postgres
echo.
echo ================================================================================================
echo                                  🎉 READY FOR DEVELOPMENT! 🎉
echo ================================================================================================
echo.

:: Start Nuxt in development mode
npm run dev
