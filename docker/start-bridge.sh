#!/usr/bin/env sh
set -eu

: "${BRIDGE_HOST:=0.0.0.0}"
: "${BRIDGE_PORT:=9911}"
: "${KUMA_URL:=http://127.0.0.1:3001}"

echo "[entrypoint] Waiting for Uptime Kuma at ${KUMA_URL}..."
for _ in $(seq 1 60); do
  if curl -fsS "${KUMA_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

exec node /opt/kuma-bridge/src/server.js
