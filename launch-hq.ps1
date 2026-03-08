# VikingClaw HQ Launcher
Write-Host "⚔️  Starting VikingClaw HQ..." -ForegroundColor Cyan

# Ensure config exists
$configPath = "$env:USERPROFILE\.vikingclaw\config.yaml"
if (-not (Test-Path $configPath)) {
    Write-Host "⚠️  No config found at $configPath" -ForegroundColor Yellow
    Write-Host "   Run: wsl -d Ubuntu -e /mnt/c/VikingClaw/vikingclaw onboard" -ForegroundColor Yellow
}

# Start Go backend in WSL
$backend = Start-Process wsl `
    -ArgumentList "-d", "Ubuntu", "-e", "bash", "-c", "/mnt/c/VikingClaw/vikingclaw start" `
    -PassThru -WindowStyle Hidden
Write-Host "✅ Backend started (PID: $($backend.Id))" -ForegroundColor Green

# Wait for API to become available
Write-Host "🕐 Waiting for API on http://localhost:7070..." -ForegroundColor Cyan
$tries = 0
do {
    Start-Sleep 1
    $tries++
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:7070/api/status" -UseBasicParsing -TimeoutSec 2
        $ready = $true
    } catch {
        $ready = $false
    }
} until ($ready -or $tries -ge 15)

if ($ready) {
    Write-Host "✅ API is ready!" -ForegroundColor Green
    Write-Host "🌐 Opening HQ Dashboard at http://localhost:7070" -ForegroundColor Cyan
    Start-Process "http://localhost:7070"
} else {
    Write-Host "⚠️  API did not start in time. Check logs." -ForegroundColor Yellow
    Write-Host "   Try: wsl -d Ubuntu cat /tmp/vc.log" -ForegroundColor Yellow
}

Write-Host "⚔️  VikingClaw is running! Close this window to stop." -ForegroundColor Green
Write-Host "   Dashboard: http://localhost:7070" -ForegroundColor Cyan
Write-Host "   API:       http://localhost:7070/api/status" -ForegroundColor Cyan

try {
    Wait-Process -Id $backend.Id
} catch {
    # Process already exited or wasn't tracked
}
