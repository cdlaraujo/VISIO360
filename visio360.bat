@echo off
cd /d "%~dp0"
start http://localhost:3000
npx serve -l 3000
pause
