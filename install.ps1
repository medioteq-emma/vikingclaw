# VikingClaw Windows Installer
# https://vikingclaw.com

$ErrorActionPreference = "Stop"

$Repo = "https://github.com/medioteq/vikingclaw"
$Site = "https://vikingclaw.com"
$Version = "1.0.0"

Write-Host ""
Write-Host "  ⚔️  VikingClaw Installer" -ForegroundColor White
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

$InstallDir = "$env:USERPROFILE\.vikingclaw\bin"
$ConfigDir = "$env:USERPROFILE\.vikingclaw\config"
$WorkspaceDir = "$env:USERPROFILE\.vikingclaw\workspace"

New-Item -ItemType Directory -Force $InstallDir | Out-Null
New-Item -ItemType Directory -Force $ConfigDir | Out-Null
New-Item -ItemType Directory -Force $WorkspaceDir | Out-Null

Write-Host "  📋 Platform: Windows x64" -ForegroundColor Gray
Write-Host "  📁 Install: $InstallDir" -ForegroundColor Gray
Write-Host ""

# Try to download binary
$BinaryUrl = "$Site/releases/vikingclaw-windows-amd64.exe"
$BinaryDest = "$InstallDir\vikingclaw.exe"

try {
    Write-Host "  ⬇️  Downloading VikingClaw..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $BinaryUrl -OutFile $BinaryDest -UseBasicParsing -TimeoutSec 60
    Write-Host "  ✅ Downloaded binary" -ForegroundColor Green
} catch {
    # Try local copy (dev mode)
    if (Test-Path "C:\VikingClaw\vikingclaw.exe") {
        Copy-Item "C:\VikingClaw\vikingclaw.exe" $BinaryDest
        Write-Host "  ✅ Installed from local build" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Could not download - please build from source" -ForegroundColor Yellow
        Write-Host "     git clone $Repo" -ForegroundColor Gray
        Write-Host "     cd vikingclaw && go build -o vikingclaw.exe ." -ForegroundColor Gray
    }
}

# Add to PATH
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($CurrentPath -notlike "*\.vikingclaw\bin*") {
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$InstallDir", "User")
    Write-Host "  ✅ Added to PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "  ✅ VikingClaw installed!" -ForegroundColor Green
Write-Host ""
Write-Host "  Get started:" -ForegroundColor White
Write-Host "    vikingclaw onboard" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Dashboard: http://localhost:7070" -ForegroundColor White
Write-Host "  Website:   https://vikingclaw.com" -ForegroundColor White
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""
