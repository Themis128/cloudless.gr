#!/bin/bash

# GitHub Secrets Setup Script
# This script helps you set up GitHub repository secrets using GitHub CLI

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
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    print_error "❌ GitHub CLI (gh) is not installed"
    echo ""
    print_warning "Install GitHub CLI:"
    echo "  Windows: winget install GitHub.cli"
    echo "  macOS: brew install gh"
    echo "  Linux: sudo apt install gh"
    echo ""
    print_warning "After installation, restart your terminal and run:"
    echo "  gh auth login"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    print_error "❌ Not authenticated with GitHub CLI"
    echo ""
    print_warning "Please authenticate first:"
    echo "  gh auth login"
    exit 1
fi

print_success "✅ GitHub CLI is installed and authenticated"
echo ""

# Get repository info
REPO_OWNER="Themis128"
REPO_NAME="cloudless.gr"

print_status "Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Prompt for Supabase credentials
echo "Please enter your Supabase credentials:"
echo ""

read -p "Supabase URL (e.g., https://abcdefghijklmnop.supabase.co): " SUPABASE_URL
read -p "Supabase anon key (starts with eyJ...): " SUPABASE_ANON_KEY

# Validate inputs
if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    print_error "❌ Invalid Supabase URL format"
    exit 1
fi

if [[ ! "$SUPABASE_ANON_KEY" =~ ^eyJ.* ]]; then
    print_error "❌ Invalid Supabase anon key format"
    exit 1
fi

print_success "✅ Input validation passed"
echo ""

# Set GitHub secrets
print_status "🔧 Setting up GitHub secrets..."

# Set SUPABASE_URL secret
print_status "Setting SUPABASE_URL secret..."
if gh secret set SUPABASE_URL --repo "$REPO_OWNER/$REPO_NAME" --body "$SUPABASE_URL"; then
    print_success "✅ Successfully set SUPABASE_URL secret"
else
    print_error "❌ Failed to set SUPABASE_URL secret"
    exit 1
fi

# Set SUPABASE_ANON_KEY secret
print_status "Setting SUPABASE_ANON_KEY secret..."
if gh secret set SUPABASE_ANON_KEY --repo "$REPO_OWNER/$REPO_NAME" --body "$SUPABASE_ANON_KEY"; then
    print_success "✅ Successfully set SUPABASE_ANON_KEY secret"
else
    print_error "❌ Failed to set SUPABASE_ANON_KEY secret"
    exit 1
fi

echo ""
print_success "🎉 All secrets set successfully!"
echo ""
print_status "Next steps:"
print_warning "1. Push a new commit to trigger the CI workflow"
print_warning "2. Or re-run the failed workflow from GitHub Actions tab"
print_warning "3. The integration tests should now pass with real Supabase credentials"
echo ""
print_status "You can verify the secrets were set by running:"
echo "  gh secret list --repo $REPO_OWNER/$REPO_NAME" 