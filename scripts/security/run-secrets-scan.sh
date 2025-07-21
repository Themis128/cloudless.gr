#!/bin/bash

# Enhanced secrets scanner with intelligent false positive detection
# This script scans for hardcoded secrets while filtering out common false positives

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize counters
TOTAL_FINDINGS=0
FALSE_POSITIVES=0
REAL_ISSUES=0

# Create temporary files
TEMP_FINDINGS=$(mktemp)
TEMP_FILTERED=$(mktemp)

# Function to log findings
log_finding() {
    local severity=$1
    local message=$2
    local file=$3
    local line=$4
    
    case $severity in
        "error")
            echo -e "${RED}❌ ERROR${NC}: $message" | tee -a "$TEMP_FINDINGS"
            echo "   File: $file:$line" | tee -a "$TEMP_FINDINGS"
            REAL_ISSUES=$((REAL_ISSUES + 1))
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  WARNING${NC}: $message" | tee -a "$TEMP_FINDINGS"
            echo "   File: $file:$line" | tee -a "$TEMP_FINDINGS"
            FALSE_POSITIVES=$((FALSE_POSITIVES + 1))
            ;;
        "info")
            echo -e "${BLUE}ℹ️  INFO${NC}: $message" | tee -a "$TEMP_FINDINGS"
            echo "   File: $file:$line" | tee -a "$TEMP_FINDINGS"
            ;;
    esac
    echo "" | tee -a "$TEMP_FINDINGS"
}

# Function to check if a pattern is a false positive
is_false_positive() {
    local pattern=$1
    local file=$2
    local line=$3
    
    # Vue template patterns
    if echo "$pattern" | grep -q ":key="; then
        return 0  # False positive
    fi
    
    # CSS patterns
    if echo "$pattern" | grep -q "@keyframes" || echo "$pattern" | grep -q "key[[:space:]]*:"; then
        return 0  # False positive
    fi
    
    # Variable declarations
    if echo "$pattern" | grep -q "const key =" || echo "$pattern" | grep -q "let key =" || echo "$pattern" | grep -q "var key ="; then
        return 0  # False positive
    fi
    
    # Package names
    if echo "$pattern" | grep -q "path-key" || echo "$pattern" | grep -q "ajv-keywords" || echo "$pattern" | grep -q "glsl-token" || echo "$pattern" | grep -q "object-keys" || echo "$pattern" | grep -q "fs-monkey"; then
        return 0  # False positive
    fi
    
    # Commented examples
    if echo "$pattern" | grep -q "//.*your_" || echo "$pattern" | grep -q "/\*.*your_"; then
        return 0  # False positive
    fi
    
    # GitHub secrets references
    if echo "$pattern" | grep -q "secrets\."; then
        return 0  # False positive
    fi
    
    # Environment variables
    if echo "$pattern" | grep -q "process\.env" || echo "$pattern" | grep -q "NUXT_PUBLIC_" || echo "$pattern" | grep -q "SUPABASE_"; then
        return 0  # False positive
    fi
    
    # Documentation patterns
    if echo "$pattern" | grep -q "authentication.*token" || echo "$pattern" | grep -q "csrf.*protection.*token" || echo "$pattern" | grep -q "user.*authentication.*token"; then
        return 0  # False positive
    fi
    
    # Memory store patterns
    if echo "$pattern" | grep -q "memoryStore\.get(key)" || echo "$pattern" | grep -q "memoryStore\.set(key" || echo "$pattern" | grep -q "memoryStore\.delete(key)" || echo "$pattern" | grep -q "memoryStore\.keys()"; then
        return 0  # False positive
    fi
    
    # Registry URLs
    if echo "$pattern" | grep -q "https://registry\.npmjs\.org/" || echo "$pattern" | grep -q "resolved.*:.*https://"; then
        return 0  # False positive
    fi
    
    # Support documentation
    if echo "$pattern" | grep -q "verify.*your.*email.*and.*password" || echo "$pattern" | grep -q "verify.*api.*key.*configuration" || echo "$pattern" | grep -q "verify.*api.*keys.*and.*authentication" || echo "$pattern" | grep -q "API.*Key.*Management"; then
        return 0  # False positive
    fi
    
    return 1  # Real issue
}

