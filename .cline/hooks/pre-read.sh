#!/bin/bash
# Pre-read hook: Runs before reading any file
# Purpose: Log file access for audit trail

FILE_PATH="$1"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] READ: $FILE_PATH" >> /tmp/.cline-file-access.log