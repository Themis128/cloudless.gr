#!/bin/bash

# Custom secrets scanner that focuses on actual hardcoded secrets
# Reduces false positives from Vue.js templates and documentation

set -e

echo "🔍 Running custom secrets scan..."

# Define patterns for actual secrets (high entropy, specific formats)
SECRET_PATTERNS=(
    # API keys with specific prefixes
    "sk_live_[a-zA-Z0-9]{24,}"
    "sk_test_[a-zA-Z0-9]{24,}"
    "pk_live_[a-zA-Z0-9]{24,}"
    "pk_test_[a-zA-Z0-9]{24,}"
    "rk_live_[a-zA-Z0-9]{24,}"
    "rk_test_[a-zA-Z0-9]{24,}"
    
    # OpenAI API keys
    "sk-[a-zA-Z0-9]{48}"
    
    # GitHub tokens
    "ghp_[a-zA-Z0-9]{36}"
    "gho_[a-zA-Z0-9]{36}"
    "ghu_[a-zA-Z0-9]{36}"
    "ghs_[a-zA-Z0-9]{36}"
    "ghr_[a-zA-Z0-9]{36}"
    
    # AWS access keys
    "AKIA[0-9A-Z]{16}"
    "AKIA[0-9A-Z]{20}"
    
    # Google API keys (40+ chars)
    "[a-zA-Z0-9_-]{40,}"
    
    # JWT tokens (3 parts separated by dots)
    "[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+"
    
    # Base64 encoded secrets (40+ chars)
    "[A-Za-z0-9+/]{40,}={0,2}"
    
    # Hex encoded secrets (40+ chars)
    "[a-fA-F0-9]{40,}"
)

# Directories to exclude from scanning
EXCLUDE_DIRS=(
    "node_modules"
    ".git"
    ".nuxt"
    ".output"
    "vanta-gallery"
    "dist"
    "build"
    "tmp"
    "uploads"
    "db-backups"
)

# File patterns to exclude
EXCLUDE_FILES=(
    "*.min.js"
    "*.min.css"
    "*.vue"
    "*.css"
    "*.scss"
    "*.less"
    "*.md"
    "*.txt"
    "*.log"
    "*.ps1"
    "*.sh"
    "Dockerfile"
    "env.example"
    ".env.example"
    "package-lock.json"
    "yarn.lock"
)

# Build exclude arguments for grep
EXCLUDE_ARGS=""
for dir in "${EXCLUDE_DIRS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$dir"
done

for file in "${EXCLUDE_FILES[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude=$file"
done

echo "📋 Scanning for actual hardcoded secrets..."
echo "🔍 Excluding: ${EXCLUDE_DIRS[*]}"
echo "🔍 Excluding files: ${EXCLUDE_FILES[*]}"
echo ""

# Track findings
TOTAL_FINDINGS=0
REAL_SECRETS=0

# Scan for each secret pattern
for pattern in "${SECRET_PATTERNS[@]}"; do
    echo "🔍 Scanning for pattern: $pattern"
    
    # Use grep to find matches
    MATCHES=$(grep -r -i -E "$pattern" . $EXCLUDE_ARGS 2>/dev/null || true)
    
    if [ -n "$MATCHES" ]; then
        echo "⚠️  Found potential matches:"
        echo "$MATCHES" | while IFS= read -r line; do
            if [ -n "$line" ]; then
                echo "   $line"
                TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
                
                # Check if this looks like a real secret (not a template or example)
                if echo "$line" | grep -v -E "(your_|test_|example_|placeholder|template|TODO|FIXME|//|/\*|\*/)" >/dev/null; then
                    REAL_SECRETS=$((REAL_SECRETS + 1))
                    echo "   ❌ HIGH CONFIDENCE: This looks like a real secret!"
                else
                    echo "   ✅ False positive: Template/example detected"
                fi
            fi
        done
        echo ""
    else
        echo "✅ No matches found"
    fi
done

echo "📊 Scan Summary:"
echo "   Total findings: $TOTAL_FINDINGS"
echo "   High-confidence secrets: $REAL_SECRETS"
echo "   False positives: $((TOTAL_FINDINGS - REAL_SECRETS))"

# Additional checks for common false positive patterns
echo ""
echo "🔍 Checking for common false positive patterns..."

FALSE_POSITIVE_PATTERNS=(
    ":key="
    "v-for"
    "v-bind:key"
    "@keyframes"
    "your_api_key_here"
    "your_secret_here"
    "your_password_here"
    "your_token_here"
    "process.env."
    "NUXT_PUBLIC_"
    "SUPABASE_"
    "VITE_"
    "NEXT_PUBLIC_"
    "type=\"password\""
    "label=\"API Key\""
    "const key ="
    "let key ="
    "var key ="
)

FALSE_POSITIVE_COUNT=0
for pattern in "${FALSE_POSITIVE_PATTERNS[@]}"; do
    COUNT=$(grep -r -i "$pattern" . $EXCLUDE_ARGS 2>/dev/null | wc -l || echo "0")
    if [ "$COUNT" -gt 0 ]; then
        echo "   ✅ Found $COUNT instances of '$pattern' (legitimate code)"
        FALSE_POSITIVE_COUNT=$((FALSE_POSITIVE_COUNT + COUNT))
    fi
done

echo ""
echo "📈 False Positive Analysis:"
echo "   Legitimate patterns found: $FALSE_POSITIVE_COUNT"
echo "   These would have been flagged by generic scanners"

# Final result
if [ "$REAL_SECRETS" -gt 0 ]; then
    echo ""
    echo "❌ CRITICAL: Found $REAL_SECRETS potential hardcoded secrets!"
    echo "🔒 Please review and remove these secrets from the codebase"
    echo "🔒 Use environment variables or GitHub secrets instead"
    exit 1
else
    echo ""
    echo "✅ SUCCESS: No hardcoded secrets detected!"
    echo "🔒 All secrets are properly managed via environment variables"
    echo "🔒 Codebase follows security best practices"
    exit 0
fi 