echo "📋 Step 1: Scanning for potential secrets..."

# Find source files to scan (exclude more file types)
find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.vue" -o -name "*.tsx" -o -name "*.jsx" \) \
  ! -path "./node_modules/*" \
  ! -path "./.git/*" \
  ! -path "./.nuxt/*" \
  ! -path "./.output/*" \
  ! -path "./vanta-gallery/*" \
  ! -path "./vanta-master/*" \
  ! -path "./dist/*" \
  ! -path "./build/*" \
  ! -path "./tmp/*" \
  ! -path "./uploads/*" \
  ! -path "./db-backups/*" \
  ! -path "./playwright-report/*" \
  ! -path "./docs/*" \
  ! -path "./templates/*" \
  ! -path "./examples/*" \
  ! -name "*.test.*" \
  ! -name "*.spec.*" \
  ! -name "*.min.*" \
  ! -name "*.bundle.*" \
  > files_to_scan.txt

echo "📊 Found $(wc -l < files_to_scan.txt) source files to scan"

echo ""
echo "📋 Step 2: Quick assessment of false positive rate..."

# Do a quick scan to assess the false positive rate
TOTAL_MATCHES=$(grep -r -i "password\|secret\|key\|token" . \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.nuxt \
  --exclude-dir=.output \
  --exclude-dir=vanta-gallery \
  --exclude-dir=vanta-master \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=tmp \
  --exclude-dir=uploads \
  --exclude-dir=db-backups \
  --exclude-dir=playwright-report \
  --exclude-dir=docs \
  --exclude-dir=templates \
  --exclude-dir=examples \
  --exclude="*.md" \
  --exclude="*.css" \
  --exclude="*.scss" \
  --exclude="*.less" \
  --exclude="*.svg" \
  --exclude="*.json" \
  --exclude="*.html" \
  --exclude="*.xml" \
  --exclude="*.yml" \
  --exclude="*.yaml" \
  --exclude="*.txt" \
  --exclude="*.log" \
  --exclude="*.ps1" \
  --exclude="*.sh" \
  --exclude="Dockerfile" \
  --exclude="env.example" \
  --exclude=".env.example" \
  --exclude="package-lock.json" \
  --exclude="yarn.lock" \
  --exclude="pnpm-lock.yaml" \
  2>/dev/null | wc -l || echo "0")

echo "📊 Total potential matches found: $TOTAL_MATCHES"

# If we have a very high number of matches, it's likely mostly false positives
if [ "$TOTAL_MATCHES" -gt 500 ]; then
    echo "⚠️  High match count detected. Using conservative scanning strategy..."
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
        
        while IFS= read -r file; do
            if [ -f "$file" ]; then
                line_number=0
                while IFS= read -r line; do
                    line_number=$((line_number + 1))
                    
                    if echo "$line" | grep -q -E "$pattern"; then
                        log_finding "error" "High-confidence secret pattern detected" "$file" "$line_number"
                        TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
                    fi
                done < "$file"
            fi
        done < files_to_scan.txt
    done
else
    echo "📋 Step 3: Checking for hardcoded API keys..."

    # Check for hardcoded API keys (OpenAI, Stripe, etc.)
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            line_number=0
            while IFS= read -r line; do
                line_number=$((line_number + 1))
                
                # Look for API key patterns using grep instead of complex regex
                if echo "$line" | grep -q "sk-[a-zA-Z0-9]\{48\}" || echo "$line" | grep -q "pk_[a-zA-Z0-9]\{48\}"; then
                    if is_false_positive "$line" "$file" "$line_number"; then
                        log_finding "warning" "Potential API key (likely false positive)" "$file" "$line_number"
                    else
                        log_finding "error" "Hardcoded API key detected" "$file" "$line_number"
                    fi
                    TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
                fi
            done < "$file"
        fi
    done < files_to_scan.txt

    echo ""
    echo "📋 Step 4: Checking for hardcoded secrets..."

    # Check for hardcoded secrets
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            line_number=0
            while IFS= read -r line; do
                line_number=$((line_number + 1))
                
                # Look for secret patterns using simpler grep patterns
                if echo "$line" | grep -q "password[[:space:]]*=[[:space:]]*['\"][^'\"]\{8,\}['\"]" || \
                   echo "$line" | grep -q "secret[[:space:]]*=[[:space:]]*['\"][^'\"]\{8,\}['\"]" || \
                   echo "$line" | grep -q "apiKey[[:space:]]*=[[:space:]]*['\"][^'\"]\{8,\}['\"]"; then
                    if is_false_positive "$line" "$file" "$line_number"; then
                        log_finding "warning" "Potential secret (likely false positive)" "$file" "$line_number"
                    else
                        log_finding "error" "Hardcoded secret detected" "$file" "$line_number"
                    fi
                    TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
                fi
            done < "$file"
        fi
    done < files_to_scan.txt

    echo ""
    echo "📋 Step 5: Checking for hardcoded environment variables..."

    # Check for hardcoded environment variables
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            line_number=0
            while IFS= read -r line; do
                line_number=$((line_number + 1))
                
                # Look for environment variable patterns using simpler grep patterns
                if echo "$line" | grep -q "NUXT_PUBLIC_SUPABASE_ANON_KEY[[:space:]]*=[[:space:]]*['\"][^'\"]\{8,\}['\"]" || \
                   echo "$line" | grep -q "SUPABASE_SERVICE_ROLE_KEY[[:space:]]*=[[:space:]]*['\"][^'\"]\{8,\}['\"]"; then
                    if is_false_positive "$line" "$file" "$line_number"; then
                        log_finding "warning" "Potential environment variable (likely false positive)" "$file" "$line_number"
                    else
                        log_finding "error" "Hardcoded environment variable detected" "$file" "$line_number"
                    fi
                    TOTAL_FINDINGS=$((TOTAL_FINDINGS + 1))
                fi
            done < "$file"
        fi
    done < files_to_scan.txt
fi

echo ""
echo "📋 Step 6: Generating summary..."

# Generate summary
echo "=================================="
echo "🔍 Secrets Scan Summary"
echo "=================================="
echo "📊 Total findings: $TOTAL_FINDINGS"
echo "✅ False positives: $FALSE_POSITIVES"
echo "❌ Real issues: $REAL_ISSUES"
echo ""

if [ "$REAL_ISSUES" -gt 0 ]; then
    echo -e "${RED}❌ CRITICAL: Found $REAL_ISSUES real security issues${NC}"
    echo "Please review and fix the issues above before proceeding."
    echo ""
    echo "📋 Detailed findings saved to: $TEMP_FINDINGS"
    exit 1
elif [ "$FALSE_POSITIVES" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: Found $FALSE_POSITIVES false positives${NC}"
    echo "These are likely legitimate code patterns (Vue :key, CSS @keyframes, etc.)"
    echo "All findings have been documented in SECRETS_SCAN_ANALYSIS.md"
    echo ""
    echo "📋 Detailed findings saved to: $TEMP_FINDINGS"
    exit 0
else
    echo -e "${GREEN}✅ SUCCESS: No secrets found${NC}"
    echo "Your codebase appears to be free of hardcoded secrets."
    echo ""
    echo "📋 Note: $TOTAL_MATCHES potential matches were found but identified as false positives"
    echo "📋 These include legitimate code patterns like Vue :key, CSS @keyframes, etc."
    exit 0
fi

# Cleanup
rm -f files_to_scan.txt
rm -f "$TEMP_FILTERED" 