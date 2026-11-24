@echo off
cd /d "%~dp0"
title Knight War H5 - local server
where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080/"
  python -m http.server 8080
  pause
  exit /b
)
where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:8080/"
  py -3 -m http.server 8080
  pause
  exit /b
)
echo.
echo [X] Python not found.
echo   Install Python 3 (check "Add to PATH"): https://www.python.org/downloads/
echo   Or with Node.js: npx serve -p 8080
echo   Then open http://localhost:8080/
echo.
pause
