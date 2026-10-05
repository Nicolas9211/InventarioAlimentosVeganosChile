@echo off
title Inventario Alimentos Veganos
cd /d "%~dp0"

start "Backend - Inventario" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && python -m uvicorn main:app"
start "Frontend - Inventario" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 6 /nobreak >nul
start http://localhost:5173