@echo off
cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=3000"
if not "%TTQ_HOST%"=="" set "HOST=%TTQ_HOST%"
if not "%TTQ_PORT%"=="" set "PORT=%TTQ_PORT%"

set "RELOAD="
if /i "%~1"=="dev" set "RELOAD=--reload"

set "PYEXE=%~dp0python\python.exe"
if not exist "%PYEXE%" set "PYEXE=python"

echo Starting ttq-time...
echo App   : http://%HOST%:%PORT%/index.html
echo API   : http://%HOST%:%PORT%/api
echo Press Ctrl+C to stop.
echo.

rem --- free the port if something is already listening on it ---
"%PYEXE%" -c "import socket,sys;s=socket.socket();r=s.connect_ex(('127.0.0.1',%PORT%));s.close();sys.exit(0 if r==0 else 1)" >nul 2>nul
if not errorlevel 1 (
  echo [info] Port %PORT% is occupied, killing the holder...
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
    echo        kill PID %%a
    taskkill /F /PID %%a >nul 2>nul
  )
  "%PYEXE%" -c "import time;time.sleep(2)"
  echo.
)

rem --- install backend dependencies if missing (best effort) ---
"%PYEXE%" -c "import fastapi, uvicorn, multipart" >nul 2>nul
if errorlevel 1 (
  echo [setup] Installing backend dependencies...
  "%PYEXE%" -m pip install --disable-pip-version-check --no-input -r "%~dp0backend\requirements.txt"
)

rem --- open the browser after a short delay ---
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://%HOST%:%PORT%/index.html"

rem --- run the server in this window (Ctrl+C stops it) ---
pushd "%~dp0backend"
"%PYEXE%" -m uvicorn app.main:app --host %HOST% --port %PORT% %RELOAD%
popd

echo.
echo Server stopped.
pause
