@echo off
rem 双击启动：静默拉起 stockframe 控制台，然后打开浏览器；本窗口会自己关掉。
setlocal
set "PORT=8770"

where pythonw.exe >nul 2>&1
if errorlevel 1 (
  echo [x] PATH 里找不到 pythonw.exe，请确认 Python 已安装并加入 PATH
  pause
  exit /b 1
)

start "" pythonw.exe "%~dp0start.pyw"

rem 等端口起来再开浏览器（最多约 6 秒）
for /l %%i in (1,1,6) do (
  powershell -NoProfile -Command "if((Test-NetConnection -ComputerName 127.0.0.1 -Port %PORT% -InformationLevel Quiet -WarningAction SilentlyContinue)){exit 0}else{exit 1}" >nul 2>&1
  if not errorlevel 1 goto :ready
  timeout /t 1 /nobreak >nul
)

echo [!] %PORT% 端口还没监听，看日志：%~dp0..\..\logs\server.log
pause
exit /b 1

:ready
start "" "http://127.0.0.1:%PORT%/"
exit /b 0
