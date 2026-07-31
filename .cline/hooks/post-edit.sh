#!/bin/bash
# Post-edit hook: Runs after editing any file
# Purpose: Validate file syntax and log changes

FILE_PATH="$1"
EXTENSION="${FILE_PATH##*.}"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] EDIT: $FILE_PATH" >> /tmp/.cline-file-access.log

# Basic syntax validation for TypeScript/JavaScript files
if [[ "$EXTENSION" == "ts" || "$EXTENSION" == "tsx" ]]; then
  # Check for common issues
  if grep -n "console\.log" "$FILE_PATH" 2>/dev/null | grep -v "//.*console\.log" | grep -v "test" > /dev/null; then
    echo "WARNING: $FILE_PATH contains console.log statements (debug logging)"
  fi
fi

# Check for TODO/FIXME markers
if grep -n "TODO\|FIXME\|HACK\|XXX" "$FILE_PATH" 2>/dev/null > /dev/null; then
  echo "INFO: $FILE_PATH contains TODO/FIXME markers"
fi