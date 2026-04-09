param (
    [string]$SourceFolder = ".",
    [string]$OutputFile = "codebase_export.txt"
)

# 1. Define Exclusions to prevent dumping massive or unreadable files
$ExcludeFolders = @('.git', 'node_modules', 'bin', 'obj', '.vs', 'venv', 'packages', 'dist', 'build')
$ExcludeExtensions = @('.exe', '.dll', '.png', '.jpg', '.jpeg', '.gif', '.zip', '.pdf', '.pdb', '.suo', '.user', '.log', '.mp4')

# Resolve absolute path for output file to avoid reading it while writing
$OutputFilePath = Join-Path (Resolve-Path $SourceFolder).Path $OutputFile
if (Test-Path $OutputFilePath) { Remove-Item $OutputFilePath }

Write-Host "Starting export of $SourceFolder to $OutputFile..." -ForegroundColor Cyan

# 2. Write the Folder Structure
"====================================================================`n" | Out-File $OutputFilePath -Append -Encoding utf8
"                         FOLDER STRUCTURE                           `n" | Out-File $OutputFilePath -Append -Encoding utf8
"====================================================================`n" | Out-File $OutputFilePath -Append -Encoding utf8

# Use Windows built-in tree command (outputs structure beautifully)
# Note: tree.com outputs in ASCII/Unicode, which might need formatting depending on the terminal
cmd.exe /c "tree $SourceFolder /F /A" | Out-File $OutputFilePath -Append -Encoding utf8

"`n`n====================================================================`n" | Out-File $OutputFilePath -Append -Encoding utf8
"                          FILE CONTENTS                             `n" | Out-File $OutputFilePath -Append -Encoding utf8
"====================================================================`n" | Out-File $OutputFilePath -Append -Encoding utf8

# 3. Gather and Write File Contents
$files = Get-ChildItem -Path $SourceFolder -Recurse -File

$processedCount = 0

foreach ($file in $files) {
    $skip = $false

    # Check if file is in an excluded folder
    foreach ($folder in $ExcludeFolders) {
        # Check if the folder is part of the path (using regex boundary)
        if ($file.FullName -match "\\$folder\\") { 
            $skip = $true; 
            break 
        }
    }

    # Check if file has an excluded extension
    if ($ExcludeExtensions -contains $file.Extension.ToLower()) { 
        $skip = $true 
    }

    # Skip the output file itself
    if ($file.FullName -eq $OutputFilePath) { 
        $skip = $true 
    }

    if (-not $skip) {
        # Get relative path for cleaner reading
        $relativePath = $file.FullName.Substring((Resolve-Path $SourceFolder).Path.Length).Trim('\')
        
        "--------------------------------------------------------------------`n" | Out-File $OutputFilePath -Append -Encoding utf8
        "FILE: $relativePath`n" | Out-File $OutputFilePath -Append -Encoding utf8
        "--------------------------------------------------------------------`n" | Out-File $OutputFilePath -Append -Encoding utf8

        try {
            # Read content and append
            $content = Get-Content $file.FullName -Raw -ErrorAction Stop
            $content | Out-File $OutputFilePath -Append -Encoding utf8
            $processedCount++
        } catch {
            "[Error reading file or file is binary]`n" | Out-File $OutputFilePath -Append -Encoding utf8
        }
        
        "`n`n" | Out-File $OutputFilePath -Append -Encoding utf8
    }
}

Write-Host "Export complete! Successfully wrote $processedCount files to $OutputFile" -ForegroundColor Green