@echo off
title Oneda CRM - Painel de Controle
color 0b
echo ========================================================
echo        INICIANDO ONEDA CRM - PAINEL EXECUTIVO
echo ========================================================
echo.

cd /d "%~dp0"

echo Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [AVISO] Node.js nao encontrado no PATH do sistema.
    echo Abrindo CRM em modo direto offline...
    start "" "%~dp0index.html"
    pause
    exit /b
)

echo Iniciando servidor local Oneda CRM...
start "" /b node server.js

timeout /t 2 /nobreak >nul

if exist "%~dp0cloudflared.exe" (
    echo Iniciando tunel seguro para acesso no Smartphone...
    start "" /b "%~dp0cloudflared.exe" tunnel --url http://localhost:3000
)

echo Abrindo navegador em http://localhost:3000...
start "" "http://localhost:3000"

echo.
echo ========================================================
echo  CRM ativo e pronto para uso!
echo.
echo  👉 Acesso neste computador:
echo     http://localhost:3000
echo.
echo  👉 Acesso no Smartphone (Link Publico Seguro HTTPS):
echo     Acesse o link gerado pelo Cloudflare Tunnel
echo.
echo  👉 Acesso na Rede Local (mesmo Wi-Fi):
echo     http://192.168.0.95:3000
echo ========================================================
echo.
pause
