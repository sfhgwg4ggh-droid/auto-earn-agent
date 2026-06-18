@echo off
chcp 65001 >nul
title 🤖 Auto-Earn 自动发帖
cd /d "%~dp0"

:menu
cls
echo.
echo ╔══════════════════════════════════════════╗
echo ║     🤖 全自动发帖系统                   ║
echo ╚══════════════════════════════════════════╝
echo.
echo   📕 小红书  — 自动生成笔记 + 发布
echo   🐟 闲鱼    — 自动生成Listing + 上架
echo.
echo ═══════════════════════════════════════════
echo.
echo   1. 🔑 首次登录（扫码保存Cookie）
echo   2. 📝 生成今日内容（不发帖）
echo   3. 🚀 生成 + 自动发帖
echo   4. 🖥️ CDP模式 — 连接已登录Chrome发帖
echo   5. 📊 查看状态
echo   0. ❌ 退出
echo.
set /p choice="👉 选择操作 (0-5): "

if "%choice%"=="1" goto login
if "%choice%"=="2" goto generate
if "%choice%"=="3" goto post
if "%choice%"=="4" goto cdp
if "%choice%"=="5" goto status
if "%choice%"=="0" exit /b
goto menu

:login
echo.
echo ═══════════════════════════════════════════
echo   🔑 登录小红书 + 闲鱼
echo ═══════════════════════════════════════════
echo.
echo 📕 小红书登录 — 浏览器窗口会打开，请扫码：
call node modules/xiaohongshu/auto-poster.js --login
echo.
echo 🐟 闲鱼登录  — 浏览器窗口会打开，请扫码：
call node modules/xianyu/auto-lister.js --login
echo.
echo ✅ 登录完成！Cookie 已保存。
pause
goto menu

:generate
echo.
echo 📝 生成今日内容（不发帖）...
call node modules/social/social-pipeline.js
echo.
pause
goto menu

:post
echo.
echo 🚀 生成 + 自动发帖...
call node modules/social/social-pipeline.js --post
echo.
pause
goto menu

:cdp
echo.
echo 🖥️ CDP模式 — 需要先手动启动Chrome：
echo    chrome.exe --remote-debugging-port=9222
echo    然后在Chrome中手动登录小红书和闲鱼
echo.
echo 准备好了吗？按任意键继续...
pause >nul
call node modules/social/social-pipeline.js --post --cdp
pause
goto menu

:status
echo.
echo 📊 系统状态：
call node agent.js --report
echo.
echo 📱 社交电商统计：
call node -e "import('./modules/social/social-pipeline.js').then(m=>m.default.getSocialStats()).then(s=>{console.log('  小红书: '+s.xiaohongshu.total+' 篇 ('+s.xiaohongshu.published+' 已发)');console.log('  闲鱼:   '+s.xianyu.total+' 个 ('+s.xianyu.published+' 已发)');})"
echo.
pause
goto menu
