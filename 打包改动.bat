@echo off
chcp 65001 >nul
cd /d "%~dp0"
set STAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%
set STAMP=%STAMP: =0%
set OUT=..\改动打包_%STAMP%.zip
echo 正在收集代码与数据表（不含美术资源，体积小、方便传给我）...
powershell -NoProfile -Command "Compress-Archive -Path 'src','data','index.html' -DestinationPath '%OUT%' -Force"
if errorlevel 1 (
  echo [错误] 打包失败
  pause
  exit /b 1
)
echo 已生成: %OUT%
echo 把这个 zip 拖进对话框发给我，我就能同步到线上。
pause
