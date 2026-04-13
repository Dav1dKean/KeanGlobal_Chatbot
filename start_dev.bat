@echo off
title KeanGlobal Dev Server
echo ==================================================
echo  Starting KeanGlobal Development Environment...
echo ==================================================

:: 1. Start Ollama
echo [1/4] Starting Ollama with Mistral...
start "Ollama - Mistral" cmd /k "ollama run mistral"

timeout /t 3 /nobreak >nul

:: 2. Run Data Ingestion
echo [2/4] Running Document Ingestion...
cd backend
if exist .venv\Scripts\activate (
    call .venv\Scripts\activate
) else (
    echo Warning: Virtual environment not found in backend/.venv!
)
python ingest.py
cd ..

:: 3. Start FastAPI Backend (Opens in a new window and keeps running)
echo [3/4] Starting FastAPI Backend on port 8000...
start "FastAPI Backend" cmd /k "cd backend && call .venv\Scripts\activate && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

:: 4. Start React Frontend (Opens in a new window and keeps running)
echo [4/4] Starting React Frontend on port 5173...
start "React Frontend" cmd /k "npm run dev -- --host"

echo ==================================================
echo  All services are launching in separate windows!
echo  Local Frontend:   http://localhost:5173
echo  Local Backend:    http://localhost:8000/health
echo.
echo  To connect from your phone, check the "React Frontend"
echo  window for the "Network: http://192.168.x.x:5173" URL!
echo ==================================================
pause