#!/bin/sh
# Sobe a 5e-FastAPI local (../../../API/5e-FastAPI, ou DND_API_DIR) e o app web DM-Control (Vite) junto com o Expo,
# e aponta o app para a API. Os dois param quando o Expo fecha. Argumentos extras vão para o `expo start` (ex.: `bun dev --web`).
api_dir=${DND_API_DIR:-../../../API/5e-FastAPI}
api_port=${DND_API_PORT:-8000}
if [ ! -x "$api_dir/dev" ]; then
  echo "Não achei a API em $api_dir (defina DND_API_DIR)." >&2
  exit 1
fi

# 0.0.0.0 para o celular alcançar; CORS liberado para o Expo Web.
DND_ORIGENS_CORS='*' "$api_dir/dev" --host 0.0.0.0 --port "$api_port" &
api_pid=$!

(cd ../web/DM-Control && POCKETBASE_URL=${POCKETBASE_URL:-http://127.0.0.1:8090} exec bun run dev) &
web_pid=$!
trap 'kill $api_pid $web_pid 2>/dev/null' EXIT INT TERM

EXPO_PUBLIC_DND_API_URL=http://localhost:$api_port sh scripts/expo.sh start "$@"
