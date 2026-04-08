@echo off
title KeanGlobal Dev Server
echo ==================================================
echo  Starting KeanGlobal Development Environment...
echo ==================================================

:: 1. 啟動 Ollama 模型 (會開新視窗保持運行)
echo [1/4] Starting Ollama with Mistral...
start "Ollama - Mistral" cmd /k "ollama run mistral"

:: 等待 3 秒確保 Ollama 啟動
timeout /t 3 /nobreak >nul

:: 2. 執行 Ingest 資料導入
echo [2/4] Running Document Ingestion...
cd backend
:: Windows 環境下的 venv 啟動路徑是 Scripts\activate
if exist .venv\Scripts\activate (
    call .venv\Scripts\activate
) else (
    echo Warning: Virtual environment not found in backend/.venv!
)
:: 假設你的 ingest 程式碼叫做 ingest.py，如果檔名不同請自行修改下面這行
python ingest.py
cd ..

:: 3. 啟動 FastAPI 後端 (會開新視窗保持運行)
echo [3/4] Starting FastAPI Backend on port 8000...
start "FastAPI Backend" cmd /k "cd backend && call .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

:: 4. 啟動 React 前端 (會開新視窗保持運行)
echo [4/4] Starting React Frontend on port 5173...
start "React Frontend" cmd /k "npm run dev"

echo ==================================================
echo  All services are launching in separate windows!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:8000/health
echo ==================================================
pause