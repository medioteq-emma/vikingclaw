@echo off
title VikingClaw
color 0A
cls
echo.
echo   ^^  VikingClaw - Starting...
echo   ================================
echo.
echo   Make sure LM Studio or Ollama is running first!
echo.

REM Start the server in WSL
start /B wsl -d Ubuntu -- /mnt/c/VikingClaw/vikingclaw start

echo   Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Open browser
start http://localhost:7070

echo.
echo   VikingClaw is running!
echo   Dashboard: http://localhost:7070
echo.
echo   Press any key to stop VikingClaw...
pause >nul

REM Stop the server
wsl -d Ubuntu -- pkill -f vikingclaw 2>nul
echo   VikingClaw stopped.
