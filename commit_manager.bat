@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

title GCPShot Commit Manager

echo.
echo  GCPShot - Commit Manager
echo  Repositorio: github.com/cliqueprojeto/GCPShot
echo  ---------------------------------------------
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Git nao encontrado no PATH.
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Execute este script na raiz do projeto GCPShot.
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Remote 'origin' nao configurado.
  echo        Configure com: git remote add origin https://github.com/cliqueprojeto/GCPShot.git
  exit /b 1
)

set "VERSION=desconhecida"
where node >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"
)

set "MSG=%~1"
if "%MSG%"=="" (
  for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "TODAY=%%c-%%b-%%a"
  set "MSG=chore: GCPShot v!VERSION! - sync !TODAY!"
)

echo Versao: !VERSION!
echo Branch: main
echo Mensagem: !MSG!
echo.

git add -A

git diff --cached --name-only 2>nul | findstr /I /R "\\\.env$ \\.env\. credentials\.json" >nul 2>&1
if not errorlevel 1 (
  echo [AVISO] Arquivo sensivel detectado no stage. Abortando por seguranca.
  git reset HEAD >nul 2>&1
  exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] Nenhuma alteracao para commitar. Repositorio ja esta sincronizado.
  exit /b 0
)

echo Alteracoes preparadas:
git diff --cached --stat
echo.

git commit -m "!MSG!"
if errorlevel 1 (
  echo [ERRO] Falha ao criar commit.
  exit /b 1
)

git rev-parse --verify HEAD~1 >nul 2>&1
if errorlevel 1 (
  echo Enviando primeiro commit para origin/main...
  git push -u origin main
) else (
  git push origin main
)

if errorlevel 1 (
  echo [ERRO] Falha no push. Verifique login GitHub ^(gh auth login ou credential manager^).
  exit /b 1
)

echo.
echo [OK] Commit e push concluidos com sucesso.
echo      Remote: origin ^(github.com/cliqueprojeto/GCPShot^)
echo.
exit /b 0
