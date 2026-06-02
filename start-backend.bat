@echo off
cd /d "e:\BST_lab\greenproject\greenway-backend"

echo ========================================
echo   Beijing Greenway - Backend Server
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found
    pause
    exit /b 1
)

if not exist node_modules\ (
    echo [INSTALL] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
)

echo [START] Backend server on port 3001
echo         http://localhost:3001
echo         Ctrl+C to stop
echo.

npm start
pause
