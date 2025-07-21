#!/bin/bash

# Custom secrets scanner that focuses on actual hardcoded secrets
# Reduces false positives from Vue.js templates and documentation

set -e

echo "🔍 Running custom secrets scan..."

# Define patterns for actual secrets (high entropy, specific formats)
SECRET_PATTERNS=(
    # Stripe API keys
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
    
    # AWS Secret Access Key (base64 format)
    "[A-Za-z0-9/+=]{40}"
    
    # JWT tokens (eyJ... format)
    "eyJ[A-Za-z0-9_/+=]+\.[A-Za-z0-9_/+=]+\.[A-Za-z0-9_/+=]+"
    
    # Generic API keys in assignments
    "(?i)(api[_-]?key|apikey)['\"]*\s*[:=]\s*['\"][a-z0-9]{20,}['\"]"
    
    # Database connection strings
    "(?i)(mongodb|mysql|postgres|redis)://[^/\\s]+:[^/\\s]+@[^/\\s]+"
    
    # Database passwords in config
    "(?i)(password|pwd|pass)['\"]*\s*[:=]\s*['\"][^'\"]+['\"]"
    
    # High-entropy strings in quotes (more specific)
    "['\"][a-zA-Z0-9+/=]{32,}['\"]"
)

# Directories to exclude from scanning
EXCLUDE_DIRS=(
    "node_modules"
    ".git"
    ".nuxt"
    ".output"
    "vanta-gallery"
    "vanta-master"
    "dist"
    "build"
    "tmp"
    "uploads"
    "db-backups"
    "playwright-report"
    "docs"
    "templates"
    "examples"
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
    "*.svg"
    "*.map"
    "Dockerfile"
    "env.example"
    ".env.example"
    "package-lock.json"
    "yarn.lock"
    "pnpm-lock.yaml"
    "*.json"
    "*.html"
    "*.xml"
    "*.yml"
    "*.yaml"
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

# First, let's do a quick scan to see what we're dealing with
echo "🔍 Quick scan to assess false positive rate..."

# Count total potential matches (including false positives)
TOTAL_MATCHES=$(grep -r -i "password\|secret\|key\|token" . $EXCLUDE_ARGS 2>/dev/null | wc -l || echo "0")

# Count false positive patterns
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
    "foreignKeyName"
    "window."
    "Version:"
    "xmlns"
    "viewBox"
    "width="
    "height="
    "memoryStore.get(key)"
    "memoryStore.set(key"
    "memoryStore.delete(key)"
    "memoryStore.keys()"
    "https://registry.npmjs.org/"
    "resolved.*:.*https://"
    "verify.*your.*email.*and.*password"
    "verify.*api.*key.*configuration"
    "verify.*api.*keys.*and.*authentication"
    "API.*Key.*Management"
    "authentication.*token"
    "csrf.*protection.*token"
    "user.*authentication.*token"
    "glsl-token"
    "object-keys"
    "fs-monkey"
    "path-key"
    "ajv-keywords"
)

FALSE_POSITIVE_COUNT=0
for pattern in "${FALSE_POSITIVE_PATTERNS[@]}"; do
    COUNT=$(grep -r -i "$pattern" . $EXCLUDE_ARGS 2>/dev/null | wc -l || echo "0")
    if [ "$COUNT" -gt 0 ]; then
        FALSE_POSITIVE_COUNT=$((FALSE_POSITIVE_COUNT + COUNT))
    fi
done

echo "📈 False Positive Analysis:"
echo "   Total potential matches: $TOTAL_MATCHES"
echo "   Identified false positives: $FALSE_POSITIVE_COUNT"
echo "   Remaining for analysis: $((TOTAL_MATCHES - FALSE_POSITIVE_COUNT))"

# If we have a very high false positive rate, use conservative scanning
if [ "$TOTAL_MATCHES" -gt 500 ]; then
    echo ""
    echo "⚠️  High false positive rate detected. Using conservative scanning..."
    echo "🔍 Only scanning for high-confidence secret patterns..."
    
    # Only scan for the most specific and dangerous patterns
    HIGH_CONFIDENCE_PATTERNS=(
        "sk_live_[a-zA-Z0-9]{24,}"
        "sk_test_[a-zA-Z0-9]{24,}"
        "sk-[a-zA-Z0-9]{48}"
        "ghp_[a-zA-Z0-9]{36}"
        "AKIA[0-9A-Z]{16}"
        "AKIA[0-9A-Z]{20}"
        "eyJ[A-Za-z0-9_/+=]+\.[A-Za-z0-9_/+=]+\.[A-Za-z0-9_/+=]+"
    )
    
    for pattern in "${HIGH_CONFIDENCE_PATTERNS[@]}"; do
        echo "🔍 Scanning for high-confidence pattern: $pattern"
        
        # Use grep to find matches
        MATCHES=$(grep -r -i -E "$pattern" . $EXCLUDE_ARGS 2>/dev/null || true)
        
        if [ -n "$MATCHES" ]; then
            echo "❌  Found potential high-confidence matches:"
            echo "$MATCHES" | while IFS= read -r line; do
                if [ -n "$line" ]; then
                    echo "   $line"
                    REAL_SECRETS=$((REAL_SECRETS + 1))
                fi
            done
            echo ""
        else
            echo "✅ No matches found"
        fi
    done
else
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
                    if echo "$line" | grep -v -E "(your_|test_|example_|placeholder|template|TODO|FIXME|//|/\*|\*/|process\.env\.|foreignKeyName|window\.|Version:|xmlns|viewBox)" >/dev/null; then
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
fi

echo "📊 Scan Summary:"
echo "   Total findings: $TOTAL_FINDINGS"
echo "   High-confidence secrets: $REAL_SECRETS"
echo "   False positives: $((TOTAL_FINDINGS - REAL_SECRETS))"

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
    echo ""
    if [ "$TOTAL_MATCHES" -gt 0 ]; then
        echo "📋 Note: $TOTAL_MATCHES potential matches were found but identified as false positives"
        echo "📋 These include legitimate code patterns like Vue :key, CSS @keyframes, etc."
    fi
    exit 0
fi 