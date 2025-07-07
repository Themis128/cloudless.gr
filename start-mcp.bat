@echo off
echo 🚀 Starting Supabase MCP Server
echo ===============================

REM Load environment variables from .env file
if exist .env (
    echo 📝 Loading environment variables from .env...
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%a"=="#" set %%a=%%b
    )
    echo ✅ Environment variables loaded
) else (
    echo ❌ .env file not found
    exit /b 1
)

echo.
echo 🚀 Starting MCP server...
echo    Command: npx @supabase/mcp-server-supabase@latest --read-only
echo    Supabase URL: %SUPABASE_URL%

npx @supabase/mcp-server-supabase@latest --read-only
