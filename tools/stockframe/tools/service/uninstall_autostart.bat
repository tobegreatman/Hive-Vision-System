@echo off
setlocal
set "TASK=stockframe-server"
schtasks /delete /tn "%TASK%" /f
if errorlevel 1 (
  echo [i] 没有找到计划任务 "%TASK%"
) else (
  echo [ok] 已移除自启
)
pause
