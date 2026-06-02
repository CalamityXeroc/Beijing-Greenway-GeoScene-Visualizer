@echo off
cd /d "e:\BST_lab\greenproject"

echo ========================================
echo   Beijing Greenway - Start All
echo ========================================
echo.

echo [1/2] Starting backend (port 3001)...
start "Backend" cmd /k "cd /d e:\BST_lab\greenproject && start-backend.bat"

echo        Waiting 5s for backend...
timeout /t 5 /nobreak >nul

echo.
echo [2/2] Starting frontend (port 5173)...
start "Frontend" cmd /k "cd /d e:\BST_lab\greenproject\greenway-vue && start-frontend.bat"

echo.
echo ========================================
echo   Backend : http://localhost:3001
echo   Frontend: http://localhost:5173
echo   Map    : http://localhost:5173/map
echo ========================================
echo.

pause
