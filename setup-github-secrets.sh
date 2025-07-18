#!/bin/bash

# GitHub Secrets Setup Script (Bash)
# This script helps set up GitHub secrets for the CI workflow

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

echo "🔐 GitHub Secrets Setup Script"
echo "================================"

# Check if GitHub CLI is available
if ! command -v gh &> /dev/null; then
    print_error "❌ GitHub CLI not found"
    echo "Please install GitHub CLI first:"
    echo "  macOS: brew install gh"
    echo "  Ubuntu/Debian: sudo apt install gh"
    echo "  Windows: winget install --id GitHub.cli"
    echo "  Or download from: https://cli.github.com/"
    exit 1
fi

print_success "✅ GitHub CLI is available"

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    print_error "❌ Not authenticated with GitHub CLI"
    echo "Please run: gh auth login"
    exit 1
fi

print_success "✅ Authenticated with GitHub CLI"

# Get Supabase credentials
echo ""
read -p "Enter your Supabase URL (e.g., https://your-project.supabase.co): " SUPABASE_URL
read -p "Enter your Supabase Anon Key: " SUPABASE_ANON_KEY

# Validate inputs
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    print_error "❌ Both Supabase URL and Anon Key are required"
    exit 1
fi

if [[ ! "$SUPABASE_URL" =~ ^https:// ]]; then
    print_error "❌ Supabase URL must start with https://"
    exit 1
fi

print_status "🔧 Setting up GitHub secrets..."

# Set SUPABASE_URL secret
print_status "Setting SUPABASE_URL secret..."
if gh secret set SUPABASE_URL --body "$SUPABASE_URL"; then
    print_success "✅ SUPABASE_URL secret set successfully"
else
    print_error "❌ Failed to set SUPABASE_URL secret"
fi

# Set SUPABASE_ANON_KEY secret
print_status "Setting SUPABASE_ANON_KEY secret..."
if gh secret set SUPABASE_ANON_KEY --body "$SUPABASE_ANON_KEY"; then
    print_success "✅ SUPABASE_ANON_KEY secret set successfully"
else
    print_error "❌ Failed to set SUPABASE_ANON_KEY secret"
fi

# List current secrets
echo ""
print_status "📋 Current repository secrets:"
gh secret list || print_warning "⚠️  Could not list secrets"

echo ""
print_success "🎉 GitHub secrets setup completed!"
echo "You can now run your CI workflow and it should have access to the Supabase credentials." 