#!/bin/bash
# Supabase Reset Script - IPv6 Compatible Version
# Simple wrapper that calls the PowerShell enhanced script

echo "🚀 Supabase Reset - IPv6 Compatible Version"
echo "============================================="
echo ""

# Check if PowerShell is available
if command -v pwsh &> /dev/null; then
    echo "Using PowerShell Core (pwsh)..."
    pwsh -File "./reset-and-seed-enhanced.ps1" "$@"
elif command -v powershell &> /dev/null; then
    echo "Using Windows PowerShell..."
    powershell -File "./reset-and-seed-enhanced.ps1" "$@"
else
    echo "❌ PowerShell not found!"
    echo "Please install PowerShell Core or use the PowerShell script directly:"
    echo "  ./reset-and-seed-enhanced.ps1"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Reset completed successfully!"
    echo "Your local Supabase environment is ready for development."
    echo "No more IPv6 connectivity issues! 🎉"
else
    echo ""
    echo "❌ Reset failed. Check the output above for details."
    exit 1
fi
