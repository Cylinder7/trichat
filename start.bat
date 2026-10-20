@echo off
title TriChat Bridge
echo ============================================
echo   TriChat Bridge - starting the hub...
echo ============================================
echo.
node server.js
echo.
echo The bridge stopped running. If you saw "Cannot find module",
echo run: npm install   (one time)  and then start.bat again.
pause
