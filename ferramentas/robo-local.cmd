@echo off
rem ============================================================
rem robo-local.cmd - roda o robo local do Hub neste computador
rem ------------------------------------------------------------
rem Chamado pela tarefa agendada do Windows (de meia em meia hora,
rem ver README, "O robo local"). Trabalha numa copia propria do
rem repositorio (a pasta onde este arquivo esta), nunca na pasta de
rem desenvolvimento: puxa o que ha de novo, le as fontes locais
rem (hoje, a SEFAZ/SE), e envia dados/fontes/*.json se mudou.
rem O log fica em %LOCALAPPDATA%\HubTotali\robo-local.log.
rem ============================================================
setlocal
set "RAIZ=%~dp0.."
set "LOG=%LOCALAPPDATA%\HubTotali\robo-local.log"
if not exist "%LOCALAPPDATA%\HubTotali" mkdir "%LOCALAPPDATA%\HubTotali"
cd /d "%RAIZ%" || exit /b 1

echo. >> "%LOG%"
echo ===== %DATE% %TIME% ===== >> "%LOG%"
git pull --ff-only -q >> "%LOG%" 2>&1
if errorlevel 1 (
  echo pull falhou; sigo com o que ha. >> "%LOG%"
)
node ferramentas\buscar-fonte-local.js >> "%LOG%" 2>&1
git add dados\fontes >> "%LOG%" 2>&1
git diff --cached --quiet
if errorlevel 1 (
  git -c user.name="Robo local do Hub" -c user.email="hub-robo-local@users.noreply.github.com" commit -q -m "SEFAZ/SE: noticias lidas pelo robo local do escritorio" >> "%LOG%" 2>&1
  git push -q >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo push falhou; tento de novo na proxima rodada. >> "%LOG%"
  ) else (
    echo enviado. >> "%LOG%"
  )
) else (
  echo nada mudou. >> "%LOG%"
)
rem O log nao cresce para sempre: acima de ~400 KB, recomeca.
for %%A in ("%LOG%") do if %%~zA GTR 400000 (
  echo (log reiniciado em %DATE% %TIME%) > "%LOG%"
)
endlocal
