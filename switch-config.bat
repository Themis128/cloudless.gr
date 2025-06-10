@echo off
setlocal

:: Set constants for your local setup
set CONFIG_FILE=supabase\config.local.toml
set DEST_FILE=supabase\config.toml
set PROJECT_REF=oflctqligzouzshimuqh
set SITE_URL=http://localhost:3000

:: Step 1: Copy config
if not exist "%CONFIG_FILE%" (
    echo ❌ Config file '%CONFIG_FILE%' not found.
    exit /b 1
)

copy /Y "%CONFIG_FILE%" "%DEST_FILE%" >nul
echo ✅ Applied local Supabase config.

:: Step 2: Link Supabase project
echo 🔗 Linking local Supabase project...
supabase link --project-ref %PROJECT_REF%
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Failed to link Supabase project.
    exit /b 1
)
echo 🟢 Linked to project: %PROJECT_REF%

:: Step 3: Start Supabase services
echo 🚀 Starting Supabase...
supabase start
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Supabase failed to start.
    exit /b 1
)
echo 🟢 Supabase is running.

:: Step 4: Wait for services
echo ⏳ Waiting 5 seconds for services to become healthy...
timeout /T 5 >nul

:: Step 5: Health check
echo 🧪 Verifying health at %SITE_URL%/api/health...
curl --silent --head --fail %SITE_URL%/api/health >nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Health check failed. Supabase may not be ready.
    exit /b 1
)
echo ✅ Health check passed!

:: Step 6: Auto push DB and deploy functions (optional)
echo 📤 Pushing latest DB schema and deploying functions...
supabase db push
supabase functions deploy --all

echo 🏁 Local Supabase environment is ready.
endlocal
