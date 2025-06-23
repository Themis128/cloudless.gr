# PowerShell script to extract all essential SQL DDL/DML statements from a .sql file
# Supports CREATE TABLE, INSERT INTO, CREATE FUNCTION/TRIGGER/TYPE, CREATE POLICY, GRANT, ALTER, CREATE INDEX/VIEW/SEQUENCE, COMMENT ON, SET, etc.

$inputFile = "local-backup.sql"
$outputFile = "local-backup-clean.sql"

# Read all lines from the input file
$lines = Get-Content $inputFile

# Define regex patterns for multi-line blocks (ordered for priority)
$startPatterns = @(
    '^CREATE\s+TABLE',
    '^INSERT\s+INTO',
    '^CREATE\s+FUNCTION',
    '^CREATE\s+TRIGGER',
    '^CREATE\s+TYPE',
    '^CREATE\s+POLICY',
    '^GRANT',
    '^ALTER\s+TABLE',
    '^ALTER\s+FUNCTION',
    '^CREATE\s+INDEX',
    '^CREATE\s+VIEW',
    '^CREATE\s+SEQUENCE',
    '^COMMENT\s+ON',
    '^SET',
    '^SELECT\s+pg_catalog\.set_config'
)

# Array to hold output
$output = @()
$insideBlock = $false
$blockBuffer = @()

foreach ($line in $lines) {
    if ($insideBlock) {
        $blockBuffer += $line
        if ($line -match ';\s*$') {
            # End of statement
            $output += $blockBuffer
            $output += ""
            $blockBuffer = @()
            $insideBlock = $false
        }
        continue
    }

    foreach ($pattern in $startPatterns) {
        if ($line -match $pattern) {
            $blockBuffer = @()
            $blockBuffer += $line
            $insideBlock = $true
            break
        }
    }
}

# Write the cleaned output
$output | Set-Content $outputFile

Write-Host "✅ Filtered SQL written to $outputFile"
