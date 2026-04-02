@echo off
chcp 65001 >nul

echo [1/4] Pulling the latest code from GitHub...
git pull

echo [2/4] Activating backend virtual environment and updating vector database...
cd backend
call .venv\Scripts\activate
python ingest.py

echo [3/4] Starting Vite frontend in a new window...
cd ..
:: "start cmd /k" opens a new terminal window for the frontend and keeps it open
start cmd /k "npm install & npm run dev"

echo [4/4] Starting FastAPI backend...
cd backend
uvicorn app.main:app --reload --port 8000

pause