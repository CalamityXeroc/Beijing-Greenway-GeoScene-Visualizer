@echo off
cd /d "e:\BST_lab\greenproject\greenway-vue"

echo ========================================
echo   Beijing Greenway - Frontend Server
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

echo [START] Frontend dev server on port 5173
echo         http://localhost:5173
echo         Ctrl+C to stop
echo.

call npm run dev
pause
