@echo off
setlocal
set PYTHON_EXE=c:\xampp\htdocs\strandwise\.venv\Scripts\python.exe
if not exist "%PYTHON_EXE%" (
  echo Python environment not found at %PYTHON_EXE%
  exit /b 1
)

"%PYTHON_EXE%" "c:\xampp\htdocs\strandwise\ml\flask_service.py"
endlocal
