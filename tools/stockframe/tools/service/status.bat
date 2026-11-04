@echo off
rem 看服务在不在跑
setlocal
set "PORT=8770"

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"`) do set "PID=%%P"

if defined PID (
  echo [ok] 正在运行  http://127.0.0.1:%PORT%/   PID=%PID%
  echo      日志：%~dp0..\..\logs\server.log
) else (
  echo [i] 未运行
)
exit /b 0
