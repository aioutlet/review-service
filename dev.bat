@echo off
:loop
echo.
echo ============================================
echo Starting review service...
echo ============================================
echo.

REM Check if port 9001 is in use and kill the process
echo Checking port 9001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :9001 ^| findstr LISTENING') do (
    echo Port 9001 is in use by PID %%a, killing process...
    taskkill /PID %%a /F >nul 2>&1
    timeout /t 1 >nul
)

echo Starting service on port 9001...
npm run dev

echo.
echo ============================================
echo Service stopped. Press any key to restart or Ctrl+C to exit.
echo ============================================
pause > nul
goto loop
