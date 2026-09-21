@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem ==========================================================================
rem  ttq-time  -  one click launcher (FastAPI backend + static frontend)
rem  ASCII only: non-ASCII bytes break cmd.exe on GBK consoles.
rem
rem  Usage:
rem    run.bat        normal start
rem    run.bat dev    start with auto-reload (development)
rem ==========================================================================

rem --- keep the repo git hooks active (idempotent; silent if git is absent) ---
if exist "%~dp0.githooks\pre-commit" git config core.hooksPath .githooks >nul 2>nul

set "HOST=127.0.0.1"
set "PORT=3000"
if not "%TTQ_HOST%"=="" set "HOST=%TTQ_HOST%"
if not "%TTQ_PORT%"=="" set "PORT=%TTQ_PORT%"

set "RELOAD="
if /i "%~1"=="dev" set "RELOAD=--reload"

set "BUNDLED=%~dp0python\python.exe"
set "PY="
set "USING_BUNDLED=0"

if exist "%BUNDLED%" (
  set "PY=%BUNDLED%"
  set "USING_BUNDLED=1"
) else (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)

if "%PY%"=="" (
  where py >nul 2>nul
  if not errorlevel 1 set "PY=py"
)

if "%PY%"=="" (
  echo.
  echo [ERROR] No Python runtime found.
  echo         Bundled runtime expected at: %BUNDLED%
  echo         Install Python 3.11+ and add it to PATH, then retry.
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo   ttq-time  -  Timeline Review System
echo ------------------------------------------------------------
echo   App     : http://%HOST%:%PORT%/index.html
echo   API     : http://%HOST%:%PORT%/api
echo   Stop    : press Ctrl+C in this window
echo ============================================================
echo.

if "%USING_BUNDLED%"=="1" (
  echo [info] Using bundled runtime: .\python\python.exe
) else (
  echo [info] Using system runtime: %PY%
)
echo.

rem --- port availability check (prevents a silent crash on bind failure) ---
"%PY%" -c "import socket,sys;s=socket.socket();r=s.connect_ex(('127.0.0.1',%PORT%));s.close();sys.exit(0 if r==0 else 1)" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo [WARN] Port %PORT% is already in use.
  echo        A ttq-time server may already be running. Try opening:
  echo            http://%HOST%:%PORT%/index.html
  echo.
  echo        To start a fresh instance on another port, either:
  echo          1. close the existing window or process, then run run.bat again.
  echo          2. set TTQ_PORT=3100 or any free port, then run run.bat.
  echo.
  pause
  exit /b 0
)

rem --- make sure backend dependencies are importable -------------------------
"%PY%" -c "import fastapi, uvicorn, multipart" >nul 2>nul
if errorlevel 1 (
  echo [setup] Backend dependencies missing, installing now...
  "%PY%" -m pip install --disable-pip-version-check --no-input -r "%~dp0backend\requirements.txt"
  if errorlevel 1 (
    echo [setup] Retrying with the official PyPI index...
    "%PY%" -m pip install --disable-pip-version-check --no-input --index-url https://pypi.org/simple -r "%~dp0backend\requirements.txt"
    if errorlevel 1 (
      echo.
      echo [ERROR] Failed to install dependencies. Check your network connection.
      echo.
      pause
      exit /b 1
    )
  )
  echo [setup] Dependencies installed.
  echo.
)

rem --- open the browser shortly after the server starts ----------------------
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process 'http://%HOST%:%PORT%/index.html'"

rem --- run the server in this window (Ctrl+C stops it) -----------------------
pushd "%~dp0backend"
"%PY%" -m uvicorn app.main:app --host %HOST% --port %PORT% %RELOAD%
set "RC=%ERRORLEVEL%"
popd

echo.
echo [server stopped] exit code = %RC%
if not %RC%==0 (
  echo.
  echo [hint] If it says the address is already in use, another instance is
  echo        running. Close it or start on a different port (set TTQ_PORT=xxxx).
  echo.
)
pause
