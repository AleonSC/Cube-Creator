@echo off
rem Runs Cube Creator from source with live reload. (Just want to use it? Double-click Cube-Creator.html instead.)
cd /d "%~dp0"
where npm >nul 2>nul || (echo Node.js is required: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (echo Installing dependencies, first run only... & call npm install || (pause & exit /b 1))
call npm start
pause
