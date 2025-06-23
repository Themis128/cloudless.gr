# PowerShell script to split a large SQL file into smaller numbered chunks
# Each chunk will be up to 500 lines (adjustable)

$inputFile = "local-backup-clean-fixed.sql"
$outputPrefix = "local-backup-part-"
$linesPerFile = 500

$lines = Get-Content $inputFile
$totalLines = $lines.Count
$fileIndex = 1

for ($i = 0; $i -lt $totalLines; $i += $linesPerFile) {
    $chunk = $lines[$i..([Math]::Min($i + $linesPerFile - 1, $totalLines - 1))]
    $outputFile = "{0}{1}.sql" -f $outputPrefix, $fileIndex.ToString("D2")
    $chunk | Set-Content $outputFile
    Write-Host "✅ Wrote $outputFile ($($chunk.Count) lines)"
    $fileIndex++
}
