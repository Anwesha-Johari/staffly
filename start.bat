@echo off
rem Starts the Staffly frontend. Put your database .env (the one the Python backend uses)
rem in this folder or in backend\ before running.
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
if not exist "..\.env" if not exist "..\backend\.env" if not exist ".env.local" (
  echo.
  echo No database settings found. Copy your .env file ^(with DB_USER and DB_PASSWORD^) into:
  echo   %~dp0
  echo then run this again.
  pause
  exit /b 1
)
start "" http://localhost:3000
call npm run dev
pause
