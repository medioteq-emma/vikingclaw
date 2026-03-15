$content = Get-Content 'C:\VikingClaw\install.ps1' -Raw
$errors = $null
$null = [System.Management.Automation.Language.Parser]::ParseInput($content, [ref]$null, [ref]$errors)
if ($errors.Count -eq 0) {
    Write-Host 'install.ps1 syntax OK'
} else {
    Write-Host "install.ps1 has $($errors.Count) syntax errors:"
    $errors | ForEach-Object { Write-Host "  Line $($_.Extent.StartLineNumber): $_" }
}
