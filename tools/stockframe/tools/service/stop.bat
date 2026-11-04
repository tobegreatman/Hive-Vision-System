@echo off
rem 停止后台运行的 stockframe 控制台（按端口找进程，只杀监听 8770 的那个）
setlocal
set "PORT=8770"

set "PID="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess"`) do set "PID=%%P"

if not defined PID (
  echo [i] %PORT% 端口没有监听进程，服务本来就没在跑
  exit /b 0
)

echo [i] 正在结束 PID=%PID% ...
taskkill /PID %PID% /F >nul 2>&1
if errorlevel 1 (
  echo [x] 结束失败，可能需要管理员权限
  exit /b 1
)
echo [ok] 已停止
exit /b 0
