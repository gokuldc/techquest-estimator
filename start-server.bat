@echo off
TITLE OpenPrix Master Server
color 0A

echo Checking system requirements...

:: 1. Check for global Node.js
node -v >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    echo [OK] Node.js detected on system.
    set NODE_BIN=node
    goto BOOT
)

:: 2. Check for local portable Node.js
IF EXIST "node.exe" (
    echo [OK] Portable Node.js detected.
    set NODE_BIN=.\node.exe
    goto BOOT
)

:: 3. Download Portable Node.js if completely missing
echo [!] Node.js not found.
echo [*] Downloading Portable Node Engine (approx 30MB)...
curl -L -o node.exe "https://nodejs.org/dist/v22.14.0/win-x64/node.exe"
set NODE_BIN=.\node.exe

:BOOT
echo [*] Booting OpenPrix Core...
%NODE_BIN% tui.js
pause