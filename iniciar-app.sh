#!/usr/bin/env bash

# Diretório base do projeto
PROJECT_DIR="/home/kaike/Documents/MeusProjetos/Plataforma-Ingles"
cd "$PROJECT_DIR" || exit 1

# Verifica se o servidor local já está ativo
if ! curl -s -o /dev/null -m 1 "http://localhost:3000"; then
  echo "Iniciando servidor do English Studio..."
  nohup npm run dev > /tmp/english-studio-dev.log 2>&1 &
  
  # Aguarda o servidor responder na porta 3000 (máximo 20 segundos)
  contador=0
  until curl -s -o /dev/null -m 1 "http://localhost:3000" || [ $contador -ge 20 ]; do
    sleep 1
    contador=$((contador + 1))
  done
fi

URL="http://localhost:3000"

# Abre no modo Web App (janela única e dedicada sem barras de navegador)
if command -v brave-browser >/dev/null 2>&1; then
  brave-browser --app="$URL" >/dev/null 2>&1 &
elif command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="$URL" >/dev/null 2>&1 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --app="$URL" >/dev/null 2>&1 &
elif command -v microsoft-edge >/dev/null 2>&1; then
  microsoft-edge --app="$URL" >/dev/null 2>&1 &
else
  # Fallback padrão
  xdg-open "$URL" >/dev/null 2>&1 &
fi

exit 0
