@echo off
rem 注册登录自启：每次登录 Windows 后自动在后台拉起服务（无窗口、无 CMD）
rem 卸载：uninstall_autostart.bat
setlocal
set "TASK=stockframe-server"

set "PYW="
for /f "usebackq delims=" %%P in (`where pythonw.exe`) do if not defined PYW set "PYW=%%P"
if not defined PYW (
  echo [x] PATH 里找不到 pythonw.exe
  pause
  exit /b 1
)

schtasks /create /tn "%TASK%" /tr "\"%PYW%\" \"%~dp0start.pyw\"" /sc onlogon /f
if errorlevel 1 (
  echo [x] 注册失败，试试右键“以管理员身份运行”
  pause
  exit /b 1
)

echo [ok] 已注册计划任务 "%TASK%"（登录时自动启动，工作目录 %~dp0..\..）
echo      手动立刻跑一次：schtasks /run /tn "%TASK%"
pause
